import { AIM } from '../data/combat';
import { DUMMY } from '../data/enemies';
import { SPELLS } from '../data/spells';
import { CLASSES } from '../data/squad';
import { aliveEnemy, healUnit, hitEnemy, lowestHealthUnit, nearestEnemy } from './combat';
import { livingUnits } from './formation';
import { fireShot } from './shots';
import type {
  CastCommand,
  Enemy,
  GameEvent,
  GameState,
  Point,
  RefusalReason,
  Unit,
} from './state';
import { TICKS, secondsToTicks } from './time';

/** The enemy named, then near the point, then the shared target, the unit's own, and the nearest. */
function aimEnemy(state: GameState, unit: Unit, command: CastCommand): Enemy | null {
  return (
    aliveEnemy(state, command.enemyId) ??
    (command.point ? nearestEnemy(state, command.point, AIM.pointRadius) : null) ??
    aliveEnemy(state, state.sharedTargetId) ??
    aliveEnemy(state, unit.targetId) ??
    nearestEnemy(state, unit, AIM.fallbackRange)
  );
}

function taunt(state: GameState, unit: Unit): Point {
  for (const enemy of state.enemies) {
    if (enemy.alive && Math.hypot(enemy.x - unit.x, enemy.z - unit.z) < SPELLS.taunt.radius) {
      enemy.tauntTicks = TICKS.taunt;
    }
  }
  return unit;
}

function cleave(state: GameState, unit: Unit, events: GameEvent[]): Point {
  const { radius, sizeShare, multiplier, knockback } = SPELLS.cleave;
  for (const enemy of state.enemies) {
    const reach = radius + DUMMY.size * sizeShare;
    if (enemy.alive && Math.hypot(enemy.x - unit.x, enemy.z - unit.z) < reach) {
      const direction = Math.atan2(enemy.z - unit.z, enemy.x - unit.x);
      hitEnemy(state, unit, enemy, multiplier, events, knockback, direction);
    }
  }
  return unit;
}

function guard(unit: Unit): Point {
  unit.guardTicks = TICKS.guard;
  return unit;
}

function singleShot(
  state: GameState,
  unit: Unit,
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

function volley(state: GameState, unit: Unit, command: CastCommand): Point {
  const { x, z } = command.point ?? unit;
  for (const seconds of SPELLS.volley.strikeSeconds) {
    state.scheduled.push({
      kind: 'volley-strike',
      ticks: secondsToTicks(seconds),
      unitId: unit.id,
      x,
      z,
    });
  }
  return { x, z };
}

function woundedNear(state: GameState, point: Point): Unit | null {
  let best: Unit | null = null;
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
  unit: Unit,
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

function rally(state: GameState, unit: Unit): Point {
  for (const ally of livingUnits(state)) {
    ally.rallyTicks = TICKS.rally;
  }
  return unit;
}

/** Brings back the fallen ally nearest the caster, at any distance, as in the squad test. */
function revive(state: GameState, unit: Unit, events: GameEvent[]): Point | RefusalReason {
  let nearest: Unit | null = null;
  let nearestDistance = Infinity;
  for (const ally of state.units) {
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
  unit: Unit,
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
  const unit = state.units.find((candidate) => candidate.id === unitId);
  if (!unit) {
    return 'unknown-unit';
  }
  if (!CLASSES[unit.classId].spells.includes(spell)) {
    return 'not-your-spell';
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
