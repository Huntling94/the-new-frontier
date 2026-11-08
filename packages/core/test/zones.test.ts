import { describe, expect, it } from 'vitest';
import { MANA } from '../data/combat';
import { TICK_RATE } from '../data/sim';
import { MOVEMENT } from '../data/movement';
import { EMPTY_SCENARIO, ISLAND_SCENARIO } from '../data/scenarios';
import { START_ZONE, ZONES } from '../data/zones';
import { badGates, badPlacements, strayEnemyReferences, unreachableZones } from '../src/checks';
import { hitEnemy } from '../src/combat';
import { createGame, step } from '../src/game';
import { findRoute, isOpen, lineClear } from '../src/grid';
import type { GameEvent, GameState, Point } from '../src/state';
import { secondsToTicks } from '../src/time';
import { gridFor, zoneData, zoneOf, type ZoneData } from '../src/world';
import { crossGate, recordOf } from '../src/zones';
import { FIGHTER, HEALER, SNIPER, ofType, place, run, unitOf } from './helpers';

const ALL = [FIGHTER, SNIPER, HEALER];
const LANDE = zoneData('lande');
const CAVE = zoneData('lande-cave');
const [INTO_CAVE] = LANDE.gates;
const [OUT_OF_CAVE] = CAVE.gates;
if (!INTO_CAVE || !OUT_OF_CAVE) throw new Error('The Lande and the cave need a gate each.');

/** Where the cave's mouth puts the squad, and a point the L-shaped wall hides from it. */
const MOUTH = OUT_OF_CAVE.arrival.x === 0 ? CAVE.camp : INTO_CAVE.arrival;
const BEHIND_WALL = { x: -6, z: -18 };
const RESPAWN = secondsToTicks(LANDE.packRespawnSeconds);

function length(from: Point, route: readonly Point[]): number {
  let total = 0;
  let at = from;
  for (const corner of route) {
    total += Math.hypot(corner.x - at.x, corner.z - at.z);
    at = corner;
  }
  return total;
}

function move(x: number, z: number, unitIds: readonly number[] = ALL) {
  return { type: 'move' as const, unitIds, x, z, attack: false };
}

/** Steps until an event of a type shows, or the limit passes. */
function runUntil(state: GameState, type: GameEvent['type'], limit = 600): GameEvent[] {
  const events: GameEvent[] = [];
  for (let tick = 0; tick < limit && !events.some((event) => event.type === type); tick += 1) {
    events.push(...step(state, []));
  }
  return events;
}

/** Puts the squad just south of the Lande's gate, with nothing to do. */
function besideGate(state: GameState): void {
  const { area } = INTO_CAVE as NonNullable<typeof INTO_CAVE>;
  place(unitOf(state, FIGHTER), area.x + 6, area.z - 6);
  place(unitOf(state, SNIPER), area.x + 8, area.z - 7);
  place(unitOf(state, HEALER), area.x + 4, area.z - 8);
}

function enterCave(state: GameState): GameEvent[] {
  besideGate(state);
  const { area } = INTO_CAVE as NonNullable<typeof INTO_CAVE>;
  return [...step(state, [move(area.x, area.z)]), ...runUntil(state, 'zone-changed')];
}

function leaveCave(state: GameState): GameEvent[] {
  const { area } = OUT_OF_CAVE as NonNullable<typeof OUT_OF_CAVE>;
  return [...step(state, [move(area.x, area.z)]), ...runUntil(state, 'zone-changed')];
}

/** Kills every member of a pack, as a hit from the Sniper. */
function clearPack(state: GameState, packId: number): void {
  for (const enemy of state.live.enemies.filter((member) => member.packId === packId)) {
    hitEnemy(state, unitOf(state, SNIPER), enemy, 1e6, []);
  }
}

describe('routes (D-023)', () => {
  const grid = gridFor(CAVE);

  it('find the shortest way round the cave wall, where a straight walk cannot pass', () => {
    expect(lineClear(grid, MOUTH, BEHIND_WALL)).toBe(false);
    const route = findRoute(grid, MOUTH, BEHIND_WALL);
    expect(route).not.toBeNull();
    // The shortest line hugs the end of the L, a unit's radius off each corner.
    const reach = MOVEMENT.unitRadius;
    const shortest = length(MOUTH, [
      { x: 8 + reach, z: 6 + reach },
      { x: 8 + reach, z: 2 - reach },
      BEHIND_WALL,
    ]);
    const walked = length(MOUTH, route ?? []);
    expect(walked).toBeGreaterThanOrEqual(shortest);
    expect(walked).toBeLessThan(shortest * 1.05);
    expect(route?.at(-1)).toEqual(BEHIND_WALL);
  });

  it('are smoothed into a few long straight legs, each clear of walls', () => {
    const route = findRoute(grid, MOUTH, BEHIND_WALL) ?? [];
    expect(route.length).toBeLessThanOrEqual(4);
    let at: Point = MOUTH;
    for (const corner of route) {
      expect(lineClear(grid, at, corner)).toBe(true);
      at = corner;
    }
  });

  it('take a squad in the cave round the wall with one order', () => {
    const state = createGame(1, EMPTY_SCENARIO);
    enterCave(state);
    const events = step(state, [move(BEHIND_WALL.x, BEHIND_WALL.z)]);
    events.push(...run(state, 450));
    expect(ofType(events, 'unit-gave-up')).toEqual([]);
    expect(ofType(events, 'unit-arrived')).toHaveLength(3);
    expect(Math.hypot(unitOf(state, FIGHTER).x - BEHIND_WALL.x, unitOf(state, FIGHTER).z - BEHIND_WALL.z)).toBeLessThan(6);
  });

  it('move a destination inside a wall to the nearest walkable cell', () => {
    const state = createGame(1, EMPTY_SCENARIO);
    enterCave(state);
    step(state, [move(-14, -10)]);
    const { dest } = unitOf(state, FIGHTER);
    expect(dest && isOpen(gridFor(CAVE), dest.x, dest.z)).toBe(true);
    // The wall and a unit's radius each side leave the nearest open cell centre 3.5 away.
    expect(isOpen(gridFor(CAVE), state.anchor.x, state.anchor.z)).toBe(true);
    expect(Math.hypot(state.anchor.x + 14, state.anchor.z + 10)).toBeLessThan(4);
  });
});

describe('gates (D-021)', () => {
  it('take the whole squad through when one arrives inside on an order, the fallen too', () => {
    const state = createGame(1, EMPTY_SCENARIO);
    unitOf(state, HEALER).alive = false;
    unitOf(state, HEALER).health = 0;
    const events = enterCave(state);
    expect(ofType(events, 'zone-changed')).toEqual([
      expect.objectContaining({ from: 'lande', to: 'lande-cave' }),
    ]);
    expect(state.zoneId).toBe('lande-cave');
    expect(state.anchor).toEqual(INTO_CAVE?.arrival);
    for (const unit of state.bodies) {
      expect(Math.hypot(unit.x - state.anchor.x, unit.z - state.anchor.z)).toBeLessThan(6);
      expect(unit.dest).toBeNull();
    }
    expect(unitOf(state, HEALER).alive).toBe(false);
  });

  it('move the squad’s bodies whole, keeping every character’s health, mana and cooldowns (S3b)', () => {
    const state = createGame(1, EMPTY_SCENARIO);
    unitOf(state, FIGHTER).health = 700;
    unitOf(state, FIGHTER).spellTicks.cleave = 900;
    unitOf(state, SNIPER).health = 300;
    unitOf(state, SNIPER).spellTicks.volley = 800;
    unitOf(state, HEALER).mana = 40;
    unitOf(state, HEALER).spellTicks.revive = 1000;
    // Keeps the Healer from healing anyone on the way, which would change their health.
    unitOf(state, HEALER).attackTicks = 5000;
    const start = state.tick;
    enterCave(state);
    expect(state.zoneId).toBe('lande-cave');
    const passed = state.tick - start;
    expect(unitOf(state, FIGHTER).health).toBe(700);
    expect(unitOf(state, SNIPER).health).toBe(300);
    expect(unitOf(state, FIGHTER).spellTicks.cleave).toBe(900 - passed);
    expect(unitOf(state, SNIPER).spellTicks.volley).toBe(800 - passed);
    expect(unitOf(state, HEALER).spellTicks.revive).toBe(1000 - passed);
    expect(unitOf(state, HEALER).attackTicks).toBe(5000 - passed);
    expect(unitOf(state, HEALER).mana).toBeCloseTo(40 + (passed * MANA.regenPerSecond) / TICK_RATE, 6);
    expect(state.bodies.map(({ id }) => id)).toEqual(state.family.active);
  });

  it('do nothing for a unit pushed in, or one walking through on the way elsewhere', () => {
    const state = createGame(1, EMPTY_SCENARIO);
    const { area } = INTO_CAVE as NonNullable<typeof INTO_CAVE>;
    place(unitOf(state, SNIPER), area.x, area.z);
    const events = run(state, 30);
    // Walking straight through the gate to a point beyond it.
    place(unitOf(state, FIGHTER), area.x - 5, area.z - 4);
    events.push(...step(state, [move(area.x + 5, area.z + 4, [FIGHTER])]), ...run(state, 120));
    expect(ofType(events, 'unit-arrived')).toHaveLength(1);
    expect(ofType(events, 'zone-changed')).toEqual([]);
    expect(state.zoneId).toBe('lande');
  });

  it('work during a fight: the zone left behind drops its live group and resets its monsters', () => {
    const state = createGame(1, ISLAND_SCENARIO);
    const victim = state.live.enemies.find(({ packId }) => packId === 0);
    if (!victim) throw new Error('No monster.');
    hitEnemy(state, unitOf(state, SNIPER), victim, 3, []);
    unitOf(state, SNIPER).targetId = victim.id;
    state.sharedTargetId = victim.id;
    state.live.shots.push({ x: 0, z: 0, unitId: SNIPER, enemyId: victim.id, multiplier: 1, crippling: false, ticks: 9 });
    const before = state.live.enemies.map(({ id }) => id);
    enterCave(state);
    expect(state.live.shots).toEqual([]);
    expect(state.live.enemies.some(({ id }) => before.includes(id))).toBe(false);
    expect(strayEnemyReferences(state)).toEqual([]);
    leaveCave(state);
    const pack = state.live.enemies.filter(({ packId }) => packId === 0);
    expect(pack.length).toBeGreaterThan(0);
    for (const member of pack) {
      expect(before).not.toContain(member.id);
      expect(member.health).toBe(member.maxHealth);
      expect(member.awake).toBe(false);
    }
  });
});

describe('zone records (D-021)', () => {
  function oneFarPack(): GameState {
    const pack = { x: 40, z: -40, level: 3, mobs: [{ kind: 'runner' as const, count: 2 }] };
    return createGame(1, { ...EMPTY_SCENARIO, contents: { dummy: null, boss: null, packs: [pack] } });
  }

  it('bring a cleared pack back at home after its respawn time, while its zone runs', () => {
    const state = oneFarPack();
    clearPack(state, 0);
    expect(recordOf(state).returns).toEqual([{ packId: 0, tick: state.tick + RESPAWN }]);
    // It comes back on the tick its return is due.
    run(state, RESPAWN);
    expect(state.live.enemies.filter(({ alive }) => alive)).toEqual([]);
    run(state, 1);
    const back = state.live.enemies.filter(({ packId }) => packId === 0);
    expect(back).toHaveLength(2);
    expect(back.every(({ awake, health, maxHealth }) => !awake && health === maxHealth)).toBe(true);
    expect(recordOf(state).returns).toEqual([]);
  });

  it('bring it back while the squad is away, so it is there on the next visit, and not before', () => {
    const early = oneFarPack();
    clearPack(early, 0);
    enterCave(early);
    leaveCave(early);
    expect(early.live.enemies).toEqual([]);

    const late = oneFarPack();
    clearPack(late, 0);
    enterCave(late);
    run(late, RESPAWN);
    expect(recordOf(late, 'lande').returns).toHaveLength(1);
    leaveCave(late);
    expect(late.live.enemies.filter(({ packId }) => packId === 0)).toHaveLength(2);
    expect(recordOf(late, 'lande').returns).toEqual([]);
  });

  it('keep the boss dead after leaving and coming back', () => {
    const state = createGame(1, ISLAND_SCENARIO);
    const boss = state.live.enemies.find((enemy) => enemy.boss);
    if (!boss) throw new Error('No boss.');
    hitEnemy(state, unitOf(state, SNIPER), boss, 1e6, []);
    expect(recordOf(state).bossDead).toBe(true);
    // The run is over once the boss dies, so the crossing is made directly.
    crossGate(state, INTO_CAVE as NonNullable<typeof INTO_CAVE>, []);
    crossGate(state, OUT_OF_CAVE as NonNullable<typeof OUT_OF_CAVE>, []);
    expect(state.zoneId).toBe('lande');
    expect(state.live.enemies.some((enemy) => enemy.boss)).toBe(false);
    expect(state.live.enemies.length).toBeGreaterThan(0);
  });

  it('are plain data, as a save will need', () => {
    const state = createGame(1, ISLAND_SCENARIO);
    expect(JSON.parse(JSON.stringify(state.records))).toEqual(state.records);
    expect(state.records.map(({ id }) => id)).toEqual(ZONES.map(({ id }) => id));
  });
});

describe('world data checks (decision 12)', () => {
  it('pass on the world as it is', () => {
    expect(unreachableZones(ZONES, START_ZONE)).toEqual([]);
    expect(badGates(ZONES)).toEqual([]);
    expect(badPlacements(ZONES)).toEqual([]);
  });

  it('find a zone no gate reaches, and a gate to nowhere', () => {
    const lost: ZoneData = { ...CAVE, id: 'lost', gates: [] };
    const caveOnly: ZoneData = { ...LANDE, gates: [INTO_CAVE as NonNullable<typeof INTO_CAVE>] };
    const misspelt: ZoneData = { ...LANDE, gates: [{ ...(INTO_CAVE as NonNullable<typeof INTO_CAVE>), to: 'lande-cav' }] };
    expect(unreachableZones([caveOnly, CAVE, lost], START_ZONE)).toEqual(['lost cannot be reached from lande']);
    expect(unreachableZones([misspelt, CAVE], START_ZONE)).toEqual([
      'lande-cave cannot be reached from lande',
      "lande's gate lande-to-cave leads to lande-cav, which does not exist",
    ]);
  });

  it('find a gate arriving inside a wall', () => {
    const intoWall: ZoneData = { ...LANDE, gates: [{ ...(INTO_CAVE as NonNullable<typeof INTO_CAVE>), arrival: { x: -14, z: -10 } }] };
    expect(badGates([intoWall, CAVE])).toEqual(["lande's gate lande-to-cave arrives off walkable ground in lande-cave"]);
  });

  it('find a pack or camp off walkable ground', () => {
    const broken: ZoneData = {
      ...CAVE,
      camp: { x: -14, z: 0, heading: 0 },
      contents: { ...CAVE.contents, packs: [{ x: 0, z: 4, level: 3, mobs: [] }] },
    };
    expect(badPlacements([broken])).toEqual([
      "lande-cave's camp is off walkable ground",
      "lande-cave's pack 0 is off walkable ground",
    ]);
  });

  it('find anything outside the live group still naming an enemy from a closed zone', () => {
    const state = createGame(1, ISLAND_SCENARIO);
    const [enemy] = state.live.enemies;
    unitOf(state, FIGHTER).targetId = enemy?.id ?? null;
    state.sharedTargetId = enemy?.id ?? null;
    expect(strayEnemyReferences(state)).toEqual([]);
    state.live = { ...state.live, enemies: [] };
    expect(strayEnemyReferences(state)).toHaveLength(2);
  });

  it('start the squad in the zone the scenario names', () => {
    expect(zoneOf(createGame(1, ISLAND_SCENARIO)).id).toBe('lande');
  });
});
