import { ISLAND_SCENARIO, RUNS, botCommands, createGame, hashState, step } from '@new-frontier/core';
import type { BotKind, GameState } from '@new-frontier/core';
import { describe, expect, it } from 'vitest';
import { play, runAuto, runBot } from '../src/run';

const BOTS: readonly BotKind[] = ['careful', 'sloppy'];
const FIVE_SEEDS = [1, 2, 3, 4, 5];
const STALL_SEEDS = Array.from({ length: 100 }, (_, index) => index + 1);
const SLOW = 60_000;

describe('full runs', () => {
  it(
    'calls a game where nothing happens a stall',
    () => {
      const result = play(1, () => []);
      expect(result.stalled).toBe(true);
      expect(result.finished).toBe(false);
      expect(result.ticks).toBeLessThan(RUNS.tickLimit);
    },
    SLOW,
  );

  describe.each(BOTS)('the %s bot', (kind) => {
    it.each(FIVE_SEEDS)(
      'kills the boss on seed %s, inside the limit, with no refused orders',
      (seed) => {
        const result = runBot(seed, kind);
        expect(result.finished).toBe(true);
        expect(result.stalled).toBe(false);
        expect(result.refusals).toBe(0);
      },
      SLOW,
    );

    it(
      'walks to the anvil, and so upgrades through commands',
      () => {
        expect(runBot(1, kind).upgrades).toBeGreaterThan(0);
      },
      SLOW,
    );

    it(
      'ends on the same hash twice',
      () => {
        expect(runBot(7, kind).hash).toBe(runBot(7, kind).hash);
      },
      SLOW,
    );
  });

  it(
    'differs by seed and by bot',
    () => {
      expect(runBot(1, 'careful').hash).not.toBe(runBot(2, 'careful').hash);
      expect(runBot(1, 'careful').hash).not.toBe(runBot(1, 'sloppy').hash);
    },
    SLOW,
  );

  it(
    'interrupts only with the careful bot',
    () => {
      expect(runBot(1, 'careful').interrupts).toBeGreaterThan(0);
      expect(runBot(1, 'sloppy').interrupts).toBe(0);
    },
    SLOW,
  );

  it(
    'auto-combat clears the island or stops for a reason on all 100 seeds, and never stalls',
    () => {
      const results = STALL_SEEDS.map((seed) => ({ seed, ...runAuto(seed) }));
      expect(results.filter(({ stalled }) => stalled).map(({ seed }) => seed)).toEqual([]);
      expect(results.filter(({ stop }) => stop === null).map(({ seed }) => seed)).toEqual([]);
    },
    SLOW,
  );

  it.each([
    ['a telegraph on the ground', (state: GameState) => state.live.scheduled.length > 0],
    ['a minion about', (state: GameState) => state.live.enemies.some(({ minion }) => minion)],
    ['a monster shot and a drop', (state: GameState) => state.live.enemyShots.length * state.live.drops.length > 0],
  ])(
    'plays on identically from a save with %s',
    (_, busy) => {
      const game = createGame(1, ISLAND_SCENARIO);
      while (!busy(game) && !game.victory) {
        step(game, botCommands(game, 'careful'));
      }
      expect(busy(game)).toBe(true);
      const saved = JSON.stringify(game);
      const loaded = JSON.parse(saved) as GameState;
      expect(JSON.stringify(loaded)).toBe(saved);
      for (let tick = 0; tick < 1200 && !game.victory; tick += 1) {
        step(game, botCommands(game, 'careful'));
        step(loaded, botCommands(loaded, 'careful'));
      }
      expect(hashState(loaded)).toBe(hashState(game));
    },
    SLOW,
  );
});
