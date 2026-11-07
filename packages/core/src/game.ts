import { CLASSES, SQUAD } from '../data/squad';
import { updateUnit } from './movement';
import { applyCommands } from './orders';
import type { ClassId, Command, GameEvent, GameState, Scenario, Unit } from './state';
import { buildZones } from './world';

function createUnit(state: GameState, classId: ClassId, scenario: Scenario): Unit {
  const { startOffset } = CLASSES[classId];
  const id = state.nextId;
  state.nextId += 1;
  return {
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
  };
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
  };
  state.zones = buildZones(state);
  state.units = SQUAD.map((classId) => createUnit(state, classId, scenario));
  return state;
}

/** Runs one tick. Units update in ID order. */
export function advance(state: GameState): GameEvent[] {
  const events: GameEvent[] = [];
  state.scatterCooldownTicks = Math.max(0, state.scatterCooldownTicks - 1);
  for (const unit of state.units) {
    updateUnit(state, unit, events);
  }
  state.tick += 1;
  return events;
}

/** Commands land at the start of the tick, then the tick runs. */
export function step(state: GameState, commands: readonly Command[]): GameEvent[] {
  return [...applyCommands(state, commands), ...advance(state)];
}
