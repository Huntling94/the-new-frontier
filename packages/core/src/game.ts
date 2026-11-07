import { LEVELS, POTIONS } from '../data/combat';
import { MARKS } from '../data/gear';
import { CLASSES, SQUAD } from '../data/squad';
import { createDummy, updateEnemy } from './enemies';
import { updateUnit } from './movement';
import { applyCommands } from './orders';
import { updateScheduled, updateShots } from './shots';
import { createGear, recalculate } from './stats';
import type { ClassId, Command, GameEvent, GameState, Scenario, Unit } from './state';
import { buildZones } from './world';

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
    zones: [],
    anchor: scenario.squadStart,
    heading: scenario.squadHeading,
    scatterCooldownTicks: 0,
    enemies: [],
    shots: [],
    scheduled: [],
    sharedTargetId: null,
    marks: MARKS.start,
    potions: POTIONS.start,
    potionCooldownTicks: 0,
    squadDown: false,
  };
  state.zones = buildZones(state);
  state.units = SQUAD.map((classId) => createUnit(state, classId, scenario));
  if (scenario.dummy) {
    state.enemies = [createDummy(state, scenario.dummy)];
  }
  return state;
}

function runRules(state: GameState, events: GameEvent[]): void {
  state.scatterCooldownTicks = Math.max(0, state.scatterCooldownTicks - 1);
  state.potionCooldownTicks = Math.max(0, state.potionCooldownTicks - 1);
  for (const unit of state.units) {
    updateUnit(state, unit, events);
  }
  for (const enemy of state.enemies) {
    updateEnemy(state, enemy, events);
  }
  updateShots(state, events);
  updateScheduled(state, events);
}

/**
 * Runs one tick. Units update in ID order. Once the squad is down the tick still
 * counts, because replays and the viewer rely on it, and nothing else changes.
 */
export function advance(state: GameState): GameEvent[] {
  const events: GameEvent[] = [];
  if (!state.squadDown) {
    runRules(state, events);
  }
  state.tick += 1;
  return events;
}

/** Commands land at the start of the tick, then the tick runs. */
export function step(state: GameState, commands: readonly Command[]): GameEvent[] {
  return [...applyCommands(state, commands), ...advance(state)];
}
