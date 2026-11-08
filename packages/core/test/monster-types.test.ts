import { describe, expect, it } from 'vitest';
import { MONSTERS, MONSTER_RULES } from '../data/enemies';
import { EMPTY_SCENARIO, ISLAND_SCENARIO } from '../data/scenarios';
import { ZONES } from '../data/zones';
import { createGame, step } from '../src/game';
import type { Body, Enemy, GameState, MonsterKind, Obstacle, PackData } from '../src/state';
import { secondsToTicks } from '../src/time';
import { isWalkableForEnemy } from '../src/world';
import { recordOf } from '../src/zones';
import { ofType } from './helpers';

const POINT = { x: 0, z: 30 };

function packGame(mobs: PackData['mobs'], obstacles: readonly Obstacle[] = []): GameState {
  const packs = [{ ...POINT, level: 3, mobs }];
  return createGame(1, { ...EMPTY_SCENARIO, contents: { dummy: null, boss: null, packs, obstacles } });
}

describe('the sheet (D-049, D-056)', () => {
  it.each(Object.keys(MONSTERS) as MonsterKind[])('%s carries a full sheet, with evade, block and resistances at 0', (kind) => {
    const state = packGame([{ kind, count: 1 }]);
    const [enemy] = state.live.enemies as [Enemy];
    expect(enemy.attackSeconds).toBe(MONSTERS[kind].attackSeconds);
    expect(enemy).toMatchObject({ crit: 0, evade: 0, block: 0, resistances: { fire: 0, ice: 0, lightning: 0, mental: 0 } });
  });

  it('a character carries the same sheet, with its attack speed from its weapon', () => {
    const [body] = createGame(1, EMPTY_SCENARIO).bodies as [Body];
    expect(body.attackSeconds).toBeGreaterThan(0);
    expect(body).toMatchObject({ evade: 0, block: 0, resistances: { fire: 0, ice: 0, lightning: 0, mental: 0 } });
  });
});

describe('attack speed by monster (S3f decision 5)', () => {
  it.each([
    ['wasp', 1.1],
    ['rooster', 1.4],
    ['viper', 1.6],
    ['boar', 1.8],
  ] as const)('a %s waits %s seconds after a strike', (kind, seconds) => {
    const state = packGame([{ kind, count: 1 }]);
    const [enemy] = state.live.enemies as [Enemy];
    enemy.awake = true;
    enemy.windTicks = 1;
    step(state, []);
    expect(enemy.strikeTicks).toBe(secondsToTicks(seconds));
  });
});

describe('the Lande has no boss and no ending (D-052)', () => {
  it('holds no boss in play', () => {
    const lande = ZONES.find(({ id }) => id === 'lande');
    expect(lande?.contents.boss).toBeNull();
    expect(createGame(1, ISLAND_SCENARIO).live.enemies.some(({ boss }) => boss)).toBe(false);
  });

  it('carries on when it is clear, and its packs come back', () => {
    const state = createGame(1, ISLAND_SCENARIO);
    state.live.enemies = [];
    recordOf(state).returns.push({ packId: 0, tick: state.tick + 2 });
    const refused = ofType(step(state, [{ type: 'regroup' }]), 'order-refused');
    expect(refused).toEqual([]);
    step(state, []);
    step(state, []);
    expect(state.live.enemies.length).toBeGreaterThan(0);
  });
});

describe('a pack coming back (S3f decision 20)', () => {
  const { respawnClearance } = MONSTER_RULES;

  function returned(obstacles: readonly Obstacle[] = []): GameState {
    const state = packGame([{ kind: 'wasp', count: 6 }], obstacles);
    state.live.enemies = [];
    recordOf(state).returns = [{ packId: 0, tick: state.tick }];
    for (const body of state.bodies) {
      body.x = POINT.x;
      body.z = POINT.z;
    }
    step(state, []);
    return state;
  }

  it('lands no monster within the clearance of the squad, and on walkable ground', () => {
    const state = returned();
    expect(state.live.enemies).toHaveLength(6);
    for (const { homeX, homeZ } of state.live.enemies) {
      for (const { x, z } of state.bodies) {
        expect(Math.hypot(homeX - x, homeZ - z)).toBeGreaterThanOrEqual(respawnClearance);
      }
      expect(isWalkableForEnemy(state, homeX, homeZ)).toBe(true);
    }
  });

  it('moves a monster off ground it cannot stand on', () => {
    const state = returned([{ kind: 'stone', ...POINT, radius: 10 }]);
    for (const { homeX, homeZ } of state.live.enemies) {
      expect(isWalkableForEnemy(state, homeX, homeZ)).toBe(true);
    }
  });
});
