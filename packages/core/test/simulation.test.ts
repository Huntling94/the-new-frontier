import { describe, expect, it } from 'vitest';
import { GENERATOR, STATE_HASH } from '../data/sim';
import { SCATTER } from '../data/movement';
import { EMPTY_SCENARIO } from '../data/scenarios';
import { advance, createGame, step } from '../src/game';
import { hashState } from '../src/hash';
import { nextRandom, randomBetween } from '../src/random';
import { runReplay } from '../src/replay';
import type { GameView, Replay } from '../src/state';
import { TICKS, perTick, secondsToTicks } from '../src/time';

describe('seeded generator', () => {
  it('repeats exactly from the same seed', () => {
    const first = { rng: 7 };
    const second = { rng: 7 };
    const values = Array.from({ length: 50 }, () => nextRandom(first));
    expect(Array.from({ length: 50 }, () => nextRandom(second))).toEqual(values);
    expect(first.rng).toBe(second.rng);
  });

  it('matches the published generator', () => {
    // Values from the published mulberry32, seeded with 1.
    const generator = { rng: 1 };
    expect(nextRandom(generator)).toBeCloseTo(0.6270739405881613, 12);
    expect(nextRandom(generator)).toBeCloseTo(0.002735721180215478, 12);
    expect(nextRandom(generator)).toBeCloseTo(0.5274470399599522, 12);
    expect(GENERATOR.range).toBe(2 ** 32);
  });

  it('gives different values from a different seed', () => {
    expect(nextRandom({ rng: 1 })).not.toBe(nextRandom({ rng: 2 }));
  });

  it('stays in range and spreads evenly', () => {
    const generator = { rng: 99 };
    const values = Array.from({ length: 10000 }, () => nextRandom(generator));
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    expect(mean).toBeCloseTo(0.5, 1);
    const between = randomBetween(generator, 10, 12);
    expect(between).toBeGreaterThanOrEqual(10);
    expect(between).toBeLessThan(12);
  });
});

describe('ticks and rounding', () => {
  it('rounds seconds up to whole ticks', () => {
    expect(secondsToTicks(0.3)).toBe(9);
    expect(secondsToTicks(0.45)).toBe(14);
    expect(secondsToTicks(0.01)).toBe(1);
    expect(secondsToTicks(0)).toBe(0);
  });

  it('does not round an exact tick count up because of floating-point error', () => {
    // 8.3 × 30 is a hair over 249 in floating point.
    expect(8.3 * 30).toBeGreaterThan(249);
    expect(secondsToTicks(8.3)).toBe(249);
  });

  it('converts each timing once', () => {
    expect(TICKS).toEqual({ giveUp: 21, scatterCooldown: 150, dash: 9, invulnerable: 14 });
  });

  it('divides per-second values by the tick rate', () => {
    expect(perTick(30)).toBe(1);
    expect(perTick(SCATTER.dashSpeed)).toBeCloseTo(32 / 30, 12);
  });

  it('counts ticks whatever the commands', () => {
    const game = createGame(1, EMPTY_SCENARIO);
    advance(game);
    step(game, [{ type: 'regroup' }]);
    expect(game.tick).toBe(2);
  });
});

describe('state hash', () => {
  const game = (): ReturnType<typeof createGame> => createGame(5, EMPTY_SCENARIO);

  it('ignores the order of object keys', () => {
    const state = game();
    const reordered = Object.fromEntries(Object.entries(state).reverse()) as typeof state;
    expect(hashState(reordered)).toBe(hashState(state));
  });

  it('covers the tick and the generator', () => {
    const base = hashState(game());
    expect(hashState({ ...game(), tick: 1 })).not.toBe(base);
    expect(hashState({ ...game(), rng: 1 })).not.toBe(base);
  });

  it('is a fixed-width hex string', () => {
    expect(hashState(game())).toMatch(new RegExp(`^[0-9a-f]{${String(STATE_HASH.width)}}$`));
  });

  it.each([NaN, Infinity, -Infinity])('rejects a number that is not finite: %s', (value) => {
    const state = game();
    const [unit] = state.units;
    if (!unit) throw new Error('No units.');
    unit.x = value;
    expect(() => hashState(state)).toThrow('not finite');
  });

  it('rejects a value that is not plain data', () => {
    expect(() => hashState({ ...game(), heading: undefined } as unknown as GameView)).toThrow(
      'not plain data',
    );
  });
});

describe('runReplay checks', () => {
  const base: Replay = {
    seed: 1,
    scenario: EMPTY_SCENARIO,
    ticks: 10,
    entries: [],
    expectedHash: '',
  };

  it('plays each entry on its tick', () => {
    const { state, events } = runReplay({
      ...base,
      entries: [
        { tick: 0, commands: [{ type: 'scatter' }] },
        { tick: 9, commands: [{ type: 'regroup' }] },
      ],
    });
    expect(state.tick).toBe(10);
    expect(events.filter((event) => event.type === 'order-accepted')).toEqual([
      { type: 'order-accepted', tick: 0, order: 'scatter' },
      { type: 'order-accepted', tick: 9, order: 'regroup' },
    ]);
  });

  it('rejects entries out of order', () => {
    const entries = [
      { tick: 5, commands: [] },
      { tick: 4, commands: [] },
    ];
    expect(() => runReplay({ ...base, entries })).toThrow('out of order');
  });

  it('rejects two entries on one tick', () => {
    const entries = [
      { tick: 5, commands: [] },
      { tick: 5, commands: [] },
    ];
    expect(() => runReplay({ ...base, entries })).toThrow('out of order');
  });

  it('rejects an entry before the start or between ticks', () => {
    expect(() => runReplay({ ...base, entries: [{ tick: -1, commands: [] }] })).toThrow('out of order');
    expect(() => runReplay({ ...base, entries: [{ tick: 1.5, commands: [] }] })).toThrow('out of order');
  });

  it('rejects an entry past the end', () => {
    expect(() => runReplay({ ...base, entries: [{ tick: 10, commands: [] }] })).toThrow('past the end');
  });
});

describe('read-only view', () => {
  it('stops outside code changing state through a GameView', () => {
    const view: GameView = createGame(1, EMPTY_SCENARIO);
    // @ts-expect-error A view is read-only.
    expect(() => void (view.units[0].x = 1)).not.toThrow();
  });
});
