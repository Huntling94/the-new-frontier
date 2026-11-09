import { describe, expect, it } from 'vitest';
import { MONSTER_RULES } from '../data/enemies';
import { GARGANTA_FALLS_ROUTE, GARGANTA_MAIN_ROUTE, GARGANTA_POCKET_ROUTE } from '../data/garganta';
import { ISLAND_SCENARIO, GARGANTA_SCENARIO } from '../data/scenarios';
import { createGame, step } from '../src/game';
import { isOpen, lineClear } from '../src/grid';
import type { GameEvent, GameState, PackData, Point, Scenario } from '../src/state';
import { gridOf, zoneData } from '../src/world';
import { TICKS } from '../src/time';
import { FIGHTER, HEALER, SNIPER } from './helpers';

const ALL = [FIGHTER, SNIPER, HEALER];
const GARGANTA = zoneData('garganta-da-cidadela');
const QUIET: Scenario = { ...GARGANTA_SCENARIO, contents: { dummy: null, packs: [], boss: null } };
const ROUTES: readonly (readonly Point[])[] = [GARGANTA_MAIN_ROUTE, GARGANTA_FALLS_ROUTE, GARGANTA_POCKET_ROUTE];
const SECOND = 30;

/** A small seeded generator, so a trip that fails can be run again by its number. */
function jitterFrom(seed: number): (most: number) => number {
  let value = seed * 2654435761;
  return (most) => {
    value = (Math.imul(value ^ (value >>> 15), 1 | value) + 0x6d2b79f5) | 0;
    return (((value ^ (value >>> 14)) >>> 0) / 4294967296) * 2 * most - most;
  };
}

function move(to: Point) {
  return { type: 'move' as const, unitIds: ALL, x: to.x, z: to.z, attack: false };
}

/** A point near this one that a character may stand on. */
function near(state: GameState, point: Point, jitter: (most: number) => number, most: number): Point {
  const moved = { x: point.x + jitter(most), z: point.z + jitter(most) };
  return isOpen(gridOf(state), moved.x, moved.z) ? moved : point;
}

/** Orders the squad to a point and steps until nobody has an order left. Returns any give-ups. */
function walk(state: GameState, to: Point, limit = 3000): GameEvent[] {
  const gaveUp: GameEvent[] = [];
  const note = (events: readonly GameEvent[]): void => {
    gaveUp.push(...events.filter(({ type }) => type === 'unit-gave-up'));
  };
  note(step(state, [move(to)]));
  for (let tick = 0; tick < limit && state.bodies.some(({ dest }) => dest !== null); tick += 1) {
    note(step(state, []));
  }
  return gaveUp;
}

function startAt(seed: number, at: Point): GameState {
  return createGame(seed, { ...QUIET, squadStart: at });
}

describe('walking Garganta da Cidadela with varied clicks (S3i)', () => {
  /** Each route each way, 26 times by a single long click and 26 times stop by stop: 312 trips. */
  const trips = ROUTES.flatMap((route) => [route, [...route].reverse()]).flatMap((route) =>
    Array.from({ length: 52 }, (_, trip) => ({ route, trip })),
  );

  it('has at least 300 trips', () => {
    expect(trips.length).toBeGreaterThanOrEqual(300);
  });

  it('sends every trip home with no character giving up', () => {
    const failures: string[] = [];
    trips.forEach(({ route, trip }, index) => {
      const jitter = jitterFrom(index + 1);
      const first = route[0] as Point;
      const state = startAt(index + 1, first);
      const stops = trip % 2 === 0 ? route.slice(1) : route.slice(-1);
      for (const stop of stops) {
        const gaveUp = walk(state, near(state, stop, jitter, 1.5));
        if (gaveUp.length > 0) failures.push(`trip ${String(index)} gave up near ${String(stop.x)}, ${String(stop.z)}`);
      }
    });
    expect(failures).toEqual([]);
  }, 120_000);

  it('gets every one of 150 varied trips past the rock tip at (-29, 49)', () => {
    let gaveUp = 0;
    for (let run = 0; run < 150; run += 1) {
      const jitter = jitterFrom(5000 + run);
      const state = startAt(run + 1, { x: -18, z: 66 });
      for (const stop of [{ x: -30, z: 58 }, { x: -34, z: 44 }, { x: -26, z: 30 }]) {
        gaveUp += walk(state, near(state, stop, jitter, 1.5)).length;
      }
    }
    expect(gaveUp).toBe(0);
  }, 60_000);
});

describe('the corner rule (S3i decision 1)', () => {
  it('keeps a near corner while the next leg is blocked from where the character stands', () => {
    const state = startAt(1, GARGANTA.camp);
    const unit = state.bodies[0];
    if (!unit) throw new Error('No body.');
    const corner = { x: -30.4, z: 52.3 };
    const after = { x: -26, z: 35 };
    unit.x = -30.5;
    unit.z = 52;
    const grid = gridOf(state);
    expect(Math.hypot(corner.x - unit.x, corner.z - unit.z)).toBeLessThan(0.6);
    expect(lineClear(grid, unit, after)).toBe(false);
    expect(lineClear(grid, corner, after)).toBe(false);
    unit.dest = after;
    unit.route = [corner, after];
    unit.routeGoal = after;
    step(state, []);
    expect(unit.route).toHaveLength(2);
    expect(unit.route[0]).toEqual(corner);
  });
});

describe('monsters in narrow ground (S3i decisions 3 to 5)', () => {
  /** Where the squad wakes each pack from, and three places round a bend that it then walks to. */
  const CHASES: readonly { readonly from: Point; readonly to: readonly Point[] }[] = [
    { from: { x: -7.5, z: 59.5 }, to: [{ x: -34, z: 40 }, { x: -17, z: 24 }, { x: -9, z: 0 }] },
    { from: { x: -35, z: 34 }, to: [{ x: -9, z: 0 }, { x: 0, z: 25 }, { x: 5, z: 87 }] },
    { from: { x: 30, z: 46 }, to: [{ x: 22, z: 18 }, { x: 6, z: 28 }, { x: 69, z: -36 }] },
    { from: { x: -11, z: -38 }, to: [{ x: -13, z: 18 }, { x: 0, z: 25 }, { x: -34, z: 40 }] },
  ];
  const cases = [1, 2].flatMap((seed) =>
    CHASES.flatMap(({ from, to }, pack) => to.map((end) => ({ seed, pack, from, end }))),
  );

  function chaseGame(seed: number, pack: number, from: Point): GameState {
    const data = GARGANTA.contents.packs[pack] as PackData;
    return createGame(seed, { ...GARGANTA_SCENARIO, squadStart: from, contents: { dummy: null, packs: [data], boss: null } });
  }

  /** Nobody dies, so the chase is what is on trial. */
  function keepAlive(state: GameState): void {
    for (const body of state.bodies) body.health = body.maxHealth;
    for (const enemy of state.live.enemies) enemy.health = enemy.maxHealth;
  }

  it('has the 24 chases', () => {
    expect(cases).toHaveLength(24);
  });

  it.each(cases)('keeps every awake monster moving: seed $seed, pack $pack, to $end.x, $end.z', ({ seed, pack, from, end }) => {
    const state = chaseGame(seed, pack, from);
    for (let tick = 0; tick < 45; tick += 1) {
      keepAlive(state);
      step(state, []);
    }
    step(state, [move(end)]);
    const last = new Map<number, Point>();
    const stillFor = new Map<number, number>();
    let longest = 0;
    for (let tick = 1; tick <= 750; tick += 1) {
      keepAlive(state);
      step(state, []);
      if (tick % SECOND !== 0) continue;
      for (const enemy of state.live.enemies.filter(({ alive, awake }) => alive && awake)) {
        const gap = Math.min(...state.bodies.map(({ x, z }) => Math.hypot(x - enemy.x, z - enemy.z)));
        const before = last.get(enemy.id);
        const still = before !== undefined && Math.hypot(before.x - enemy.x, before.z - enemy.z) < 0.5 && gap > enemy.reach + MONSTER_RULES.startStrikeExtra;
        const seconds = still ? (stillFor.get(enemy.id) ?? 0) + 1 : 0;
        stillFor.set(enemy.id, seconds);
        longest = Math.max(longest, seconds);
        last.set(enemy.id, { x: enemy.x, z: enemy.z });
      }
    }
    expect(longest).toBeLessThanOrEqual(3);
  });

  it('finds a route no more than twice a second, whichever way the squad runs', () => {
    const state = chaseGame(1, 0, CHASES[0]?.from as Point);
    for (let tick = 0; tick < 45; tick += 1) {
      keepAlive(state);
      step(state, []);
    }
    const lastSearch = new Map<number, number>();
    const seen = new Map<number, Point | null>(state.live.enemies.map(({ id, routeGoal }) => [id, routeGoal]));
    let routes = 0;
    for (let tick = 0; tick < 600; tick += 1) {
      keepAlive(state);
      if (tick % 20 === 0) step(state, [move(tick % 40 === 0 ? { x: -34, z: 40 } : { x: -9, z: 0 })]);
      else step(state, []);
      for (const enemy of state.live.enemies) {
        const before = seen.get(enemy.id) ?? null;
        // A new routeGoal object means a new search; the end of a kept route follows without one.
        if (enemy.routeGoal && enemy.routeGoal !== before) {
          const previous = lastSearch.get(enemy.id);
          if (previous !== undefined) expect(tick - previous).toBeGreaterThanOrEqual(TICKS.monsterRouteSearch);
          lastSearch.set(enemy.id, tick);
          routes += 1;
        }
        seen.set(enemy.id, enemy.routeGoal);
      }
    }
    expect(routes).toBeGreaterThan(0);
  });

  it('takes no route with a clear straight line', () => {
    const pack: PackData = { x: 0, z: 0, spread: 0, level: 1, mobs: [{ kind: 'boar', count: 1 }] };
    const state = createGame(1, { ...ISLAND_SCENARIO, squadStart: { x: 0, z: 12 }, contents: { dummy: null, packs: [pack], boss: null, obstacles: [] } });
    for (let tick = 0; tick < 45; tick += 1) {
      step(state, []);
      expect(state.live.enemies[0]?.route).toEqual([]);
    }
    expect(state.live.enemies[0]?.awake).toBe(true);
  });

  it('takes no route for a stone alone, which it slides round', () => {
    const pack: PackData = { x: 0, z: 0, spread: 0, level: 1, mobs: [{ kind: 'boar', count: 1 }] };
    const obstacles = [{ kind: 'stone' as const, x: 0, z: 6, radius: 2 }];
    const state = createGame(1, { ...ISLAND_SCENARIO, squadStart: { x: 0, z: 13 }, contents: { dummy: null, packs: [pack], boss: null, obstacles } });
    const enemy = state.live.enemies[0];
    if (!enemy) throw new Error('No enemy.');
    expect(lineClear(gridOf(state), enemy, { x: 0, z: 13 })).toBe(false);
    for (let tick = 0; tick < 45; tick += 1) {
      step(state, []);
      expect(enemy.route).toEqual([]);
    }
    expect(enemy.awake).toBe(true);
  });

  it('routes round rock when a straight line is blocked', () => {
    const state = chaseGame(1, 0, CHASES[0]?.from as Point);
    for (let tick = 0; tick < 45; tick += 1) {
      keepAlive(state);
      step(state, []);
    }
    step(state, [move({ x: -34, z: 40 })]);
    let routed = false;
    for (let tick = 0; tick < 300 && !routed; tick += 1) {
      keepAlive(state);
      step(state, []);
      routed = state.live.enemies.some(({ route }) => route.length > 0);
    }
    expect(routed).toBe(true);
  });
});
