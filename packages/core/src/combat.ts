import { COMBAT, XP_BANDS } from '../data/combat';
import { characterOf } from './family';
import { livingUnits } from './formation';
import { dropLoot } from './loot';
import { nextRandom } from './random';
import { recalculate, xpToNextLevel } from './stats';
import type { Enemy, GameEvent, GameState, Point, Body } from './state';
import { TICKS } from './time';
import { noteKill } from './zones';

/** What AR against DR does to damage (D-049). More AR never lowers it, and it stops at a floor. */
export function accuracyMultiplier(ar: number, dr: number): number {
  const difference = ar - dr;
  if (difference > 0) {
    return 1 + Math.min(COMBAT.accuracyMostExtra, difference * COMBAT.accuracyPerPointAbove);
  }
  if (difference === 0) {
    return 1;
  }
  return Math.max(COMBAT.accuracyFloor, 1 - (1 - difference) * COMBAT.accuracyPerPointBelow);
}

export function defenceMultiplier(defence: number): number {
  return 1 - Math.min(COMBAT.defenceMostReduction, defence * COMBAT.defencePerPoint);
}

/** Damage a unit does to an enemy, carrying every term. */
export function damageToEnemy(
  unit: Body,
  enemy: Enemy,
  multiplier: number,
  crit: boolean,
): number {
  const damage =
    unit.attack *
    COMBAT.attackModifier *
    multiplier *
    (crit ? COMBAT.critMultiplier : 1) *
    (unit.rallyTicks > 0 ? COMBAT.rallyMultiplier : 1) *
    (enemy.staggerTicks > 0 ? COMBAT.staggerMultiplier : 1) *
    accuracyMultiplier(unit.ar, enemy.dr) *
    defenceMultiplier(enemy.defence);
  return Math.max(COMBAT.minDamage, Math.round(damage));
}

export function damageToUnit(unit: Body, raw: number, sourceAr: number): number {
  const damage =
    raw *
    accuracyMultiplier(sourceAr, unit.dr) *
    defenceMultiplier(unit.defence) *
    (unit.guardTicks > 0 ? COMBAT.guardMultiplier : 1);
  return Math.max(COMBAT.minDamage, Math.round(damage));
}

/** The share of a kill's XP a character of this level keeps (D-051). */
export function xpShareFor(level: number, monsterLevel: number): number {
  const above = level - monsterLevel;
  if (above > XP_BANDS.noneAbove + level * XP_BANDS.noneAbovePerLevel) {
    return 0;
  }
  if (above > XP_BANDS.reducedAbove) {
    return XP_BANDS.reducedShare;
  }
  if (-above > XP_BANDS.farBelow) {
    return XP_BANDS.farBelowShare;
  }
  return -above > XP_BANDS.nearBelow ? XP_BANDS.nearBelowShare : 1;
}

/** XP splits equally among the living (D-004), then each earns by its own level (D-051). */
export function shareXp(state: GameState, xp: number, monsterLevel: number, events: GameEvent[]): void {
  const living = livingUnits(state);
  if (living.length === 0) {
    return;
  }
  const each = Math.round(xp / living.length);
  for (const unit of living) {
    const character = characterOf(state, unit.id);
    character.xp += Math.round(each * xpShareFor(character.level, monsterLevel));
    while (character.xp >= xpToNextLevel(character.level)) {
      character.xp -= xpToNextLevel(character.level);
      character.level += 1;
      recalculate(character, unit);
      unit.health = unit.maxHealth;
      events.push({ type: 'level-up', tick: state.tick, unitId: unit.id, level: character.level });
    }
  }
}

function killEnemy(state: GameState, enemy: Enemy, events: GameEvent[]): void {
  enemy.alive = false;
  enemy.health = 0;
  enemy.respawnTicks = enemy.kind === 'dummy' ? TICKS.dummyRespawn : 0;
  if (state.sharedTargetId === enemy.id) {
    state.sharedTargetId = null;
  }
  events.push({ type: 'enemy-down', tick: state.tick, enemyId: enemy.id });
  shareXp(state, enemy.xp, enemy.level, events);
  dropLoot(state, enemy);
  noteKill(state, enemy);
}

/** Wakes the enemy and the rest of its pack. A sleeping boss wakes only by being hit or neared. */
export function wakePack(state: GameState, enemy: Enemy): void {
  if (enemy.boss) {
    return;
  }
  enemy.awake = true;
  if (enemy.packId !== null) {
    for (const other of state.live.enemies) {
      if (other.packId === enemy.packId) {
        other.awake = true;
      }
    }
  }
}

export function wakeBoss(state: GameState, enemy: Enemy, events: GameEvent[]): void {
  if (enemy.boss && !enemy.awake) {
    enemy.awake = true;
    enemy.strikeTicks = TICKS.bossWokenMove;
    events.push({ type: 'boss-woken', tick: state.tick, enemyId: enemy.id });
  }
}

/** One unit hits one enemy. `direction` is where any knockback sends it, in radians. */
export function hitEnemy(
  state: GameState,
  unit: Body,
  enemy: Enemy,
  multiplier: number,
  events: GameEvent[],
  knockback = 0,
  direction = 0,
): void {
  if (!enemy.alive) {
    return;
  }
  const crit = nextRandom(state) * COMBAT.critRange < unit.crit;
  const amount = damageToEnemy(unit, enemy, multiplier, crit);
  enemy.health -= amount;
  wakeBoss(state, enemy, events);
  wakePack(state, enemy);
  enemy.knockX += Math.cos(direction) * knockback * enemy.knockbackShare;
  enemy.knockZ += Math.sin(direction) * knockback * enemy.knockbackShare;
  events.push({
    type: 'hit',
    tick: state.tick,
    sourceId: unit.id,
    targetId: enemy.id,
    amount,
    crit,
  });
  if (enemy.health <= 0) {
    killEnemy(state, enemy, events);
  }
}

function unitDown(state: GameState, unit: Body, events: GameEvent[]): void {
  unit.health = 0;
  unit.alive = false;
  unit.dest = null;
  unit.targetId = null;
  events.push({ type: 'unit-down', tick: state.tick, unitId: unit.id });
  if (livingUnits(state).length === 0) {
    state.squadDown = true;
    state.wipeTicks = TICKS.wipe;
    events.push({ type: 'squad-down', tick: state.tick });
  }
}

/** An enemy hits a unit. Invulnerable units take nothing. */
export function hurtUnit(
  state: GameState,
  unit: Body,
  raw: number,
  source: { readonly id: number; readonly ar: number },
  events: GameEvent[],
): void {
  if (!unit.alive || unit.invulnerableTicks > 0 || state.squadDown) {
    return;
  }
  const amount = damageToUnit(unit, raw, source.ar);
  unit.health -= amount;
  unit.invulnerableTicks = TICKS.hitInvulnerable;
  events.push({
    type: 'hit',
    tick: state.tick,
    sourceId: source.id,
    targetId: unit.id,
    amount,
    crit: false,
  });
  if (unit.health <= 0) {
    unitDown(state, unit, events);
  }
}

export function healUnit(state: GameState, unit: Body, amount: number, events: GameEvent[]): void {
  const healed = Math.min(unit.maxHealth - unit.health, amount);
  unit.health += healed;
  events.push({ type: 'healed', tick: state.tick, unitId: unit.id, amount: healed });
}

export function aliveEnemy(state: GameState, id: number | null | undefined): Enemy | null {
  return state.live.enemies.find((enemy) => enemy.alive && enemy.id === id) ?? null;
}

/** The enemy whose edge is nearest the point and closer than `maxDistance`. */
export function nearestEnemy(
  state: GameState,
  point: Point,
  maxDistance: number,
  counts: (enemy: Enemy) => boolean = () => true,
): Enemy | null {
  let best: Enemy | null = null;
  let bestDistance = maxDistance;
  for (const enemy of state.live.enemies) {
    const distance = Math.hypot(enemy.x - point.x, enemy.z - point.z) - enemy.size;
    if (enemy.alive && counts(enemy) && distance < bestDistance) {
      best = enemy;
      bestDistance = distance;
    }
  }
  return best;
}

/** The living unit with the lowest share of health. Earlier IDs win ties. */
export function lowestHealthUnit(state: GameState): Body | null {
  let lowest: Body | null = null;
  for (const unit of livingUnits(state)) {
    if (!lowest || unit.health / unit.maxHealth < lowest.health / lowest.maxHealth) {
      lowest = unit;
    }
  }
  return lowest;
}
