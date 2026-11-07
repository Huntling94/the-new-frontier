import { describe, expect, it } from 'vitest';
import { REPLAYS } from '../data/replays';
import { SPELLS } from '../data/spells';
import { DUMMY_SCENARIO, EMPTY_SCENARIO } from '../data/scenarios';
import { createGame, step } from '../src/game';
import { hashState } from '../src/hash';
import { runReplay } from '../src/replay';
import type { Command, GameState, Replay } from '../src/state';

function commandsAt(replay: Replay, tick: number): readonly Command[] {
  return replay.entries.find((entry) => entry.tick === tick)?.commands ?? [];
}

function playTo(state: GameState, replay: Replay, endTick: number): void {
  while (state.tick < endTick) {
    step(state, commandsAt(replay, state.tick));
  }
}

const replays = Object.entries(REPLAYS);

describe.each(replays)('replay: %s', (_name, replay) => {
  it('ends on its expected hash', () => {
    const hash = hashState(runReplay(replay).state);
    // Changing rules or data changes this hash. Updating it is a deliberate edit,
    // and the commit says why.
    expect(hash, `The replay now ends on ${hash}.`).toBe(replay.expectedHash);
  });

  it('has no refused orders', () => {
    const { events } = runReplay(replay);
    expect(events.filter((event) => event.type === 'order-refused')).toEqual([]);
  });

  it('gives the same hash twice, and a different one from another seed', () => {
    const first = hashState(runReplay(replay).state);
    expect(hashState(runReplay(replay).state)).toBe(first);
    expect(hashState(runReplay({ ...replay, seed: replay.seed + 1 }).state)).not.toBe(first);
  });

  it('matches runReplay when stepped by hand', () => {
    const game = createGame(replay.seed, replay.scenario);
    playTo(game, replay, replay.ticks);
    expect(hashState(game)).toBe(hashState(runReplay(replay).state));
  });

  it('keeps state as plain data that survives JSON', () => {
    const { state } = runReplay(replay);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it.each([0.25, 0.5, 0.75])('saves part-way and finishes the same, at %s of the run', (share) => {
    const saveTick = Math.floor(replay.ticks * share);
    const game = createGame(replay.seed, replay.scenario);
    playTo(game, replay, saveTick);
    const saved = JSON.stringify(game);

    // Another game runs in between, with its own orders. Anything kept outside
    // state would be overwritten here.
    const other = createGame(replay.seed + 99, EMPTY_SCENARIO);
    step(other, [{ type: 'move', unitIds: [1, 2, 3], x: 40, z: -20, attack: true }]);
    step(other, [{ type: 'move', unitIds: [2], x: -50, z: 0, attack: false }]);
    for (let tick = 0; tick < 60; tick += 1) {
      step(other, tick === 30 ? [{ type: 'scatter' }] : []);
    }

    const loaded = JSON.parse(saved) as GameState;
    playTo(loaded, replay, replay.ticks);
    expect(hashState(loaded)).toBe(hashState(runReplay(replay).state));
  });
});

describe('the spell tour', () => {
  const replay = REPLAYS['spell tour'];
  if (!replay) throw new Error('No spell tour.');
  const { events, state } = runReplay(replay);

  it('fires all nine spells', () => {
    const cast = events.flatMap((event) => (event.type === 'spell-cast' ? [event.spell] : []));
    expect([...cast].sort()).toEqual(Object.keys(SPELLS).sort());
  });

  it('fights the dummy, and is hurt by it', () => {
    const hits = events.filter((event) => event.type === 'hit');
    expect(hits.some((hit) => hit.targetId === 4)).toBe(true);
    expect(hits.some((hit) => hit.sourceId === 4)).toBe(true);
  });

  it('heals, drinks and upgrades', () => {
    const types = events.map((event) => event.type);
    expect(types).toContain('healed');
    expect(types).toContain('upgraded');
    expect(state.potions).toBe(5);
    expect(state.marks).toBe(380);
  });

  it('reaches Revive by leaving the Fighter to fall, with room to spare', () => {
    const fell = events.find((event) => event.type === 'unit-down');
    const raised = events.find((event) => event.type === 'unit-revived');
    if (!fell || !raised) throw new Error('The Fighter never fell or rose.');
    expect('unitId' in fell && fell.unitId).toBe(1);
    expect(raised.tick - fell.tick).toBeGreaterThan(150);
  });

  it('kills the dummy, and it respawns', () => {
    expect(events.some((event) => event.type === 'enemy-down')).toBe(true);
    expect(state.live.enemies[0]?.alive).toBe(true);
  });

  it.each([332, 392])('saves with shots or strikes in the air, at tick %s', (saveTick) => {
    const game = createGame(replay.seed, replay.scenario);
    playTo(game, replay, saveTick);
    expect(game.live.shots.length + game.live.scheduled.length).toBeGreaterThan(0);
    const saved = JSON.stringify(game);

    const other = createGame(replay.seed + 99, DUMMY_SCENARIO);
    step(other, [{ type: 'move', unitIds: [1, 2, 3], x: 0, z: 34, attack: true }]);
    for (let tick = 0; tick < 150; tick += 1) {
      step(other, tick === 140 ? [{ type: 'cast', unitId: 2, spell: 'volley' }] : []);
    }

    const loaded = JSON.parse(saved) as GameState;
    playTo(loaded, replay, replay.ticks);
    expect(hashState(loaded)).toBe(hashState(state));
  });
});

describe('the squad tour', () => {
  it('shows what the brief asks for', () => {
    const replay = REPLAYS['squad tour'];
    if (!replay) throw new Error('No squad tour.');
    const orders = replay.entries.flatMap((entry) => entry.commands.map((command) => command.type));
    expect(orders).toContain('move');
    expect(orders).toContain('regroup');
    expect(orders).toContain('scatter');
    const { events } = runReplay(replay);
    expect(events.filter((event) => event.type === 'unit-arrived').length).toBeGreaterThan(0);
  });
});
