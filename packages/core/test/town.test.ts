import { describe, expect, it } from 'vitest';
import { MOVEMENT } from '../data/movement';
import { ISLAND_SCENARIO, TOWN_SCENARIO } from '../data/scenarios';
import { START_ZONE, ZONES } from '../data/zones';
import { autoCommands } from '../src/auto';
import { badGates, badPlacements, unreachableZones } from '../src/checks';
import { createGame, step } from '../src/game';
import { buildGrid, canReach, findRoute, isOpen, type Grid, type Street } from '../src/grid';
import { fromSave, toSave } from '../src/save';
import type { GameEvent, GameState, Point } from '../src/state';
import { gridFor, zoneData, type Ground, type ZoneData } from '../src/world';
import { crossGate } from '../src/zones';
import { FIGHTER, HEALER, SNIPER } from './helpers';

const ALL = [FIGHTER, SNIPER, HEALER];
const TOWN = zoneData('montclaire');
const [OUT_OF_TOWN] = TOWN.gates;
const INTO_TOWN = zoneData('lande').gates.find(({ to }) => to === 'montclaire');
if (!OUT_OF_TOWN || !INTO_TOWN) throw new Error('Montclaire and the Lande need a gate to each other.');

type Streets = Extract<Ground, { shape: 'streets' }>;
const GROUND = TOWN.ground as Streets;

function street(id: string): Street {
  const found = GROUND.streets.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`No street is called ${id}.`);
  return found;
}

/** A copy of the town with some streets closed, for tests. */
function townWithout(...ids: string[]): ZoneData {
  return { ...TOWN, ground: { ...GROUND, streets: GROUND.streets.filter(({ id }) => !ids.includes(id)) } };
}

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

/** Points along a street's centreline, every unit, each with the direction straight across it. */
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
 * Open ground the triangle needs to pass a street unsqueezed (decision 3): its two back
 * places walk 4.6 either side of its middle, and the grid closes a character's radius
 * inside each edge. The grid's cells are a unit across, so a measured width may fall
 * short of the true one by up to a cell.
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

describe('Montclaire (S3d)', () => {
  it('passes the world data checks: reachable, both gates arrive on walkable cells, and its camp is walkable', () => {
    expect(unreachableZones(ZONES, START_ZONE)).toEqual([]);
    expect(unreachableZones(ZONES, 'montclaire')).toEqual([]);
    expect(badGates(ZONES)).toEqual([]);
    expect(badPlacements(ZONES)).toEqual([]);
    expect(isOpen(gridFor(TOWN), INTO_TOWN.arrival.x, INTO_TOWN.arrival.z)).toBe(true);
    expect(isOpen(gridFor(zoneData('lande')), OUT_OF_TOWN.arrival.x, OUT_OF_TOWN.arrival.z)).toBe(true);
  });

  it('starts a new game on a walkable cell in the plaza, with nothing to fight', () => {
    const state = createGame(1, TOWN_SCENARIO);
    expect(state.zoneId).toBe('montclaire');
    const { x, z } = TOWN_SCENARIO.squadStart;
    expect(isOpen(gridFor(TOWN), x, z)).toBe(true);
    for (const body of state.bodies) expect(isOpen(gridFor(TOWN), body.x, body.z)).toBe(true);
    expect(state.live.enemies).toEqual([]);
    expect(TOWN.kind).toBe('town');
    // Auto-combat has nothing to fight, so it stops at once (decision 11).
    expect(autoCommands(state).stop).toBe('clear');
  });

  it('has every street wide enough for the triangle along its whole length, measured on the grid', () => {
    const grid = buildGrid(GROUND, []);
    for (const { id, points, width } of GROUND.streets) {
      expect(width, id).toBeGreaterThanOrEqual(12);
      // The gate street runs on to the town's edge, which the grid closes like a wall.
      const { bounds } = GROUND;
      const inside = samples(points).filter(({ at }) => at.z < bounds.maxZ - TRIANGLE_NEEDS / 2);
      const narrowest = Math.min(...inside.map(({ at, across }) => openAcross(grid, at, across)));
      expect(narrowest, id).toBeGreaterThanOrEqual(TRIANGLE_NEEDS - grid.cell);
    }
  });

  it('has a plaza at least 24 across, north to south, across its middle stretch', () => {
    const grid = buildGrid(GROUND, []);
    const [plaza] = GROUND.places;
    if (!plaza) throw new Error('Montclaire needs its plaza.');
    const middle = { x: -9.6, z: -25.3 };
    for (let x = -30; x <= 10; x += 2) {
      // Open ground across, plus the margin the grid keeps inside each edge.
      const across = openAcross(grid, { x, z: middle.z }, { x: 0, z: 1 }) + 2 * MOVEMENT.unitRadius;
      expect(across, `x ${String(x)}`).toBeGreaterThanOrEqual(24);
    }
  });

  it('stands every lot’s door on a walkable cell, beside the street it faces', () => {
    expect(TOWN.lots.map(({ id }) => id)).toEqual(['smithy', 'shop', 'inn']);
    for (const { id, door } of TOWN.lots) expect(isOpen(gridFor(TOWN), door.x, door.z), id).toBe(true);
  });

  it('has a loop: with the left street closed, the plaza still reaches the gate by the right and bottom streets', () => {
    const start = TOWN_SCENARIO.squadStart;
    const gate = OUT_OF_TOWN.area;
    const closed = gridFor(townWithout('left'));
    expect(canReach(closed, start, gate)).toBe(true);
    const route = findRoute(closed, start, gate) ?? [];
    // The way round passes the right street's far end, in the east.
    expect(Math.max(...route.map(({ x }) => x))).toBeGreaterThan(30);
    // Closing both sides of the loop cuts the plaza off, so the loop is what joins them.
    expect(canReach(gridFor(townWithout('left', 'right')), start, gate)).toBe(false);
  });

  it('takes a squad from the plaza to each end of each street with no character giving up', () => {
    const ends = [
      ...['left', 'right', 'bottom'].flatMap((id) => {
        const { points } = street(id);
        return [points[0] as Point, points[points.length - 1] as Point];
      }),
      street('gate').points[0] as Point,
    ];
    for (const end of ends) {
      const state = createGame(1, TOWN_SCENARIO);
      const events = walk(state, end);
      const label = `${String(end.x)}, ${String(end.z)}`;
      expect(events.filter(({ type }) => type === 'unit-gave-up'), label).toEqual([]);
      expect(events.filter(({ type }) => type === 'unit-arrived').length, label).toBeGreaterThanOrEqual(ALL.length);
    }
  });

  it('takes a squad from the plaza out through the gate onto the Lande with no character giving up, and back in', () => {
    const state = createGame(1, TOWN_SCENARIO);
    const out = walk(state, OUT_OF_TOWN.area, 3000);
    expect(out.filter(({ type }) => type === 'unit-gave-up')).toEqual([]);
    expect(out.find(({ type }) => type === 'zone-changed')).toMatchObject({ from: 'montclaire', to: 'lande' });
    expect(state.zoneId).toBe('lande');
    const back = walk(state, INTO_TOWN.area, 900);
    expect(back.filter(({ type }) => type === 'unit-gave-up')).toEqual([]);
    expect(back.find(({ type }) => type === 'zone-changed')).toMatchObject({ from: 'lande', to: 'montclaire' });
    expect(state.anchor).toEqual(INTO_TOWN.arrival);
  });
});

describe('saves with Montclaire in the world (S3d decision 10)', () => {
  function load(text: string): GameState {
    const result = fromSave(JSON.parse(text));
    if (!result.ok) throw new Error(`Refused: ${result.refusal}`);
    return result.state;
  }

  it('load a version 1 save made on the Lande before Montclaire, giving the town a fresh record', () => {
    const state = createGame(3, ISLAND_SCENARIO);
    for (let tick = 0; tick < 90; tick += 1) step(state, []);
    const save = toSave(state);
    // As a build before S3d wrote it: no record for the town.
    const before = { ...save, game: { ...save.game, records: save.game.records.filter(({ id }) => id !== 'montclaire') } };
    const loaded = load(JSON.stringify(before));
    expect(loaded.zoneId).toBe('lande');
    expect(loaded.records.find(({ id }) => id === 'montclaire')).toEqual({ id: 'montclaire', bossDead: false, returns: [], contents: null });
    expect(loaded.bodies.map(({ x, z }) => ({ x, z }))).toEqual(state.bodies.map(({ x, z }) => ({ x, z })));
    for (let tick = 0; tick < 300; tick += 1) step(loaded, []);
    expect(loaded.squadDown).toBe(false);
  });

  it('load a save made in Montclaire back in Montclaire, where it stood', () => {
    const state = createGame(5, TOWN_SCENARIO);
    walk(state, street('left').points[1] as Point);
    const loaded = load(JSON.stringify(toSave(state)));
    expect(loaded.zoneId).toBe('montclaire');
    expect(loaded.bodies.map(({ x, z }) => ({ x, z }))).toEqual(state.bodies.map(({ x, z }) => ({ x, z })));
    expect(loaded.live.enemies).toEqual([]);
  });

  it('cross from the Lande into the town with the squad whole', () => {
    const state = createGame(1, ISLAND_SCENARIO);
    crossGate(state, INTO_TOWN, []);
    expect(state.zoneId).toBe('montclaire');
    for (const body of state.bodies) expect(isOpen(gridFor(TOWN), body.x, body.z)).toBe(true);
  });
});
