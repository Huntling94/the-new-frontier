import { AIM } from '../data/combat';
import { SPELLS } from '../data/spells';
import {
  aliveEnemy,
  healUnit,
  hitEnemy,
  lowestHealthUnit,
  nearestEnemy,
  wakePack,
} from './combat';
import { characterOf } from './family';
import { hasSpellWeapon, spellsKnown } from './items';
import { livingUnits } from './formation';
import { fireShot } from './shots';
import type {
  CastCommand,
  Enemy,
  GameEvent,
  GameState,
  Point,
  RefusalReason,
  Body,
} from './state';
import { TICKS, secondsToTicks } from './time';

/** The enemy named, then near the point, then the shared target, the unit's own, and the nearest. */
function aimEnemy(state: GameState, unit: Body, command: CastCommand): Enemy | null {
  return (
    aliveEnemy(state, command.enemyId) ??
    (command.point ? nearestEnemy(state, command.point, AIM.pointRadius) : null) ??
    aliveEnemy(state, state.sharedTargetId) ??
    aliveEnemy(state, unit.targetId) ??
    nearestEnemy(state, unit, AIM.fallbackRange)
  );
}

function taunt(state: GameState, unit: Body): Point {
  const { radius, bossRadius } = SPELLS.taunt;
  for (const enemy of state.live.enemies) {
    const reach = enemy.boss ? bossRadius : radius;
    if (enemy.alive && Math.hypot(enemy.x - unit.x, enemy.z - unit.z) < reach) {
      enemy.tauntTicks = enemy.boss ? TICKS.tauntBoss : TICKS.taunt;
      enemy.tauntUnitId = unit.id;
      wakePack(state, enemy);
    }
  }
  return unit;
}

function cleave(state: GameState, unit: Body, events: GameEvent[]): Point {
  const { radius, sizeShare, multiplier, knockback } = SPELLS.cleave;
  for (const enemy of state.live.enemies) {
    const reach = radius + enemy.size * sizeShare;
    if (enemy.alive && Math.hypot(enemy.x - unit.x, enemy.z - unit.z) < reach) {
      const direction = Math.atan2(enemy.z - unit.z, enemy.x - unit.x);
      hitEnemy(state, unit, enemy, multiplier, events, knockback, direction);
    }
  }
  return unit;
}

function guard(unit: Body): Point {
  unit.guardTicks = TICKS.guard;
  return unit;
}

function singleShot(
  state: GameState,
  unit: Body,
  command: CastCommand,
  multiplier: number,
  crippling: boolean,
): Point | RefusalReason {
  const enemy = aimEnemy(state, unit, command);
  if (!enemy) {
    return 'no-target';
  }
  fireShot(state, unit, enemy, multiplier, crippling);
  return enemy;
}

function volley(state: GameState, unit: Body, command: CastCommand): Point {
  const { x, z } = command.point ?? unit;
  for (const seconds of SPELLS.volley.strikeSeconds) {
    state.live.scheduled.push({
      kind: 'volley-strike',
      ticks: secondsToTicks(seconds),
      unitId: unit.id,
      x,
      z,
    });
  }
  return { x, z };
}

function woundedNear(state: GameState, point: Point): Body | null {
  let best: Body | null = null;
  let bestDistance = SPELLS.mend.pointRadius;
  for (const ally of livingUnits(state)) {
    const distance = Math.hypot(ally.x - point.x, ally.z - point.z);
    if (ally.health < ally.maxHealth && distance < bestDistance) {
      best = ally;
      bestDistance = distance;
    }
  }
  return best;
}

function mend(
  state: GameState,
  unit: Body,
  command: CastCommand,
  events: GameEvent[],
): Point | RefusalReason {
  const ally =
    (command.point ? woundedNear(state, command.point) : null) ?? lowestHealthUnit(state);
  if (!ally || ally.health >= ally.maxHealth) {
    return 'nobody-hurt';
  }
  const { healthShare, attackShare } = SPELLS.mend;
  healUnit(state, ally, ally.maxHealth * healthShare + unit.attack * attackShare, events);
  return ally;
}

function rally(state: GameState, unit: Body): Point {
  for (const ally of livingUnits(state)) {
    ally.rallyTicks = TICKS.rally;
  }
  return unit;
}

/** Brings back the fallen ally nearest the caster, at any distance, as in the squad test. */
function revive(state: GameState, unit: Body, events: GameEvent[]): Point | RefusalReason {
  let nearest: Body | null = null;
  let nearestDistance = Infinity;
  for (const ally of state.bodies) {
    const distance = Math.hypot(ally.x - unit.x, ally.z - unit.z);
    if (!ally.alive && distance < nearestDistance) {
      nearest = ally;
      nearestDistance = distance;
    }
  }
  if (!nearest) {
    return 'no-target';
  }
  nearest.alive = true;
  nearest.health = nearest.maxHealth * SPELLS.revive.healthShare;
  nearest.invulnerableTicks = TICKS.reviveInvulnerable;
  events.push({ type: 'unit-revived', tick: state.tick, unitId: nearest.id });
  return nearest;
}

/** Runs a spell's effect. Returns where it landed, or why it cannot happen. */
function resolve(
  state: GameState,
  unit: Body,
  command: CastCommand,
  events: GameEvent[],
): Point | RefusalReason {
  switch (command.spell) {
    case 'taunt':
      return taunt(state, unit);
    case 'cleave':
      return cleave(state, unit, events);
    case 'guard':
      return guard(unit);
    case 'aimed-shot':
      return singleShot(state, unit, command, SPELLS['aimed-shot'].multiplier, false);
    case 'crippling-shot':
      return singleShot(state, unit, command, SPELLS['crippling-shot'].multiplier, true);
    case 'volley':
      return volley(state, unit, command);
    case 'mend':
      return mend(state, unit, command, events);
    case 'rally':
      return rally(state, unit);
    case 'revive':
      return revive(state, unit, events);
  }
}

export function castSpell(
  state: GameState,
  command: CastCommand,
  events: GameEvent[],
): RefusalReason | null {
  const { unitId, spell, point } = command;
  if (point && (!Number.isFinite(point.x) || !Number.isFinite(point.z))) {
    return 'bad-point';
  }
  const unit = state.bodies.find((candidate) => candidate.id === unitId);
  if (!unit) {
    return 'unknown-unit';
  }
  const character = characterOf(state, unit.id);
  // A spell needs its art, and a matching weapon in hand unless it names none (D-027).
  if (!spellsKnown(character).includes(spell)) {
    return 'not-your-spell';
  }
  if (!hasSpellWeapon(character, spell)) {
    return 'needs-weapon';
  }
  if ((unit.spellTicks[spell] ?? 0) > 0) {
    return 'on-cooldown';
  }
  if (!unit.alive) {
    return 'caster-down';
  }
  const { mana, cooldownSeconds } = SPELLS[spell];
  if (unit.mana < mana) {
    return 'no-mana';
  }
  const effects: GameEvent[] = [];
  const landed = resolve(state, unit, command, effects);
  if (typeof landed === 'string') {
    return landed;
  }
  unit.spellTicks[spell] = secondsToTicks(cooldownSeconds);
  unit.mana -= mana;
  const { x, z } = landed;
  events.push({ type: 'spell-cast', tick: state.tick, unitId, spell, x, z }, ...effects);
  return null;
}
