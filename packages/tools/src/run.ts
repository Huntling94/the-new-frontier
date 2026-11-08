import {
  ISLAND_SCENARIO,
  RUNS,
  ZONES,
  TICK_RATE,
  autoCommands,
  botCommands,
  nextBotUpgrade,
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
  const units = state.bodies.map(({ health }) => health);
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

/** Which packs of the run's first zone have been cleared. A pack that comes back stays counted. */
function noteCleared(state: GameState, zoneId: string, cleared: Set<number>): void {
  const record = state.records.find(({ id }) => id === zoneId);
  for (const { packId } of record?.returns ?? []) {
    cleared.add(packId);
  }
}

/** Every pack of the zone has been cleared at least once, whatever has come back since. */
function allCleared(zoneId: string, cleared: ReadonlySet<number>): boolean {
  const packs = ZONES.find(({ id }) => id === zoneId)?.contents.packs ?? [];
  return packs.length > 0 && packs.every((_, packId) => cleared.has(packId));
}

/** What a run may change from the defaults. */
export interface PlayOptions {
  readonly tickLimit?: number;
  /** Whether the run counts as finished, with every pack cleared at least once. */
  readonly doneOnceCleared?: (state: GameState) => boolean;
}

/**
 * Plays until `next` says to stop or the run is finished, or stops as stalled at the
 * hard limit or when nothing moves (S3f decision 21).
 */
export function play(
  seed: number,
  next: (state: GameState) => readonly Command[] | null,
  { tickLimit = RUNS.tickLimit, doneOnceCleared = () => false }: PlayOptions = {},
): RunResult {
  const state = createGame(seed, ISLAND_SCENARIO);
  const tally = { wipes: 0, charactersDown: 0, revives: 0, interrupts: 0, upgrades: 0, refusals: 0 };
  let print = healthPrint(state);
  let quietSince = 0;
  let stalled = false;
  let finished = false;
  const cleared = new Set<number>();
  const { zoneId } = state;
  while (!finished && !stalled) {
    if (state.tick >= tickLimit) {
      stalled = true;
      break;
    }
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
    noteCleared(state, zoneId, cleared);
    finished = allCleared(zoneId, cleared) && doneOnceCleared(state);
    stalled = !finished && state.tick - quietSince > STALL_TICKS;
  }
  return {
    finished,
    stalled,
    ticks: state.tick,
    ...tally,
    levels: state.family.characters.map(({ level }) => level),
    marks: state.family.marks,
    potions: state.family.potions,
    monstersLeft: state.live.enemies.filter((enemy) => enemy.alive && !enemy.boss).length,
    hash: hashState(state),
  };
}

/** A bot finishes with every pack cleared at least once and its marks spent, as it upgrades today. */
export function runBot(seed: number, kind: BotKind, options: PlayOptions = {}): RunResult {
  return play(seed, (state) => botCommands(state, kind), {
    doneOnceCleared: (state) => nextBotUpgrade(state) === null,
    ...options,
  });
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
