import { createGame, step } from './game';
import type { Command, GameEvent, GameState, Replay } from './state';

/** Stops an entry being skipped silently. */
function checkEntries(replay: Replay): void {
  let last = -1;
  for (const { tick } of replay.entries) {
    if (!Number.isInteger(tick) || tick <= last) {
      throw new Error(`Replay entry at tick ${String(tick)} is out of order.`);
    }
    if (tick >= replay.ticks) {
      throw new Error(`Replay entry at tick ${String(tick)} is past the end.`);
    }
    last = tick;
  }
}

/** Plays a replay from the start, and returns its final state and all its events. */
export function runReplay(replay: Replay): { state: GameState; events: GameEvent[] } {
  checkEntries(replay);
  const commandsByTick = new Map<number, readonly Command[]>(
    replay.entries.map(({ tick, commands }) => [tick, commands]),
  );
  const state = createGame(replay.seed, replay.scenario);
  const events: GameEvent[] = [];
  for (let tick = 0; tick < replay.ticks; tick += 1) {
    events.push(...step(state, commandsByTick.get(tick) ?? []));
  }
  return { state, events };
}
