import { describe, expect, it } from 'vitest';
import {
  COLOSSE_BLOCKED,
  COLOSSE_DOOR,
  COLOSSE_LAKE,
  COLOSSE_LAKE_ROUTE,
  COLOSSE_OBSTACLES,
  COLOSSE_OUTLINE,
  COLOSSE_ROAD,
  COLOSSE_SOUTH_ROUTE,
  COLOSSE_WALLS,
} from '../data/colosse';
import { MONSTERS } from '../data/enemies';
import { MOVEMENT } from '../data/movement';
import { COLOSSE_SCENARIO, EMPTY_SCENARIO, ISLAND_SCENARIO } from '../data/scenarios';
import { START_ZONE, ZONES } from '../data/zones';
import { badGates, badPlacements, unreachableZones } from '../src/checks';
import { createGame, step } from '../src/game';
import { buildGrid, canReach, isOpen, type Grid } from '../src/grid';
import { fromSave, toSave } from '../src/save';
import type { GameEvent, GameState, Point, Scenario } from '../src/state';
import { gridFor, zoneData, type Ground } from '../src/world';
import { crossGate } from '../src/zones';
import { FIGHTER, HEALER, SNIPER } from './helpers';

const ALL = [FIGHTER, SNIPER, HEALER];
const COLOSSE = zoneData('carrefour-du-colosse');
const LANDE = zoneData('lande');
const INTO = LANDE.gates.find(({ to }) => to === COLOSSE.id);
const OUT = COLOSSE.gates.find(({ to }) => to === 'lande');
if (!INTO || !OUT) throw new Error('The Lande and Carrefour du Colosse need a gate to each other.');
const GROUND = COLOSSE.ground as Extract<Ground, { shape: 'basin' }>;

/** The zone with its packs taken out, so a walk is not a fight. */
const QUIET: Scenario = { ...COLOSSE_SCENARIO, contents: { dummy: null, packs: [], boss: null } };

const WEST_FLANK = COLOSSE_ROAD[COLOSSE_ROAD.length - 1] as Point;
const LAKE_END = COLOSSE_LAKE_ROUTE[1] as Point;

/** How far open ground runs across a line from a point, both ways along a direction, on the grid. */
function openAcross(grid: Grid, at: Point, along: Point): number {
  const STEP = 0.05;
  const reach = (sign: number): number => {
    let distance = 0;
    while (isOpen(grid, at.x + sign * along.x * (distance + STEP), at.z + sign * along.z * (distance + STEP))) {
      distance += STEP;
    }
    return distance;
  };
  return reach(1) + reach(-1);
}

/** Points along a line, every unit, each with the direction straight across it. */
function samples(points: readonly Point[]): { at: Point; across: Point }[] {
  const out: { at: Point; across: Point }[] = [];
  for (let index = 0; index + 1 < points.length; index += 1) {
    const from = points[index] as Point;
    const to = points[index + 1] as Point;
    const length = Math.hypot(to.x - from.x, to.z - from.z);
    const across = { x: -(to.z - from.z) / length, z: (to.x - from.x) / length };
    for (let distance = 0; distance <= length; distance += 1) {
      const share = distance / length;
      out.push({ at: { x: from.x + (to.x - from.x) * share, z: from.z + (to.z - from.z) * share }, across });
    }
  }
  return out;
}

/**
 * Open ground the triangle needs to pass unsqueezed (S3d decision 3): its two back places
 * walk 4.6 either side of its middle, and the grid closes a character's radius inside each edge.
 */
const TRIANGLE_NEEDS = 2 * (4.6 + MOVEMENT.unitRadius);

function move(x: number, z: number) {
  return { type: 'move' as const, unitIds: ALL, x, z, attack: false };
}

/** Orders the squad to a point and steps until every character has arrived, or the limit passes. */
function walk(state: GameState, to: Point, limit = 1800): GameEvent[] {
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

describe('the basin shape (M1 decision 3)', () => {
  const ground = {
    shape: 'basin' as const,
    bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
    outline: [
      { x: -15, z: -15 },
      { x: 15, z: -15 },
      { x: 15, z: 15 },
      { x: -15, z: 15 },
    ],
    blocked: [
      {
        id: 'block',
        outline: [
          { x: 4, z: 4 },
          { x: 10, z: 4 },
          { x: 10, z: 10 },
          { x: 4, z: 10 },
        ],
      },
    ],
    walls: [{ id: 'wall', width: 2, points: [{ x: -10, z: -5 }, { x: 0, z: -5 }] }],
  };
  const grid = buildGrid(ground, []);

  it('opens ground inside the outline, a character’s radius clear of its edge', () => {
    expect(isOpen(grid, 0, 0)).toBe(true);
    expect(isOpen(grid, 13.2, 0.5)).toBe(true);
    expect(isOpen(grid, 14.2, 0.5)).toBe(false);
    expect(isOpen(grid, 15.5, 0.5)).toBe(false);
    expect(isOpen(grid, -18, 0)).toBe(false);
  });

  it('closes blocked outlines and the margin round them', () => {
    expect(isOpen(grid, 7, 7)).toBe(false);
    expect(isOpen(grid, 3.8, 7)).toBe(false);
    expect(isOpen(grid, 2, 7)).toBe(true);
  });

  it('closes a bending wall to half its width plus a character’s radius', () => {
    expect(isOpen(grid, -5, -5)).toBe(false);
    expect(isOpen(grid, -5, -3.5)).toBe(false);
    expect(isOpen(grid, -5, -2)).toBe(true);
    expect(isOpen(grid, -5, -8)).toBe(true);
  });

  it('is the grid routes use: a route goes round a blocked outline', () => {
    expect(canReach(grid, { x: 0, z: 7 }, { x: 13, z: 7 })).toBe(true);
  });
});

describe('Carrefour du Colosse (M1)', () => {
  it('is a field of the basin kind, 240 by 240, with eight packs and no boss', () => {
    expect(COLOSSE.kind).toBe('field');
    expect(GROUND.shape).toBe('basin');
    expect(COLOSSE.contents.packs).toHaveLength(8);
    expect(COLOSSE.contents.boss).toBeNull();
    // The grid covers the walkable ground, inside the 240 by 240 footprint (decision 2).
    const { bounds } = GROUND;
    expect(bounds.maxX - bounds.minX).toBeLessThanOrEqual(240);
    expect(bounds.maxZ - bounds.minZ).toBeLessThanOrEqual(240);
    for (const { x, z } of COLOSSE_OUTLINE) {
      expect(Math.abs(x)).toBeLessThanOrEqual(120);
      expect(Math.abs(z)).toBeLessThanOrEqual(120);
    }
  });

  it('passes the world data checks: reachable from the Lande and back, gates arrive on walkable cells, packs and camp stand on them', () => {
    expect(unreachableZones(ZONES, START_ZONE)).toEqual([]);
    expect(unreachableZones(ZONES, COLOSSE.id)).toEqual([]);
    expect(badGates(ZONES)).toEqual([]);
    expect(badPlacements(ZONES)).toEqual([]);
    expect(isOpen(gridFor(COLOSSE), INTO.arrival.x, INTO.arrival.z)).toBe(true);
    expect(isOpen(gridFor(LANDE), OUT.arrival.x, OUT.arrival.z)).toBe(true);
  });

  it('keeps the Lande’s other gates, stones and packs where they were', () => {
    expect(LANDE.gates.map(({ id }) => id)).toEqual(['lande-to-cave', 'lande-to-montclaire', 'lande-to-colosse']);
    expect(LANDE.contents.packs).toHaveLength(7);
    expect(LANDE.obstacles).toHaveLength(95);
  });

  it('has no gate through the west door or the south road: nothing leaves but the east tip', () => {
    expect(COLOSSE.gates.map(({ id }) => id)).toEqual(['colosse-to-lande']);
  });

  it('puts the gates at the east tip, and the camp and arrival on its inside', () => {
    expect(OUT.area.x).toBeGreaterThan(105);
    expect(INTO.arrival.x).toBeGreaterThan(95);
    expect(COLOSSE.camp.x).toBeGreaterThan(95);
  });

  it('closes water, walls, rocks and the plateau and the ridge', () => {
    const grid = gridFor(COLOSSE);
    for (const { id, points } of COLOSSE_WALLS) {
      for (const { at } of samples(points)) expect(isOpen(grid, at.x, at.z), id).toBe(false);
    }
    for (const { id, outline } of COLOSSE_BLOCKED) {
      const x = outline.reduce((sum, point) => sum + point.x, 0) / outline.length;
      const z = outline.reduce((sum, point) => sum + point.z, 0) / outline.length;
      expect(isOpen(grid, x, z), id).toBe(false);
    }
    for (const rock of COLOSSE_OBSTACLES) expect(isOpen(grid, rock.x, rock.z), `rock ${String(rock.x)}`).toBe(false);
    // The river and the pool are water, blocked like a wall.
    for (const id of ['river', 'pool']) expect(COLOSSE_WALLS.some((wall) => wall.id === id)).toBe(true);
  });

  it('cannot reach the closed south road or the lake', () => {
    const grid = gridFor(COLOSSE);
    // The south route ends at the basin's edge, and the road beyond it is shut by look only.
    const end = COLOSSE_SOUTH_ROUTE[COLOSSE_SOUTH_ROUTE.length - 1] as Point;
    for (const beyond of [{ x: 11, z: 72 }, { x: 11, z: 90 }, { x: 14, z: 80 }]) {
      expect(isOpen(grid, beyond.x, beyond.z)).toBe(false);
    }
    expect(isOpen(grid, end.x, end.z)).toBe(true);
    for (const lake of COLOSSE_LAKE) expect(isOpen(grid, lake.x, lake.z)).toBe(false);
    for (const inLake of [{ x: 0, z: -100 }, { x: 30, z: -100 }, { x: -30, z: -90 }]) {
      expect(isOpen(grid, inLake.x, inLake.z)).toBe(false);
    }
  });

  it('is one connected area from the east tip: every pack, the camp, the lake end and the west flank can be reached', () => {
    const grid = gridFor(COLOSSE);
    const places: Point[] = [COLOSSE.camp, LAKE_END, WEST_FLANK, ...COLOSSE_ROAD, ...COLOSSE_LAKE_ROUTE, ...COLOSSE_SOUTH_ROUTE, ...COLOSSE.contents.packs];
    for (const place of places) {
      expect(isOpen(grid, place.x, place.z), `${String(place.x)}, ${String(place.z)} walkable`).toBe(true);
      expect(canReach(grid, INTO.arrival, place), `${String(place.x)}, ${String(place.z)} reachable`).toBe(true);
    }
    // No pocket of open ground is cut off from the tip, other than slivers too small to stand in.
    const areas = new Map<number, number>();
    for (let index = 0; index < grid.flags.length; index += 1) {
      const area = grid.areas[index] ?? -1;
      if (area >= 0) areas.set(area, (areas.get(area) ?? 0) + 1);
    }
    const sizes = [...areas.values()].sort((a, b) => b - a);
    expect(sizes[0]).toBeGreaterThan(12000);
    expect(sizes[0]).toBeLessThan(16000);
    expect(sizes.slice(1).every((size) => size < 30)).toBe(true);
  });

  it('has a main road wide enough for the triangle along its whole length, measured on the grid (decision 8)', () => {
    const grid = gridFor(COLOSSE);
    let narrowest = Infinity;
    for (const { at, across } of samples(COLOSSE_ROAD)) {
      narrowest = Math.min(narrowest, openAcross(grid, at, across));
    }
    // At least 13 units of road, and so at least the 10.6 the triangle needs unsqueezed.
    expect(narrowest).toBeGreaterThanOrEqual(13);
    expect(narrowest).toBeGreaterThanOrEqual(TRIANGLE_NEEDS);
  });

  it('has a main road of about 258 units, and a lake side route and a south route that are walkable end to end', () => {
    const length = (points: readonly Point[]): number =>
      points.slice(1).reduce((sum, point, index) => sum + Math.hypot(point.x - (points[index] as Point).x, point.z - (points[index] as Point).z), 0);
    expect(length(COLOSSE_ROAD)).toBeGreaterThan(250);
    expect(length(COLOSSE_ROAD)).toBeLessThan(265);
    const grid = gridFor(COLOSSE);
    for (const route of [COLOSSE_LAKE_ROUTE, COLOSSE_SOUTH_ROUTE]) {
      for (const { at } of samples(route)) expect(isOpen(grid, at.x, at.z), `${String(at.x)}, ${String(at.z)}`).toBe(true);
    }
  });

  it('places eight packs of the four S3f monsters, at levels rising westward from 6 to 11', () => {
    const packs = COLOSSE.contents.packs;
    expect(packs.map(({ level }) => level).sort((a, b) => a - b)).toEqual([6, 7, 7, 8, 9, 9, 10, 11]);
    for (const pack of packs) {
      for (const { kind, count } of pack.mobs) {
        expect(Object.keys(MONSTERS)).toContain(kind);
        expect(count).toBeGreaterThan(0);
      }
    }
    expect(packs[0]?.level).toBe(6);
    expect(packs[7]?.level).toBe(11);
    expect(packs[7]?.x).toBeLessThan(-90);
    expect(COLOSSE.packRespawnSeconds).toBe(180);
  });

  it('takes a squad from the east tip to the west flank, and to the lake end, with no character giving up', () => {
    for (const end of [WEST_FLANK, LAKE_END]) {
      const state = createGame(1, QUIET);
      expect(state.zoneId).toBe(COLOSSE.id);
      const events = walk(state, end, 3000);
      const label = `${String(end.x)}, ${String(end.z)}`;
      expect(events.filter(({ type }) => type === 'unit-gave-up'), label).toEqual([]);
      expect(events.filter(({ type }) => type === 'unit-arrived').length, label).toBeGreaterThanOrEqual(ALL.length);
    }
  });

  it('takes a squad along the road leg by leg with no character giving up, and out the lake end and back', () => {
    const state = createGame(2, QUIET);
    const events: GameEvent[] = [];
    for (const stop of [COLOSSE_ROAD[7], COLOSSE_ROAD[10], COLOSSE_ROAD[13], WEST_FLANK, COLOSSE_ROAD[4], LAKE_END, COLOSSE.camp] as Point[]) {
      events.push(...walk(state, stop, 1800));
    }
    expect(events.filter(({ type }) => type === 'unit-gave-up')).toEqual([]);
    expect(events.filter(({ type }) => type === 'unit-arrived').length).toBeGreaterThanOrEqual(ALL.length * 7);
  });

  it('keeps the closed door in the west as look only: it stands off the grid’s open ground, with the road ending before it', () => {
    expect(COLOSSE.gates.some(({ area }) => Math.hypot(area.x - COLOSSE_DOOR.x, area.z - COLOSSE_DOOR.z) < 10)).toBe(false);
    expect(Math.hypot(WEST_FLANK.x - COLOSSE_DOOR.x, WEST_FLANK.z - COLOSSE_DOOR.z)).toBeLessThan(5);
  });
});

describe('crossing between the Lande and Carrefour du Colosse', () => {
  it('takes the squad from the Lande through the new gate, and back through the east tip’s', () => {
    const state = createGame(1, EMPTY_SCENARIO);
    const out = walk(state, INTO.area, 3000);
    expect(out.filter(({ type }) => type === 'unit-gave-up')).toEqual([]);
    expect(out.find(({ type }) => type === 'zone-changed')).toMatchObject({ from: 'lande', to: COLOSSE.id });
    expect(state.zoneId).toBe(COLOSSE.id);
    expect(state.anchor).toEqual(INTO.arrival);
    for (const body of state.bodies) expect(isOpen(gridFor(COLOSSE), body.x, body.z)).toBe(true);
    const back = walk(state, OUT.area, 900);
    expect(back.filter(({ type }) => type === 'unit-gave-up')).toEqual([]);
    expect(back.find(({ type }) => type === 'zone-changed')).toMatchObject({ from: COLOSSE.id, to: 'lande' });
    expect(state.anchor).toEqual(OUT.arrival);
  });

  it('crosses the whole trip: Lande, west along the road to the flank, and back out at the tip', () => {
    const state = createGame(1, EMPTY_SCENARIO);
    crossGate(state, INTO, []);
    const events = [...walk(state, COLOSSE_ROAD[9] as Point, 2400), ...walk(state, OUT.area, 2400)];
    expect(events.filter(({ type }) => type === 'unit-gave-up')).toEqual([]);
    expect(state.zoneId).toBe('lande');
  });
});

describe('saves with Carrefour du Colosse in the world (M1 decision 13)', () => {
  function load(text: string): GameState {
    const result = fromSave(JSON.parse(text));
    if (!result.ok) throw new Error(`Refused: ${result.refusal}`);
    return result.state;
  }

  it('load a version 1 save made on the Lande before the zone, giving it a fresh record, and play on', () => {
    const state = createGame(3, ISLAND_SCENARIO);
    for (let tick = 0; tick < 90; tick += 1) step(state, []);
    const save = toSave(state);
    const before = { ...save, game: { ...save.game, records: save.game.records.filter(({ id }) => id !== COLOSSE.id) } };
    const loaded = load(JSON.stringify(before));
    expect(loaded.zoneId).toBe('lande');
    expect(loaded.records.find(({ id }) => id === COLOSSE.id)).toEqual({ id: COLOSSE.id, bossDead: false, returns: [], contents: null });
    expect(loaded.bodies.map(({ x, z }) => ({ x, z }))).toEqual(state.bodies.map(({ x, z }) => ({ x, z })));
    for (let tick = 0; tick < 300; tick += 1) step(loaded, []);
    expect(loaded.squadDown).toBe(false);
  });

  it('load a save made in the zone back in it, where the squad stood', () => {
    const state = createGame(5, QUIET);
    walk(state, COLOSSE_ROAD[6] as Point);
    const loaded = load(JSON.stringify(toSave(state)));
    expect(loaded.zoneId).toBe(COLOSSE.id);
    expect(loaded.bodies.map(({ x, z }) => ({ x, z }))).toEqual(state.bodies.map(({ x, z }) => ({ x, z })));
  });

  it('load a save made in the zone with its packs alive, and fight on with all eight packs', () => {
    const state = createGame(6, COLOSSE_SCENARIO);
    const loaded = load(JSON.stringify(toSave(state)));
    expect(loaded.zoneId).toBe(COLOSSE.id);
    expect(loaded.live.enemies.length).toBeGreaterThan(20);
  });
});
