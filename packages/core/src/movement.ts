import { AUTO_HEAL, COMBAT, MANA } from '../data/combat';
import { MOVEMENT, ROUTE, SCATTER } from '../data/movement';
import { aliveEnemy, healUnit, hitEnemy, nearestEnemy } from './combat';
import { characterOf, classOf, placeOf } from './family';
import { spellsKnown, weaponOf } from './items';
import { centreOf, livingUnits, triangleSlot } from './formation';
import { fireShot } from './shots';
import type { Enemy, GameEvent, GameState, Point, Body } from './state';
import { TICKS, perTick, secondsToTicks } from './time';
import { canReach, clearAlong, findRoute, isOpen, lineClear } from './grid';
import { gridOf, pushOutOfObstacles } from './world';

/** A step is allowed onto open ground, and always off closed ground, so nobody is trapped. */
function canStep(state: GameState, unit: Body, x: number, z: number): boolean {
  const grid = gridOf(state);
  return isOpen(grid, x, z) || !isOpen(grid, unit.x, unit.z);
}

function dash(state: GameState, unit: Body): void {
  if (unit.dashTicks === 0) {
    return;
  }
  unit.dashTicks -= 1;
  const stride = perTick(SCATTER.dashSpeed);
  const x = unit.x + unit.dashX * stride;
  const z = unit.z + unit.dashZ * stride;
  if (canStep(state, unit, x, z)) {
    unit.x = x;
    unit.z = z;
  }
}

export function clearOrder(unit: Body): void {
  unit.dest = null;
  unit.attackMove = false;
  unit.bestDistance = null;
  unit.stuckTicks = 0;
}

function near(a: Point, b: Point, within: number): boolean {
  return Math.hypot(a.x - b.x, a.z - b.z) < within;
}

/** How far the unit has left to walk to a point: along its route if it is routing there. */
function walkLeft(unit: Body, goal: Point): number {
  const { route, routeGoal } = unit;
  if (!routeGoal || route.length === 0 || !near(routeGoal, goal, ROUTE.goalDrift)) {
    return Math.hypot(goal.x - unit.x, goal.z - unit.z);
  }
  let total = 0;
  let from: Point = unit;
  for (const corner of route) {
    total += Math.hypot(corner.x - from.x, corner.z - from.z);
    from = corner;
  }
  return total;
}

/** Where the unit's order sends it, if it still has one. */
function orderTarget(state: GameState, unit: Body, events: GameEvent[]): Point | null {
  const { dest } = unit;
  if (!dest) {
    return null;
  }
  const distance = walkLeft(unit, dest);
  const madeProgress =
    unit.bestDistance === null || distance < unit.bestDistance - MOVEMENT.minProgress;
  unit.stuckTicks = madeProgress ? 0 : unit.stuckTicks + 1;
  unit.bestDistance = Math.min(unit.bestDistance ?? distance, distance);

  if (Math.hypot(dest.x - unit.x, dest.z - unit.z) < MOVEMENT.arriveDistance) {
    clearOrder(unit);
    events.push({ type: 'unit-arrived', tick: state.tick, unitId: unit.id });
    return null;
  }
  // With no route at all, the unit gives up at once (D-023).
  if (unit.stuckTicks > TICKS.giveUp || !canReach(gridOf(state), unit, dest)) {
    clearOrder(unit);
    events.push({ type: 'unit-gave-up', tick: state.tick, unitId: unit.id });
    return null;
  }
  return dest;
}

/** With nothing to do, a unit drifts back to its place in the triangle, short of any wall. */
function slotTarget(state: GameState, unit: Body): Point | null {
  const slot = clearAlong(
    gridOf(state),
    state.anchor,
    triangleSlot(placeOf(state, unit.id), state.anchor, state.heading),
  );
  const far = Math.hypot(slot.x - unit.x, slot.z - unit.z) > MOVEMENT.slotReturnDistance;
  return far ? slot : null;
}

/**
 * The next point to walk to on the way to a goal, or null if there is no way.
 * A unit walks straight when the line is clear, and asks A* only when it is not.
 * A route is kept while its goal stays put and its leg stays clear, and a corner is
 * dropped once the next leg is clear from where the unit stands.
 */
function steer(state: GameState, unit: Body, goal: Point): Point | null {
  const grid = gridOf(state);
  if (lineClear(grid, unit, goal)) {
    unit.route = [];
    unit.routeGoal = null;
    return goal;
  }
  const { routeGoal } = unit;
  // A shove can leave the unit where its current leg is blocked, so that needs a new route too.
  const legClear = lineClear(grid, unit, unit.route[0] ?? goal);
  if (routeGoal && unit.route.length > 0 && near(routeGoal, goal, ROUTE.goalDrift) && legClear) {
    unit.route[unit.route.length - 1] = { x: goal.x, z: goal.z };
  } else {
    const route = findRoute(grid, unit, goal);
    unit.route = route ?? [];
    unit.routeGoal = route ? { x: goal.x, z: goal.z } : null;
    if (unit.dest && near(unit.dest, goal, ROUTE.goalDrift)) {
      // Progress is now measured along the new route, which is longer than the straight line.
      unit.bestDistance = null;
    }
  }
  const { route } = unit;
  while (route.length > 1) {
    const after = route[1] as Point;
    // Being near a corner is not enough: the next leg must be clear from here (S3i decision 1).
    if (!lineClear(grid, unit, after)) {
      break;
    }
    route.shift();
  }
  return route[0] ?? null;
}

/** Steps towards the target along its route, or along whichever axis is still walkable. */
function walk(state: GameState, unit: Body, goal: Point): void {
  const target = steer(state, unit, goal);
  if (!target) {
    return;
  }
  const dx = target.x - unit.x;
  const dz = target.z - unit.z;
  const distance = Math.hypot(dx, dz) || MOVEMENT.zeroDistance;
  const stride = Math.min(perTick(classOf(state, unit.id).speed), distance);
  const x = unit.x + (dx / distance) * stride;
  const z = unit.z + (dz / distance) * stride;
  if (canStep(state, unit, x, z)) {
    unit.x = x;
    unit.z = z;
  } else if (canStep(state, unit, x, unit.z)) {
    unit.x = x;
  } else if (canStep(state, unit, unit.x, z)) {
    unit.z = z;
  }
}

function pushApart(state: GameState, unit: Body): void {
  for (const other of state.bodies) {
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

function countDownTimers(state: GameState, unit: Body): void {
  unit.invulnerableTicks = Math.max(0, unit.invulnerableTicks - 1);
  unit.attackTicks = Math.max(0, unit.attackTicks - 1);
  unit.guardTicks = Math.max(0, unit.guardTicks - 1);
  unit.rallyTicks = Math.max(0, unit.rallyTicks - 1);
  const { mana } = classOf(state, unit.id);
  for (const spell of spellsKnown(characterOf(state, unit.id))) {
    unit.spellTicks[spell] = Math.max(0, (unit.spellTicks[spell] ?? 0) - 1);
  }
  unit.mana = Math.min(mana, unit.mana + perTick(MANA.regenPerSecond));
}

/** Heals the lowest ally in range, one at a time (D-008). */
function autoHeal(state: GameState, unit: Body, events: GameEvent[]): void {
  if (unit.attackTicks > 0 || unit.mana < AUTO_HEAL.manaCost) {
    return;
  }
  let patient: Body | null = null;
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

function attack(state: GameState, unit: Body, enemy: Enemy, events: GameEvent[]): void {
  if (unit.attackTicks > 0) {
    return;
  }
  const { melee, knockback } = weaponOf(characterOf(state, unit.id)).weapon;
  unit.attackTicks = secondsToTicks(unit.attackSeconds);
  if (melee) {
    const direction = Math.atan2(enemy.z - unit.z, enemy.x - unit.x);
    hitEnemy(state, unit, enemy, 1, events, knockback, direction);
  } else {
    fireShot(state, unit, enemy, 1, false);
  }
}

/** Fights its target or the nearest enemy. Returns where the unit should walk. */
function fight(state: GameState, unit: Body, goal: Point | null, events: GameEvent[]): Point | null {
  const { aggroRange } = classOf(state, unit.id);
  const { range } = weaponOf(characterOf(state, unit.id)).weapon;
  const enemy =
    aliveEnemy(state, unit.targetId) ??
    nearestEnemy(state, unit, aggroRange, ({ awake }) => awake);
  if (!enemy) {
    return goal;
  }
  const distance = Math.hypot(enemy.x - unit.x, enemy.z - unit.z);
  if (distance - enemy.size * COMBAT.meleeSizeShare <= range) {
    attack(state, unit, enemy, events);
    return null;
  }
  return !unit.hold || unit.forced ? enemy : goal;
}

/** With an enemy about, the Healer stays near the others. Alone, it stays put. */
function stayWithSquad(state: GameState, unit: Body): Point | null {
  const others = livingUnits(state).filter((other) => other !== unit);
  if (others.length === 0) {
    return null;
  }
  const centre = centreOf(others);
  const far = Math.hypot(centre.x - unit.x, centre.z - unit.z) > AUTO_HEAL.stayWithin;
  return far ? centre : null;
}

/** Where a unit with no order and no fight goes. */
function idleGoal(state: GameState, unit: Body): Point | null {
  const { aggroRange, autoHeals } = classOf(state, unit.id);
  if (unit.dest || unit.hold || unit.targetId !== null) {
    return null;
  }
  if (!nearestEnemy(state, unit, aggroRange)) {
    return slotTarget(state, unit);
  }
  return autoHeals ? stayWithSquad(state, unit) : null;
}

/** Decides what the unit does this tick, and returns where it walks. */
function decide(state: GameState, unit: Body, events: GameEvent[]): Point | null {
  const { autoHeals, attackMoveRange } = classOf(state, unit.id);
  if (autoHeals) {
    autoHeal(state, unit, events);
  }
  let goal = orderTarget(state, unit, events);
  if (goal && unit.attackMove && !autoHeals) {
    const enemy = nearestEnemy(state, unit, attackMoveRange, ({ awake, boss }) => awake || !boss);
    if (enemy) {
      unit.targetId = enemy.id;
      // A unit holding its line still closes on what it found.
      unit.forced = true;
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
export function updateUnit(state: GameState, unit: Body, events: GameEvent[]): void {
  countDownTimers(state, unit);
  if (!unit.alive) {
    return;
  }
  dash(state, unit);
  const goal = decide(state, unit, events);
  if (goal) {
    walk(state, unit, goal);
  } else {
    unit.route = [];
    unit.routeGoal = null;
  }
  pushApart(state, unit);
  pushOutOfObstacles(state, unit, MOVEMENT.unitRadius);
}
