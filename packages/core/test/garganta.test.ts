import { describe, expect, it } from 'vitest';
import { MONSTER_RULES, MONSTERS } from '../data/enemies';
import {
  GARGANTA_BLOCKED,
  GARGANTA_CAMP,
  GARGANTA_FALLS_ROUTE,
  GARGANTA_MAIN_ROUTE,
  GARGANTA_OUTLINE,
  GARGANTA_POCKET_ROUTE,
} from '../data/garganta';
import { GARGANTA_SCENARIO, ISLAND_SCENARIO } from '../data/scenarios';
import { START_ZONE, ZONES } from '../data/zones';
import { badGates, badPlacements, unreachableZones } from '../src/checks';
import { createPack } from '../src/enemies';
import { createGame, step } from '../src/game';
import { canReach, isOpen, isOpenForEnemy } from '../src/grid';
import { fromSave, toSave } from '../src/save';
import type { GameEvent, GameState, PackData, Point, Scenario } from '../src/state';
import { gridFor, zoneData, type Ground } from '../src/world';
import { crossGate } from '../src/zones';
import { FIGHTER, HEALER, SNIPER } from './helpers';

const ALL = [FIGHTER, SNIPER, HEALER];
const GARGANTA = zoneData('garganta-da-cidadela');
const COLOSSE = zoneData('carrefour-du-colosse');
const INTO = COLOSSE.gates.find(({ to }) => to === GARGANTA.id);
const OUT = GARGANTA.gates.find(({ to }) => to === COLOSSE.id);
if (!INTO || !OUT) throw new Error('Carrefour du Colosse and Garganta da Cidadela need a gate to each other.');
const GROUND = GARGANTA.ground as Extract<Ground, { shape: 'basin' }>;
const NOTHING = { dummy: null, packs: [], boss: null };
const QUIET: Scenario = { ...GARGANTA_SCENARIO, contents: NOTHING };

const last = (points: readonly Point[]): Point => points[points.length - 1] as Point;
const CITADEL_DOOR = last(GARGANTA_MAIN_ROUTE);
const FALLS_END = last(GARGANTA_FALLS_ROUTE);
const POCKET = last(GARGANTA_POCKET_ROUTE);
/** Just above the sliver, where the corridor joins, and one point beside the sliver on each side. */
const JUNCTION = GARGANTA_FALLS_ROUTE[0] as Point;
const WEST_OF_SLIVER = { x: -13, z: 15 };
const EAST_OF_SLIVER = { x: -3, z: 16 };
const SQUAD_SPEED_FLOOR = 8;

function move(x: number, z: number) {
  return { type: 'move' as const, unitIds: ALL, x, z, attack: false };
}

/** Orders the squad to a point and steps until every character has arrived, or the limit passes. */
function walk(state: GameState, to: Point, limit = 3000): GameEvent[] {
  const events = step(state, [move(to.x, to.z)]);
  const arrived = new Set<number>();
  for (let tick = 0; tick < limit && arrived.size < ALL.length; tick += 1) {
    for (const event of step(state, [])) {
      events.push(event);
      if (event.type === 'unit-arrived') arrived.add(event.unitId);
      if (event.type === 'zone-changed') return events;
    }
  }
  return events;
}

function expectArrival(events: readonly GameEvent[], label: string): void {
  expect(events.filter(({ type }) => type === 'unit-gave-up'), label).toEqual([]);
  expect(events.filter(({ type }) => type === 'unit-arrived').length, label).toBeGreaterThanOrEqual(ALL.length);
}

function segmentDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const share = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(p.x - a.x - share * dx, p.z - a.z - share * dz);
}

/** The closest two lines of points come: the width of the gap between them, in any direction. */
function gapBetween(one: readonly Point[], two: readonly Point[]): number {
  let least = Infinity;
  for (let i = 0; i + 1 < one.length; i += 1) {
    const a = one[i] as Point;
    const b = one[i + 1] as Point;
    for (let j = 0; j + 1 < two.length; j += 1) {
      const c = two[j] as Point;
      const d = two[j + 1] as Point;
      least = Math.min(least, segmentDistance(a, c, d), segmentDistance(b, c, d), segmentDistance(c, a, b), segmentDistance(d, a, b));
    }
  }
  return least;
}

/** Part of the outline, between two of its points, as listed. */
function edge(from: Point, to: Point): readonly Point[] {
  const at = ({ x, z }: Point): number => GARGANTA_OUTLINE.findIndex((point) => point.x === x && point.z === z);
  expect(at(from)).toBeGreaterThanOrEqual(0);
  expect(at(to)).toBeGreaterThan(at(from));
  return GARGANTA_OUTLINE.slice(at(from), at(to) + 1);
}

function rock(id: string): readonly Point[] {
  const outline = GARGANTA_BLOCKED.find((place) => place.id === id)?.outline ?? [];
  return [...outline, outline[0] as Point];
}

const STRETCHES: readonly { readonly name: string; readonly one: readonly Point[]; readonly two: readonly Point[] }[] = [
  { name: 'south canyon', one: edge({ x: -16.5, z: 72.5 }, { x: -0.5, z: 104 }), two: edge({ x: 11.5, z: 104 }, { x: -9.5, z: 61.5 }) },
  { name: 'corridor', one: edge({ x: -20, z: -34.5 }, { x: -13.5, z: 7 }), two: edge({ x: -1, z: 4 }, { x: 0, z: -43.5 }) },
  { name: 'west arm', one: edge({ x: -33, z: 28.5 }, { x: -32, z: 63.5 }), two: edge({ x: -23, z: 55.5 }, { x: -27.5, z: 41 }) },
  { name: 'causeway', one: edge({ x: -16, z: -95 }, { x: -16, z: -60.5 }), two: edge({ x: -6, z: -60.5 }, { x: -6, z: -95 }) },
  { name: 'below the pillars', one: edge({ x: 20.5, z: 51.5 }, { x: 50, z: 50.5 }), two: rock('large-pillar') },
  { name: 'east spur', one: edge({ x: 54.5, z: 7 }, { x: 73, z: -18.5 }), two: edge({ x: 61.5, z: -32.5 }, { x: 46, z: -1 }) },
  { name: 'north of the rock island', one: edge({ x: -15.5, z: 18.5 }, { x: -21.5, z: 23 }), two: rock('rock-island') },
  { name: 'east of the sliver', one: rock('sliver'), two: edge({ x: 9, z: 11.5 }, { x: -1, z: 4 }) },
  { name: 'west of the sliver', one: edge({ x: -13.5, z: 7 }, { x: -21.5, z: 23 }), two: rock('sliver') },
  { name: 'beside the left pillar', one: edge({ x: 4, z: 35 }, { x: 20.5, z: 51.5 }), two: rock('left-pillar') },
  { name: 'between the pillars', one: rock('left-pillar'), two: rock('large-pillar') },
];

describe('Garganta da Cidadela (M2)', () => {
  it('is a field of the basin kind, with four packs of levels 11 to 14 and no boss', () => {
    expect(GARGANTA.kind).toBe('field');
    expect(GROUND.shape).toBe('basin');
    expect(GARGANTA.contents.boss).toBeNull();
    expect(GARGANTA.contents.packs.map(({ level }) => level)).toEqual([11, 12, 13, 14]);
    expect(GARGANTA.packRespawnSeconds).toBe(180);
    for (const { mobs } of GARGANTA.contents.packs) {
      for (const { kind } of mobs) expect(Object.keys(MONSTERS)).toContain(kind);
    }
    for (const { x, z } of GARGANTA_OUTLINE) {
      expect(Math.abs(x)).toBeLessThanOrEqual(120);
      expect(Math.abs(z)).toBeLessThanOrEqual(120);
    }
  });

  it('passes the world data checks, and can be reached both ways', () => {
    expect(unreachableZones(ZONES, START_ZONE)).toEqual([]);
    expect(unreachableZones(ZONES, GARGANTA.id)).toEqual([]);
    expect(badGates(ZONES)).toEqual([]);
    expect(badPlacements(ZONES)).toEqual([]);
    expect(isOpen(gridFor(GARGANTA), INTO.arrival.x, INTO.arrival.z)).toBe(true);
    expect(isOpen(gridFor(COLOSSE), OUT.arrival.x, OUT.arrival.z)).toBe(true);
    expect([...INTO.requires, ...INTO.cost, ...OUT.requires, ...OUT.cost]).toEqual([]);
  });

  it('has one gate, at the south end: the citadel door and the falls end are closed by look only', () => {
    expect(GARGANTA.gates.map(({ id }) => id)).toEqual(['garganta-to-colosse']);
    expect(OUT.area).toEqual({ x: 6, z: 101, radius: 3 });
    expect(Math.hypot(OUT.area.x - CITADEL_DOOR.x, OUT.area.z - CITADEL_DOOR.z)).toBeGreaterThan(200);
    expect(Math.hypot(OUT.area.x - FALLS_END.x, OUT.area.z - FALLS_END.z)).toBeGreaterThan(100);
  });

  it('closes the sliver, the rock island and the pillars', () => {
    const grid = gridFor(GARGANTA);
    for (const { id, outline } of GARGANTA_BLOCKED) {
      const x = outline.reduce((sum, point) => sum + point.x, 0) / outline.length;
      const z = outline.reduce((sum, point) => sum + point.z, 0) / outline.length;
      expect(isOpen(grid, x, z), id).toBe(false);
      // Halfway to each corner: a cell is judged at its centre, so a sharp tip may fall in an open cell.
      for (const point of outline) expect(isOpen(grid, (x + point.x) / 2, (z + point.z) / 2), `${id} inside`).toBe(false);
    }
  });

  it('closes the lake and the fortress walls, which are look only beyond the outline', () => {
    const grid = gridFor(GARGANTA);
    const lake = [{ x: -30, z: -80 }, { x: -40, z: -75 }, { x: 10, z: -85 }, { x: 18, z: -72 }, { x: 0, z: -70 }];
    const walls = [{ x: -60, z: -90 }, { x: -40, z: -108 }, { x: 25, z: -100 }, { x: 40, z: -85 }, { x: -24, z: -112 }, { x: 5, z: -112 }];
    for (const point of [...lake, ...walls]) expect(isOpen(grid, point.x, point.z), `${String(point.x)}, ${String(point.z)}`).toBe(false);
  });

  it('is one connected area, with every route point, pack and the camp walkable and reachable from the south gate', () => {
    const grid = gridFor(GARGANTA);
    const places: Point[] = [GARGANTA.camp, ...GARGANTA_MAIN_ROUTE, ...GARGANTA_FALLS_ROUTE, ...GARGANTA_POCKET_ROUTE, ...GARGANTA.contents.packs];
    for (const place of places) {
      expect(isOpen(grid, place.x, place.z), `${String(place.x)}, ${String(place.z)} walkable`).toBe(true);
      expect(canReach(grid, GARGANTA_CAMP, place), `${String(place.x)}, ${String(place.z)} reachable`).toBe(true);
    }
    const areas = new Map<number, number>();
    for (let index = 0; index < grid.flags.length; index += 1) {
      const area = grid.areas[index] ?? -1;
      if (area >= 0) areas.set(area, (areas.get(area) ?? 0) + 1);
    }
    const sizes = [...areas.values()].sort((a, b) => b - a);
    expect(sizes[0]).toBeGreaterThan(4500);
    expect(sizes[0]).toBeLessThan(6500);
    expect(sizes.slice(1).every((size) => size < 30)).toBe(true);
  });

  it.each(STRETCHES)('keeps $name at least 4 wide, as the shapes measure, in any direction (decision 4)', ({ one, two }) => {
    expect(gapBetween(one, two)).toBeGreaterThanOrEqual(4);
  });

  it('lands every monster of every pack on walkable ground, wherever in its square it lands', () => {
    const grid = gridFor(GARGANTA);
    GARGANTA.contents.packs.forEach((pack, index) => {
      const spread = pack.spread ?? MONSTER_RULES.spread;
      for (let dz = -spread; dz <= spread; dz += 0.25) {
        for (let dx = -spread; dx <= spread; dx += 0.25) {
          expect(isOpenForEnemy(grid, pack.x + dx, pack.z + dz), `pack ${String(index)} at ${String(dx)}, ${String(dz)}`).toBe(true);
        }
      }
    });
  });

  it('does not wake a pack on arrival at the south gate', () => {
    const state = createGame(1, GARGANTA_SCENARIO);
    for (let tick = 0; tick < 30; tick += 1) step(state, []);
    expect(state.live.enemies.filter(({ awake }) => awake)).toEqual([]);
  });

  it.each([
    ['the citadel door', CITADEL_DOOR],
    ['the falls end', FALLS_END],
    ['the pocket behind the pillars', POCKET],
  ])('takes a squad from the south gate to %s with no character giving up', (name, end) => {
    const state = createGame(1, QUIET);
    expectArrival(walk(state, end, 6000), name);
  });

  it.each([
    ['west', WEST_OF_SLIVER],
    ['east', EAST_OF_SLIVER],
  ])('takes a squad by the %s side of the sliver, on to each end, with no character giving up', (side, beside) => {
    for (const end of [CITADEL_DOOR, FALLS_END, POCKET]) {
      const state = createGame(2, QUIET);
      const label = `${side}, to ${String(end.x)}, ${String(end.z)}`;
      expectArrival(walk(state, { x: -17, z: 24 }, 3000), `${label}, to the sliver`);
      expectArrival(walk(state, beside, 1500), `${label}, beside it`);
      expectArrival(walk(state, JUNCTION, 1500), `${label}, past it`);
      expectArrival(walk(state, end, 6000), label);
    }
  });

  it.each([
    ['west of the sliver', { x: -17, z: 24 }, { x: -9, z: 0 }],
    ['east of the sliver', { x: -9, z: 0 }, { x: 0, z: 25 }],
    ['round the left pillar', { x: 6, z: 28 }, { x: 21, z: 46 }],
    ['between the pillars', { x: 21, z: 46 }, { x: 22, z: 18 }],
    ['the east spur', { x: 52, z: 20 }, { x: 69, z: -36 }],
    ['the causeway', { x: -11, z: -60 }, { x: -11, z: -117 }],
  ])('walks %s in well under twice the straight time (stop trigger)', (name, from, to) => {
    const state = createGame(3, QUIET);
    walk(state, from, 6000);
    const start = state.tick;
    expectArrival(walk(state, to, 3000), name);
    const seconds = (state.tick - start) / 30;
    expect(seconds).toBeLessThan((2 * Math.hypot(to.x - from.x, to.z - from.z)) / SQUAD_SPEED_FLOOR);
  });

  it.each(GARGANTA.contents.packs.map((pack, index) => [index, pack] as const))('starts a fight at pack %i and carries on walking after it', (index, pack) => {
    // Beside the pack, on the route's side, with only this pack in the zone. The squad is kept alive: the walk is on trial.
    const beside = { x: pack.x + (index === 2 ? -10 : 0), z: pack.z + (index === 2 ? 5 : index === 3 ? 12 : -11) };
    const state = createGame(4, { ...GARGANTA_SCENARIO, squadStart: beside, contents: { dummy: null, packs: [pack], boss: null } });
    const events: GameEvent[] = [];
    for (let tick = 0; tick < 240; tick += 1) {
      for (const body of state.bodies) body.health = body.maxHealth;
      events.push(...step(state, []));
    }
    expect(state.live.enemies.some(({ awake }) => awake), 'a fight has started').toBe(true);
    expect(events.some(({ type }) => type === 'hit'), 'blows have landed').toBe(true);
    const onward = index === 3 ? CITADEL_DOOR : GARGANTA_CAMP;
    const after = step(state, [move(onward.x, onward.z)]);
    const arrived = new Set<number>();
    for (let tick = 0; tick < 3600 && arrived.size < ALL.length; tick += 1) {
      for (const body of state.bodies) body.health = body.maxHealth;
      for (const event of step(state, [])) {
        after.push(event);
        if (event.type === 'unit-arrived') arrived.add(event.unitId);
      }
    }
    expect(after.filter(({ type }) => type === 'unit-gave-up')).toEqual([]);
    expect(arrived.size).toBe(ALL.length);
  });
});

describe('a pack’s own spread (M2)', () => {
  const PACK: PackData = { x: 0, z: 0, level: 1, mobs: [{ kind: 'wasp', count: 40 }] };

  it('lands members inside a pack’s own square, and uses the usual one when it sets none', () => {
    const state = createGame(1, ISLAND_SCENARIO);
    const within = (pack: PackData): number => Math.max(...createPack(state, pack, 0).flatMap(({ x, z }) => [Math.abs(x), Math.abs(z)]));
    expect(within({ ...PACK, spread: 2 })).toBeLessThanOrEqual(2);
    const usual = within(PACK);
    expect(usual).toBeLessThanOrEqual(MONSTER_RULES.spread);
    expect(usual).toBeGreaterThan(2);
  });
});

describe('crossing between Carrefour du Colosse and Garganta da Cidadela', () => {
  it('goes through the west door to the south end, and back beside the door, clear of the door’s own gate', () => {
    const state = createGame(1, { ...GARGANTA_SCENARIO, zone: COLOSSE.id, squadStart: { x: -106, z: 18 }, squadHeading: Math.PI, contents: NOTHING });
    const out = walk(state, INTO.area, 900);
    expect(out.filter(({ type }) => type === 'unit-gave-up')).toEqual([]);
    expect(out.find(({ type }) => type === 'zone-changed')).toMatchObject({ from: COLOSSE.id, to: GARGANTA.id });
    expect(state.anchor).toEqual(INTO.arrival);
    for (const body of state.bodies) expect(isOpen(gridFor(GARGANTA), body.x, body.z)).toBe(true);
    const back = walk(state, OUT.area, 900);
    expect(back.filter(({ type }) => type === 'unit-gave-up')).toEqual([]);
    expect(back.find(({ type }) => type === 'zone-changed')).toMatchObject({ from: GARGANTA.id, to: COLOSSE.id });
    expect(state.anchor).toEqual(OUT.arrival);
    expect(Math.hypot(OUT.arrival.x - INTO.area.x, OUT.arrival.z - INTO.area.z)).toBeGreaterThan(INTO.area.radius + 4);
    for (const body of state.bodies) expect(isOpen(gridFor(COLOSSE), body.x, body.z)).toBe(true);
  });

  it('keeps the arrival at Carrefour clear of its last pack’s landing square', () => {
    const pack = COLOSSE.contents.packs[7] as PackData;
    const { spread } = MONSTER_RULES;
    expect(Math.abs(OUT.arrival.x - pack.x)).toBeGreaterThan(spread + 3);
  });

  it('crosses the whole trip with one zone running at a time', () => {
    const state = createGame(1, { ...GARGANTA_SCENARIO, contents: NOTHING });
    crossGate(state, OUT, []);
    expect(state.zoneId).toBe(COLOSSE.id);
    crossGate(state, INTO, []);
    expect(state.zoneId).toBe(GARGANTA.id);
  });
});

describe('saves with Garganta da Cidadela in the world (M2 decision 13)', () => {
  function load(text: string): GameState {
    const result = fromSave(JSON.parse(text));
    if (!result.ok) throw new Error(`Refused: ${result.refusal}`);
    return result.state;
  }

  it('load a save from before the zone, giving it a fresh record, and play on', () => {
    const state = createGame(3, ISLAND_SCENARIO);
    for (let tick = 0; tick < 90; tick += 1) step(state, []);
    const save = toSave(state);
    const before = { ...save, game: { ...save.game, records: save.game.records.filter(({ id }) => id !== GARGANTA.id) } };
    const loaded = load(JSON.stringify(before));
    expect(loaded.zoneId).toBe('lande');
    expect(loaded.records.find(({ id }) => id === GARGANTA.id)).toEqual({ id: GARGANTA.id, bossDead: false, returns: [], contents: null });
    for (let tick = 0; tick < 300; tick += 1) step(loaded, []);
    expect(loaded.squadDown).toBe(false);
  });

  it('load a save made in the zone back in it, where the squad stood', () => {
    const state = createGame(5, QUIET);
    walk(state, GARGANTA_MAIN_ROUTE[6] as Point);
    const loaded = load(JSON.stringify(toSave(state)));
    expect(loaded.zoneId).toBe(GARGANTA.id);
    expect(loaded.bodies.map(({ x, z }) => ({ x, z }))).toEqual(state.bodies.map(({ x, z }) => ({ x, z })));
  });

  it('load a save made in the zone with its packs alive', () => {
    const state = createGame(6, GARGANTA_SCENARIO);
    const loaded = load(JSON.stringify(toSave(state)));
    expect(loaded.zoneId).toBe(GARGANTA.id);
    expect(loaded.live.enemies.length).toBeGreaterThan(10);
  });
});
