import { POTIONS } from '../data/combat';
import { MOVEMENT, SCATTER } from '../data/movement';
import { aliveEnemy, healUnit, lowestHealthUnit } from './combat';
import { centreOf, livingUnits, triangleSlot } from './formation';
import { TAU } from './island';
import { clearOrder } from './movement';
import { castSpell } from './spells';
import type {
  Command,
  GameEvent,
  GameState,
  MoveCommand,
  Point,
  PotionCommand,
  RefusalReason,
  TargetCommand,
  Unit,
} from './state';
import { TICKS } from './time';
import { applyUpgrade } from './upgrades';
import { pullOntoLand } from './world';

function sendTo(unit: Unit, dest: Point, attack: boolean): void {
  unit.dest = dest;
  unit.attackMove = attack;
  unit.bestDistance = null;
  unit.stuckTicks = 0;
  unit.targetId = null;
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
    unit.targetId = null;
  });
  return null;
}

/** Points units at an enemy. They chase it, even while holding. */
function applyTarget(state: GameState, command: TargetCommand): RefusalReason | null {
  const known = state.units.map((unit) => unit.id);
  if (!command.unitIds.every((id) => known.includes(id))) {
    return 'unknown-unit';
  }
  const enemy = aliveEnemy(state, command.enemyId);
  if (!enemy) {
    return 'no-target';
  }
  const units = livingUnits(state).filter((unit) => command.unitIds.includes(unit.id));
  if (units.length === 0) {
    return 'no-living-units';
  }
  for (const unit of units) {
    clearOrder(unit);
    unit.targetId = enemy.id;
    unit.forced = true;
  }
  state.sharedTargetId = enemy.id;
  return null;
}

/** Heals the unit named, or else whoever is lowest. */
function applyPotion(
  state: GameState,
  command: PotionCommand,
  events: GameEvent[],
): RefusalReason | null {
  const named = state.units.find((unit) => unit.id === command.unitId);
  if (command.unitId !== undefined && !named) {
    return 'unknown-unit';
  }
  if (named && !named.alive) {
    return 'no-living-units';
  }
  if (state.potionCooldownTicks > 0) {
    return 'on-cooldown';
  }
  if (state.potions === 0) {
    return 'no-potions';
  }
  const unit = named ?? lowestHealthUnit(state);
  if (!unit || unit.health >= unit.maxHealth) {
    return 'nobody-hurt';
  }
  state.potions -= 1;
  state.potionCooldownTicks = TICKS.potionCooldown;
  healUnit(state, unit, unit.maxHealth * POTIONS.healthShare, events);
  return null;
}

function apply(state: GameState, command: Command, events: GameEvent[]): RefusalReason | null {
  if (state.squadDown) {
    return 'no-living-units';
  }
  switch (command.type) {
    case 'move':
      return applyMove(state, command);
    case 'regroup':
      return applyRegroup(state);
    case 'scatter':
      return applyScatter(state);
    case 'target':
      return applyTarget(state, command);
    case 'cast':
      return castSpell(state, command, events);
    case 'potion':
      return applyPotion(state, command, events);
    case 'upgrade':
      return applyUpgrade(state, command, events);
  }
}

/** Applies commands in list order, with no time passing. */
export function applyCommands(state: GameState, commands: readonly Command[]): GameEvent[] {
  return commands.flatMap((command): GameEvent[] => {
    const effects: GameEvent[] = [];
    const reason = apply(state, command, effects);
    const { tick } = state;
    return reason
      ? [{ type: 'order-refused', tick, order: command.type, reason }]
      : [{ type: 'order-accepted', tick, order: command.type }, ...effects];
  });
}
