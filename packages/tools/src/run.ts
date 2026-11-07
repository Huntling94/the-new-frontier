import {
  ISLAND_SCENARIO,
  RUNS,
  TICK_RATE,
  autoCommands,
  botCommands,
  createGame,
  hashState,
  step,
  type AutoStop,
  type BotKind,
  type Command,
  type GameEvent,
  type GameState,
} from '@new-frontier/core';

/** How a played run went. */
export interface RunResult {
  readonly finished: boolean;
  readonly stalled: boolean;
  readonly ticks: number;
  readonly wipes: number;
  readonly charactersDown: number;
  readonly revives: number;
  readonly interrupts: number;
  readonly upgrades: number;
  readonly refusals: number;
  readonly levels: readonly number[];
  readonly marks: number;
  readonly potions: number;
  readonly monstersLeft: number;
  readonly hash: string;
}

/** A stall is this long with no kill, no loot and no change in anyone's health. */
const STALL_TICKS = RUNS.stallSeconds * TICK_RATE;

function healthPrint(state: GameState): string {
  const units = state.units.map(({ health }) => health);
  const enemies = state.live.enemies.map(({ health }) => health);
  return `${units.join()}|${enemies.join()}|${String(state.live.drops.length)}`;
}

interface Tally {
  wipes: number;
  charactersDown: number;
  revives: number;
  interrupts: number;
  upgrades: number;
  refusals: number;
}

function count(tally: Tally, event: GameEvent): void {
  if (event.type === 'squad-down') tally.wipes += 1;
  if (event.type === 'unit-down') tally.charactersDown += 1;
  if (event.type === 'unit-revived') tally.revives += 1;
  if (event.type === 'interrupted') tally.interrupts += 1;
  if (event.type === 'upgraded') tally.upgrades += 1;
  if (event.type === 'order-refused') tally.refusals += 1;
}

/** Plays until `next` says to stop, the boss dies, the limit passes, or nothing moves. */
export function play(seed: number, next: (state: GameState) => readonly Command[] | null): RunResult {
  const state = createGame(seed, ISLAND_SCENARIO);
  const tally = { wipes: 0, charactersDown: 0, revives: 0, interrupts: 0, upgrades: 0, refusals: 0 };
  let print = healthPrint(state);
  let quietSince = 0;
  let stalled = false;
  while (!state.victory && state.tick < RUNS.tickLimit) {
    const commands = next(state);
    if (!commands) {
      break;
    }
    for (const event of step(state, commands)) {
      count(tally, event);
    }
    const now = healthPrint(state);
    if (now !== print) {
      print = now;
      quietSince = state.tick;
    }
    if (state.tick - quietSince > STALL_TICKS) {
      stalled = true;
      break;
    }
  }
  return {
    finished: state.victory,
    stalled,
    ticks: state.tick,
    ...tally,
    levels: state.units.map(({ level }) => level),
    marks: state.marks,
    potions: state.potions,
    monstersLeft: state.live.enemies.filter((enemy) => enemy.alive && !enemy.boss).length,
    hash: hashState(state),
  };
}

export function runBot(seed: number, kind: BotKind): RunResult {
  return play(seed, (state) => botCommands(state, kind));
}

export function runAuto(seed: number): RunResult & { readonly stop: AutoStop | null } {
  let stop: AutoStop | null = null;
  const result = play(seed, (state) => {
    const auto = autoCommands(state);
    stop = auto.stop;
    return stop ? null : auto.commands;
  });
  return { ...result, stop };
}
