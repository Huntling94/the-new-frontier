import { MOVEMENT, SCATTER } from '../data/movement';
import { centreOf, livingUnits, triangleSlot } from './formation';
import { TAU } from './island';
import type {
  Command,
  GameEvent,
  GameState,
  MoveCommand,
  Point,
  RefusalReason,
  Unit,
} from './state';
import { TICKS } from './time';
import { pullOntoLand } from './world';

function sendTo(unit: Unit, dest: Point, attack: boolean): void {
  unit.dest = dest;
  unit.attackMove = attack;
  unit.bestDistance = null;
  unit.stuckTicks = 0;
}

function formTriangle(state: GameState, units: readonly Unit[], point: Point, attack: boolean): void {
  const centre = centreOf(units);
  if (Math.hypot(point.x - centre.x, point.z - centre.z) > MOVEMENT.minHeadingDistance) {
    state.heading = Math.atan2(point.z - centre.z, point.x - centre.x);
  }
  state.anchor = point;
  for (const unit of units) {
    unit.hold = false;
    sendTo(unit, triangleSlot(unit.classId, point, state.heading), attack);
  }
}

function formLine(units: readonly Unit[], point: Point, attack: boolean): void {
  const centre = centreOf(units);
  const facing = Math.atan2(point.z - centre.z, point.x - centre.x);
  units.forEach((unit, index) => {
    const offset = (index - (units.length - 1) / 2) * MOVEMENT.lineSpacing;
    unit.hold = true;
    sendTo(
      unit,
      { x: point.x - Math.sin(facing) * offset, z: point.z + Math.cos(facing) * offset },
      attack,
    );
  });
}

/** All the living form the triangle, and some of them form a line and hold it. */
function orderMove(state: GameState, units: readonly Unit[], target: Point, attack: boolean): void {
  const point = pullOntoLand(target.x, target.z);
  if (units.length === livingUnits(state).length) {
    formTriangle(state, units, point, attack);
  } else {
    formLine(units, point, attack);
  }
}

function applyMove(state: GameState, command: MoveCommand): RefusalReason | null {
  if (!Number.isFinite(command.x) || !Number.isFinite(command.z)) {
    return 'bad-point';
  }
  const known = state.units.map((unit) => unit.id);
  if (!command.unitIds.every((id) => known.includes(id))) {
    return 'unknown-unit';
  }
  const units = livingUnits(state).filter((unit) => command.unitIds.includes(unit.id));
  if (units.length === 0) {
    return 'no-living-units';
  }
  orderMove(state, units, command, command.attack);
  return null;
}

function applyRegroup(state: GameState): RefusalReason | null {
  const units = livingUnits(state);
  if (units.length === 0) {
    return 'no-living-units';
  }
  orderMove(state, units, centreOf(units), false);
  return null;
}

function applyScatter(state: GameState): RefusalReason | null {
  const units = livingUnits(state);
  if (state.scatterCooldownTicks > 0) {
    return 'on-cooldown';
  }
  if (units.length === 0) {
    return 'no-living-units';
  }
  state.scatterCooldownTicks = TICKS.scatterCooldown;
  const centre = centreOf(units);
  units.forEach((unit, index) => {
    const dx = unit.x - centre.x;
    const dz = unit.z - centre.z;
    const angle =
      Math.hypot(dx, dz) < SCATTER.minCentreDistance
        ? (index / SCATTER.sectors) * TAU
        : Math.atan2(dz, dx);
    unit.dashX = Math.cos(angle);
    unit.dashZ = Math.sin(angle);
    unit.dashTicks = TICKS.dash;
    unit.invulnerableTicks = Math.max(unit.invulnerableTicks, TICKS.invulnerable);
    unit.dest = null;
    unit.hold = true;
  });
  return null;
}

function apply(state: GameState, command: Command): RefusalReason | null {
  switch (command.type) {
    case 'move':
      return applyMove(state, command);
    case 'regroup':
      return applyRegroup(state);
    case 'scatter':
      return applyScatter(state);
  }
}

/** Applies commands in list order, with no time passing. */
export function applyCommands(state: GameState, commands: readonly Command[]): GameEvent[] {
  return commands.map((command) => {
    const reason = apply(state, command);
    const { tick } = state;
    return reason
      ? { type: 'order-refused', tick, order: command.type, reason }
      : { type: 'order-accepted', tick, order: command.type };
  });
}
