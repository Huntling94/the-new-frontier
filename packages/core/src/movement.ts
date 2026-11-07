import { MOVEMENT, SCATTER } from '../data/movement';
import { CLASSES } from '../data/squad';
import { triangleSlot } from './formation';
import type { GameEvent, GameState, Point, Unit } from './state';
import { TICKS, perTick } from './time';
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

function clearOrder(unit: Unit): void {
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

/** With nothing to do and no hold, a unit drifts back to its place in the triangle. */
function slotTarget(state: GameState, unit: Unit): Point | null {
  if (unit.hold) {
    return null;
  }
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

/** One tick of one unit. */
export function updateUnit(state: GameState, unit: Unit, events: GameEvent[]): void {
  unit.invulnerableTicks = Math.max(0, unit.invulnerableTicks - 1);
  if (!unit.alive) {
    return;
  }
  dash(unit);
  const target = orderTarget(state, unit, events) ?? slotTarget(state, unit);
  if (target) {
    walk(unit, target);
  }
  pushApart(state, unit);
  pushOutOfObstacles(state, unit);
}
