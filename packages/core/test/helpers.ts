import { DUMMY_SCENARIO } from '../data/scenarios';
import { createGame, step } from '../src/game';
import type { Enemy, GameEvent, GameState, Unit } from '../src/state';

export const FIGHTER = 1;
export const SNIPER = 2;
export const HEALER = 3;
export const DUMMY_ID = 4;

export function dummyGame(seed = 1): GameState {
  return createGame(seed, DUMMY_SCENARIO);
}

export function unitOf(state: GameState, id: number): Unit {
  const unit = state.units.find((candidate) => candidate.id === id);
  if (!unit) throw new Error(`No unit ${String(id)}.`);
  return unit;
}

export function dummyOf(state: GameState): Enemy {
  const [dummy] = state.enemies;
  if (!dummy) throw new Error('No dummy.');
  return dummy;
}

/** Puts a unit somewhere, with no order to walk off. */
export function place(unit: Unit, x: number, z: number): void {
  unit.x = x;
  unit.z = z;
  unit.dest = null;
  unit.hold = true;
}

/** Takes the squad out of the dummy's way, so a test can bring in only who it needs. */
export function sendAway(state: GameState): void {
  place(unitOf(state, FIGHTER), -60, 0);
  place(unitOf(state, SNIPER), -60, 8);
  place(unitOf(state, HEALER), -60, 16);
}

export function run(state: GameState, ticks: number): GameEvent[] {
  const events: GameEvent[] = [];
  for (let tick = 0; tick < ticks; tick += 1) {
    events.push(...step(state, []));
  }
  return events;
}

export function ofType<T extends GameEvent['type']>(
  events: readonly GameEvent[],
  type: T,
): Extract<GameEvent, { type: T }>[] {
  return events.filter((event): event is Extract<GameEvent, { type: T }> => event.type === type);
}
