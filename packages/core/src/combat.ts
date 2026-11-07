import { COMBAT } from '../data/combat';
import { DUMMY } from '../data/enemies';
import { livingUnits } from './formation';
import { nextRandom } from './random';
import { recalculate, xpToNextLevel } from './stats';
import type { Enemy, EnemyData, GameEvent, GameState, Point, Unit } from './state';
import { TICKS } from './time';

/** What AR against DR does to damage. More AR never lowers it, and it stops at a floor. */
export function accuracyMultiplier(ar: number, dr: number): number {
  const difference = ar - dr;
  if (difference > 0) {
    return 1 + Math.min(COMBAT.accuracyMostExtra, difference * COMBAT.accuracyPerPointAbove);
  }
  return Math.max(COMBAT.accuracyFloor, 1 + difference * COMBAT.accuracyPerPointBelow);
}

export function defenceMultiplier(defence: number): number {
  return 1 - Math.min(COMBAT.defenceMostReduction, defence * COMBAT.defencePerPoint);
}

/** Damage a unit does to an enemy, carrying every term. */
export function damageToEnemy(
  unit: Unit,
  enemy: Enemy,
  data: EnemyData,
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
    accuracyMultiplier(unit.ar, data.dr) *
    defenceMultiplier(data.defence);
  return Math.max(COMBAT.minDamage, Math.round(damage));
}

export function damageToUnit(unit: Unit, raw: number, data: EnemyData): number {
  const damage =
    raw *
    accuracyMultiplier(data.ar, unit.dr) *
    defenceMultiplier(unit.defence) *
    (unit.guardTicks > 0 ? COMBAT.guardMultiplier : 1);
  return Math.max(COMBAT.minDamage, Math.round(damage));
}

/** XP splits equally among the living (D-004). */
export function shareXp(state: GameState, xp: number, events: GameEvent[]): void {
  const living = livingUnits(state);
  if (living.length === 0) {
    return;
  }
  const each = Math.round(xp / living.length);
  for (const unit of living) {
    unit.xp += each;
    while (unit.xp >= xpToNextLevel(unit.level)) {
      unit.xp -= xpToNextLevel(unit.level);
      unit.level += 1;
      recalculate(unit);
      unit.health = unit.maxHealth;
      events.push({ type: 'level-up', tick: state.tick, unitId: unit.id, level: unit.level });
    }
  }
}

function killEnemy(state: GameState, enemy: Enemy, events: GameEvent[]): void {
  enemy.alive = false;
  enemy.health = 0;
  enemy.respawnTicks = TICKS.dummyRespawn;
  if (state.sharedTargetId === enemy.id) {
    state.sharedTargetId = null;
  }
  events.push({ type: 'enemy-down', tick: state.tick, enemyId: enemy.id });
  shareXp(state, DUMMY.xp, events);
}

/** One unit hits one enemy. `direction` is where any knockback sends it, in radians. */
export function hitEnemy(
  state: GameState,
  unit: Unit,
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
  const amount = damageToEnemy(unit, enemy, DUMMY, multiplier, crit);
  enemy.health -= amount;
  enemy.knockX += Math.cos(direction) * knockback * DUMMY.knockbackShare;
  enemy.knockZ += Math.sin(direction) * knockback * DUMMY.knockbackShare;
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

function unitDown(state: GameState, unit: Unit, events: GameEvent[]): void {
  unit.health = 0;
  unit.alive = false;
  unit.dest = null;
  unit.targetId = null;
  events.push({ type: 'unit-down', tick: state.tick, unitId: unit.id });
  if (livingUnits(state).length === 0) {
    state.squadDown = true;
    events.push({ type: 'squad-down', tick: state.tick });
  }
}

/** An enemy hits a unit. Invulnerable units take nothing. */
export function hurtUnit(
  state: GameState,
  unit: Unit,
  raw: number,
  enemy: Enemy,
  events: GameEvent[],
): void {
  if (!unit.alive || unit.invulnerableTicks > 0 || state.squadDown) {
    return;
  }
  const amount = damageToUnit(unit, raw, DUMMY);
  unit.health -= amount;
  unit.invulnerableTicks = TICKS.hitInvulnerable;
  events.push({
    type: 'hit',
    tick: state.tick,
    sourceId: enemy.id,
    targetId: unit.id,
    amount,
    crit: false,
  });
  if (unit.health <= 0) {
    unitDown(state, unit, events);
  }
}

export function healUnit(state: GameState, unit: Unit, amount: number, events: GameEvent[]): void {
  const healed = Math.min(unit.maxHealth - unit.health, amount);
  unit.health += healed;
  events.push({ type: 'healed', tick: state.tick, unitId: unit.id, amount: healed });
}

export function aliveEnemy(state: GameState, id: number | null | undefined): Enemy | null {
  return state.enemies.find((enemy) => enemy.alive && enemy.id === id) ?? null;
}

/** The enemy whose edge is nearest the point and closer than `maxDistance`. */
export function nearestEnemy(state: GameState, point: Point, maxDistance: number): Enemy | null {
  let best: Enemy | null = null;
  let bestDistance = maxDistance;
  for (const enemy of state.enemies) {
    const distance = Math.hypot(enemy.x - point.x, enemy.z - point.z) - DUMMY.size;
    if (enemy.alive && distance < bestDistance) {
      best = enemy;
      bestDistance = distance;
    }
  }
  return best;
}

/** The living unit with the lowest share of health. Earlier IDs win ties. */
export function lowestHealthUnit(state: GameState): Unit | null {
  let lowest: Unit | null = null;
  for (const unit of livingUnits(state)) {
    if (!lowest || unit.health / unit.maxHealth < lowest.health / lowest.maxHealth) {
      lowest = unit;
    }
  }
  return lowest;
}
