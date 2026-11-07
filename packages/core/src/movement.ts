import { AUTO_HEAL, COMBAT, MANA } from '../data/combat';
import { DUMMY } from '../data/enemies';
import { MOVEMENT, SCATTER } from '../data/movement';
import { CLASSES } from '../data/squad';
import { aliveEnemy, healUnit, hitEnemy, nearestEnemy } from './combat';
import { centreOf, livingUnits, triangleSlot } from './formation';
import { fireShot } from './shots';
import type { Enemy, GameEvent, GameState, Point, Unit } from './state';
import { TICKS, perTick, secondsToTicks } from './time';
import { isWalkable, pushOutOfObstacles } from './world';

function dash(unit: Unit): void {
  if (unit.dashTicks === 0) {
    return;
  }
  unit.dashTicks -= 1;
  const stride = perTick(SCATTER.dashSpeed);
  const x = unit.x + unit.dashX * stride;
  const z = unit.z + unit.dashZ * stride;
  if (isWalkable(x, z)) {
    unit.x = x;
    unit.z = z;
  }
}

export function clearOrder(unit: Unit): void {
  unit.dest = null;
  unit.attackMove = false;
  unit.bestDistance = null;
  unit.stuckTicks = 0;
}

/** Where the unit's order sends it, if it still has one. */
function orderTarget(state: GameState, unit: Unit, events: GameEvent[]): Point | null {
  const { dest } = unit;
  if (!dest) {
    return null;
  }
  const distance = Math.hypot(dest.x - unit.x, dest.z - unit.z);
  const madeProgress =
    unit.bestDistance === null || distance < unit.bestDistance - MOVEMENT.minProgress;
  unit.stuckTicks = madeProgress ? 0 : unit.stuckTicks + 1;
  unit.bestDistance = Math.min(unit.bestDistance ?? distance, distance);

  if (distance < MOVEMENT.arriveDistance) {
    clearOrder(unit);
    events.push({ type: 'unit-arrived', tick: state.tick, unitId: unit.id });
    return null;
  }
  if (unit.stuckTicks > TICKS.giveUp) {
    clearOrder(unit);
    events.push({ type: 'unit-gave-up', tick: state.tick, unitId: unit.id });
    return null;
  }
  return dest;
}

/** With nothing to do, a unit drifts back to its place in the triangle. */
function slotTarget(state: GameState, unit: Unit): Point | null {
  const slot = triangleSlot(unit.classId, state.anchor, state.heading);
  const far = Math.hypot(slot.x - unit.x, slot.z - unit.z) > MOVEMENT.slotReturnDistance;
  return far ? slot : null;
}

/** Steps towards the target, or along whichever axis is still walkable. */
function walk(unit: Unit, target: Point): void {
  const dx = target.x - unit.x;
  const dz = target.z - unit.z;
  const distance = Math.hypot(dx, dz) || MOVEMENT.zeroDistance;
  const stride = Math.min(perTick(CLASSES[unit.classId].speed), distance);
  const x = unit.x + (dx / distance) * stride;
  const z = unit.z + (dz / distance) * stride;
  if (isWalkable(x, z)) {
    unit.x = x;
    unit.z = z;
  } else if (isWalkable(x, unit.z)) {
    unit.x = x;
  } else if (isWalkable(unit.x, z)) {
    unit.z = z;
  }
}

function pushApart(state: GameState, unit: Unit): void {
  for (const other of state.units) {
    if (other === unit || !other.alive) {
      continue;
    }
    const dx = unit.x - other.x;
    const dz = unit.z - other.z;
    const distance = Math.hypot(dx, dz);
    if (distance < MOVEMENT.unitSpacing && distance > MOVEMENT.minPushDistance) {
      const push = (MOVEMENT.unitSpacing - distance) * perTick(MOVEMENT.pushRate);
      unit.x += (dx / distance) * push;
      unit.z += (dz / distance) * push;
    }
  }
}

function countDownTimers(unit: Unit): void {
  unit.invulnerableTicks = Math.max(0, unit.invulnerableTicks - 1);
  unit.attackTicks = Math.max(0, unit.attackTicks - 1);
  unit.guardTicks = Math.max(0, unit.guardTicks - 1);
  unit.rallyTicks = Math.max(0, unit.rallyTicks - 1);
  const { spells, mana } = CLASSES[unit.classId];
  for (const spell of spells) {
    unit.spellTicks[spell] = Math.max(0, (unit.spellTicks[spell] ?? 0) - 1);
  }
  unit.mana = Math.min(mana, unit.mana + perTick(MANA.regenPerSecond));
}

/** Heals the lowest ally in range, one at a time (D-008). */
function autoHeal(state: GameState, unit: Unit, events: GameEvent[]): void {
  if (unit.attackTicks > 0 || unit.mana < AUTO_HEAL.manaCost) {
    return;
  }
  let patient: Unit | null = null;
  let lowest = AUTO_HEAL.belowShare;
  for (const ally of livingUnits(state)) {
    const share = ally.health / ally.maxHealth;
    if (share < lowest && Math.hypot(ally.x - unit.x, ally.z - unit.z) < AUTO_HEAL.range) {
      patient = ally;
      lowest = share;
    }
  }
  if (patient) {
    unit.attackTicks = TICKS.autoHeal;
    unit.mana -= AUTO_HEAL.manaCost;
    const amount = patient.maxHealth * AUTO_HEAL.healthShare + unit.attack * AUTO_HEAL.attackShare;
    healUnit(state, patient, amount, events);
  }
}

function attack(state: GameState, unit: Unit, enemy: Enemy, events: GameEvent[]): void {
  if (unit.attackTicks > 0) {
    return;
  }
  const { attackSeconds, melee, knockback } = CLASSES[unit.classId];
  unit.attackTicks = secondsToTicks(attackSeconds);
  if (melee) {
    const direction = Math.atan2(enemy.z - unit.z, enemy.x - unit.x);
    hitEnemy(state, unit, enemy, 1, events, knockback, direction);
  } else {
    fireShot(state, unit, enemy, 1, false);
  }
}

/** Fights its target or the nearest enemy. Returns where the unit should walk. */
function fight(state: GameState, unit: Unit, goal: Point | null, events: GameEvent[]): Point | null {
  const { aggroRange, range } = CLASSES[unit.classId];
  const enemy = aliveEnemy(state, unit.targetId) ?? nearestEnemy(state, unit, aggroRange);
  if (!enemy) {
    return goal;
  }
  const distance = Math.hypot(enemy.x - unit.x, enemy.z - unit.z);
  if (distance - DUMMY.size * COMBAT.meleeSizeShare <= range) {
    attack(state, unit, enemy, events);
    return null;
  }
  return !unit.hold || unit.forced ? enemy : goal;
}

/** With an enemy about, the Healer stays near the others. Alone, it stays put. */
function stayWithSquad(state: GameState, unit: Unit): Point | null {
  const others = livingUnits(state).filter((other) => other !== unit);
  if (others.length === 0) {
    return null;
  }
  const centre = centreOf(others);
  const far = Math.hypot(centre.x - unit.x, centre.z - unit.z) > AUTO_HEAL.stayWithin;
  return far ? centre : null;
}

/** Where a unit with no order and no fight goes. */
function idleGoal(state: GameState, unit: Unit): Point | null {
  const { aggroRange, autoHeals } = CLASSES[unit.classId];
  if (unit.dest || unit.hold || unit.targetId !== null) {
    return null;
  }
  if (!nearestEnemy(state, unit, aggroRange)) {
    return slotTarget(state, unit);
  }
  return autoHeals ? stayWithSquad(state, unit) : null;
}

/** Decides what the unit does this tick, and returns where it walks. */
function decide(state: GameState, unit: Unit, events: GameEvent[]): Point | null {
  const { autoHeals, attackMoveRange } = CLASSES[unit.classId];
  if (autoHeals) {
    autoHeal(state, unit, events);
  }
  let goal = orderTarget(state, unit, events);
  if (goal && unit.attackMove && !autoHeals) {
    const enemy = nearestEnemy(state, unit, attackMoveRange);
    if (enemy) {
      unit.targetId = enemy.id;
      goal = null;
    }
  }
  if (!aliveEnemy(state, unit.targetId)) {
    unit.targetId = null;
    unit.forced = false;
  }
  if ((!unit.dest || unit.attackMove) && !autoHeals) {
    goal = fight(state, unit, goal, events);
  }
  return goal ?? idleGoal(state, unit);
}

/** One tick of one unit. */
export function updateUnit(state: GameState, unit: Unit, events: GameEvent[]): void {
  countDownTimers(unit);
  if (!unit.alive) {
    return;
  }
  dash(unit);
  const goal = decide(state, unit, events);
  if (goal) {
    walk(unit, goal);
  }
  pushApart(state, unit);
  pushOutOfObstacles(state, unit);
}
