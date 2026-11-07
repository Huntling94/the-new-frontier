import { LEVELS, POTIONS } from '../data/combat';
import { MARKS } from '../data/gear';
import { CLASSES, SQUAD } from '../data/squad';
import { removeMinions, resetBoss } from './boss';
import { updateEnemy } from './enemies';
import { updateDrops } from './loot';
import { updateUnit } from './movement';
import { applyCommands } from './orders';
import { updateScheduled, updateShots } from './shots';
import { createGear, recalculate } from './stats';
import type { ClassId, Command, GameEvent, GameState, Scenario, Unit } from './state';
import { gateAt, zoneOf } from './world';
import {
  createRecords,
  crossGate,
  emptyLive,
  enterZone,
  standInTriangle,
  updateReturns,
} from './zones';

function createUnit(state: GameState, classId: ClassId, scenario: Scenario): Unit {
  const { startOffset, mana } = CLASSES[classId];
  const id = state.nextId;
  state.nextId += 1;
  const unit: Unit = {
    id,
    classId,
    alive: true,
    x: scenario.squadStart.x + startOffset.x,
    z: scenario.squadStart.z + startOffset.z,
    dest: null,
    hold: false,
    attackMove: false,
    bestDistance: null,
    stuckTicks: 0,
    route: [],
    routeGoal: null,
    dashTicks: 0,
    dashX: 0,
    dashZ: 0,
    invulnerableTicks: 0,
    level: LEVELS.start,
    xp: 0,
    health: 0,
    mana,
    gear: createGear(classId),
    maxHealth: 0,
    attack: 0,
    ar: 0,
    crit: 0,
    defence: 0,
    dr: 0,
    targetId: null,
    forced: false,
    attackTicks: 0,
    spellTicks: {},
    guardTicks: 0,
    rallyTicks: 0,
  };
  recalculate(unit);
  return unit;
}

/** Builds the starting state. The same seed and scenario always build the same game. */
export function createGame(seed: number, scenario: Scenario): GameState {
  const state: GameState = {
    tick: 0,
    rng: seed >>> 0,
    nextId: 1,
    units: [],
    zoneId: scenario.zone,
    records: createRecords(scenario),
    live: emptyLive(),
    anchor: scenario.squadStart,
    heading: scenario.squadHeading,
    scatterCooldownTicks: 0,
    sharedTargetId: null,
    marks: MARKS.start,
    potions: POTIONS.start,
    potionCooldownTicks: 0,
    squadDown: false,
    wipeTicks: 0,
    victory: false,
  };
  state.units = SQUAD.map((classId) => createUnit(state, classId, scenario));
  enterZone(state, scenario.zone);
  return state;
}

/** The first character this tick to arrive on an order inside a gate's area, and that gate. */
function arrivedAtGate(state: GameState, events: readonly GameEvent[]): ReturnType<typeof gateAt> {
  for (const event of events) {
    const unit = event.type === 'unit-arrived' ? state.units.find(({ id }) => id === event.unitId) : null;
    const gate = unit?.alive ? gateAt(state, unit) : null;
    if (gate) {
      return gate;
    }
  }
  return null;
}

function runRules(state: GameState, events: GameEvent[]): void {
  state.scatterCooldownTicks = Math.max(0, state.scatterCooldownTicks - 1);
  state.potionCooldownTicks = Math.max(0, state.potionCooldownTicks - 1);
  updateReturns(state);
  const moved: GameEvent[] = [];
  for (const unit of state.units) {
    updateUnit(state, unit, moved);
  }
  events.push(...moved);
  const gate = arrivedAtGate(state, moved);
  if (gate) {
    // The zone left behind is dropped, so nothing in it acts this tick.
    crossGate(state, gate, events);
    return;
  }
  const { live } = state;
  for (const enemy of live.enemies) {
    updateEnemy(state, enemy, events);
  }
  updateShots(state, events);
  updateDrops(state, events);
  updateScheduled(state, events);
  live.enemies = live.enemies.filter((enemy) => enemy.alive || enemy.kind === 'dummy');
}

/** Everyone gets up at the zone's camp, whole. Marks, XP and hurt monsters all stay (S2.2c). */
function returnToCamp(state: GameState, events: GameEvent[]): void {
  const { camp } = zoneOf(state);
  state.anchor = { x: camp.x, z: camp.z };
  state.heading = camp.heading;
  state.squadDown = false;
  state.sharedTargetId = null;
  state.live.shots = [];
  state.live.enemyShots = [];
  state.live.scheduled = [];
  for (const unit of state.units) {
    const { x, z } = standInTriangle(state, unit, camp, camp.heading);
    Object.assign(unit, {
      alive: true,
      x,
      z,
      dest: null,
      hold: false,
      attackMove: false,
      bestDistance: null,
      stuckTicks: 0,
      route: [],
      routeGoal: null,
      dashTicks: 0,
      invulnerableTicks: 0,
      health: unit.maxHealth,
      mana: CLASSES[unit.classId].mana,
      targetId: null,
      forced: false,
      attackTicks: 0,
      spellTicks: {},
      guardTicks: 0,
      rallyTicks: 0,
    });
  }
  removeMinions(state);
  state.live.enemies.forEach(resetBoss);
  events.push({ type: 'squad-returned', tick: state.tick });
}

/**
 * Runs one tick. Units update in ID order. While the squad is down, or once the
 * boss is dead, the tick still counts, because replays and the viewer rely on it.
 */
export function advance(state: GameState): GameEvent[] {
  const events: GameEvent[] = [];
  if (state.squadDown) {
    state.wipeTicks -= 1;
    if (state.wipeTicks <= 0) {
      returnToCamp(state, events);
    }
  } else if (!state.victory) {
    runRules(state, events);
  }
  state.tick += 1;
  return events;
}

/** Commands land at the start of the tick, then the tick runs. */
export function step(state: GameState, commands: readonly Command[]): GameEvent[] {
  return [...applyCommands(state, commands), ...advance(state)];
}
