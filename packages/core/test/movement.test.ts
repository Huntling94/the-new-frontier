import { describe, expect, it } from 'vitest';
import { TEST_ISLAND } from '../data/island';
import { MOVEMENT, SCATTER } from '../data/movement';
import { EMPTY_SCENARIO } from '../data/scenarios';
import { CLASSES } from '../data/squad';
import { placeOf } from '../src/family';
import { triangleSlot } from '../src/formation';
import { advance, createGame, step } from '../src/game';
import { coastDistanceAt } from '../src/island';
import { applyCommands } from '../src/orders';
import type { Command, GameEvent, GameState, Obstacle, Point, Body } from '../src/state';
import { isWalkable, obstaclesOf, pullOntoLand } from '../src/world';

const ALL = [1, 2, 3];

function move(unitIds: readonly number[], x: number, z: number, attack = false): Command {
  return { type: 'move', unitIds, x, z, attack };
}

/** A game on an open island, so a test sees only the obstacles it adds. */
function openGame(obstacles: readonly Obstacle[] = []): GameState {
  return createGame(1, { ...EMPTY_SCENARIO, contents: { dummy: null, packs: [], boss: null, obstacles } });
}

function unit(game: GameState, id: number): Body {
  const found = game.bodies.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`No unit ${String(id)}.`);
  return found;
}

function run(game: GameState, ticks: number): GameEvent[] {
  return Array.from({ length: ticks }, () => advance(game)).flat();
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

describe('starting state', () => {
  it('places the squad at the squad test positions, in ID order', () => {
    const game = createGame(1, EMPTY_SCENARIO);
    const classIds = game.family.characters.map(({ classId }) => classId);
    expect(classIds).toEqual(['fighter', 'sniper', 'healer']);
    expect(game.bodies.map(({ id, x, z }, place) => ({ id, classId: classIds[place], x, z }))).toEqual([
      { id: 1, classId: 'fighter', x: 0, z: 62 },
      { id: 2, classId: 'sniper', x: -4.4, z: 66.2 },
      { id: 3, classId: 'healer', x: 4.4, z: 66.2 },
    ]);
    expect(game.nextId).toBe(4);
    expect(CLASSES.sniper.speed).toBe(11.5);
  });
});

describe('obstacles', () => {
  it('are baked, so every seed gets the same Lande (D-022)', () => {
    const first = obstaclesOf(createGame(1, EMPTY_SCENARIO));
    expect(obstaclesOf(createGame(2, EMPTY_SCENARIO))).toBe(first);
    const kinds = first.map((obstacle) => obstacle.kind);
    expect(kinds.filter((kind) => kind === 'stone')).toHaveLength(60);
    expect(kinds.filter((kind) => kind === 'rock')).toHaveLength(34);
  });

  it('keep the beacon at its fixed place', () => {
    expect(obstaclesOf(createGame(1, EMPTY_SCENARIO)).slice(0, 1)).toEqual([
      { kind: 'beacon', x: 0, z: 0, radius: 4.2 },
    ]);
  });

  it('leave room for a unit between any two, so that none can wedge', () => {
    const obstacles = obstaclesOf(createGame(1, EMPTY_SCENARIO));
    obstacles.forEach((one, index) => {
      for (const other of obstacles.slice(index + 1)) {
        expect(distance(one, other) - one.radius - other.radius).toBeGreaterThan(MOVEMENT.unitRadius * 2);
      }
    });
  });
});

describe('triangle formation', () => {
  it('turns the triangle to face the way the squad travels', () => {
    // Travelling along +x, the first place leads and the others trail either side.
    expect(triangleSlot(0, { x: 10, z: 20 }, 0)).toEqual({ x: 12.4, z: 20 });
    expect(triangleSlot(1, { x: 10, z: 20 }, 0)).toEqual({ x: 7.4, z: 15.4 });
    const turned = triangleSlot(0, { x: 0, z: 0 }, Math.PI / 2);
    expect(turned.x).toBeCloseTo(0, 9);
    expect(turned.z).toBeCloseTo(2.4, 9);
  });

  it('forms when all the living are ordered, and every unit arrives', () => {
    const game = openGame();
    const events = step(game, [move(ALL, 0, 30)]);
    expect(game.heading).toBeCloseTo(-Math.PI / 2, 9);
    expect(game.anchor).toEqual({ x: 0, z: 30 });
    events.push(...run(game, 150));
    expect(events.filter((event) => event.type === 'unit-arrived')).toHaveLength(3);
    expect(events.some((event) => event.type === 'unit-gave-up')).toBe(false);
    for (const member of game.bodies) {
      const slot = triangleSlot(placeOf(game, member.id), game.anchor, game.heading);
      expect(distance(member, slot)).toBeLessThan(MOVEMENT.slotReturnDistance);
      expect(member.hold).toBe(false);
    }
  });

  it('counts only the living', () => {
    const game = openGame();
    unit(game, 3).alive = false;
    step(game, [move([1, 2], 0, 30)]);
    expect(unit(game, 1).hold).toBe(false);
    expect(game.anchor).toEqual({ x: 0, z: 30 });
  });

  it('keeps the old heading for a move onto the squad itself', () => {
    const game = openGame();
    const { heading } = game;
    const centre = {
      x: game.bodies.reduce((sum, member) => sum + member.x, 0) / 3,
      z: game.bodies.reduce((sum, member) => sum + member.z, 0) / 3,
    };
    step(game, [move(ALL, centre.x + 0.5, centre.z)]);
    expect(game.heading).toBe(heading);
  });

  it('stores the attack-move flag, with no effect on where units go', () => {
    const walk = openGame();
    const attack = openGame();
    step(walk, [move(ALL, 20, 30, false)]);
    step(attack, [move(ALL, 20, 30, true)]);
    expect(unit(attack, 1).attackMove).toBe(true);
    expect(unit(walk, 1).attackMove).toBe(false);
    expect(attack.bodies.map(({ x, z }) => ({ x, z }))).toEqual(
      walk.bodies.map(({ x, z }) => ({ x, z })),
    );
  });
});

describe('line and hold', () => {
  it('sends one unit to the point, and it holds there', () => {
    const game = openGame();
    step(game, [move([2], -20, 40)]);
    run(game, 200);
    const sniper = unit(game, 2);
    expect(sniper.hold).toBe(true);
    expect(sniper.dest).toBeNull();
    expect(distance(sniper, { x: -20, z: 40 })).toBeLessThan(MOVEMENT.arriveDistance + 0.5);
    const { x, z } = sniper;
    run(game, 100);
    expect(sniper.x).toBeCloseTo(x, 9);
    expect(sniper.z).toBeCloseTo(z, 9);
  });

  it('spreads several units along a line across their path', () => {
    const game = openGame();
    step(game, [move([1, 3], 20, 30)]);
    const fighter = unit(game, 1).dest;
    const healer = unit(game, 3).dest;
    if (!fighter || !healer) throw new Error('No destinations.');
    expect(distance(fighter, healer)).toBeCloseTo(MOVEMENT.lineSpacing, 9);
    expect(distance({ x: 20, z: 30 }, fighter)).toBeCloseTo(MOVEMENT.lineSpacing / 2, 9);
  });

  it('leaves the triangle alone, so the others stay in their slots', () => {
    const game = openGame();
    const { anchor, heading } = game;
    step(game, [move([2], -20, 40)]);
    expect(game.anchor).toBe(anchor);
    expect(game.heading).toBe(heading);
    expect(unit(game, 1).hold).toBe(false);
  });

  it('lets an idle unit with no hold walk back to its slot', () => {
    const game = openGame();
    const fighter = unit(game, 1);
    fighter.x -= 10;
    run(game, 60);
    const slot = triangleSlot(0, game.anchor, game.heading);
    expect(distance(fighter, slot)).toBeLessThanOrEqual(MOVEMENT.slotReturnDistance);
  });
});

describe('regroup', () => {
  it('releases holds and forms the triangle at the centre of the living', () => {
    const game = openGame();
    step(game, [move([2], -20, 40)]);
    run(game, 200);
    const centre = {
      x: game.bodies.reduce((sum, member) => sum + member.x, 0) / 3,
      z: game.bodies.reduce((sum, member) => sum + member.z, 0) / 3,
    };
    const events = step(game, [{ type: 'regroup' }]);
    expect(events[0]).toMatchObject({ type: 'order-accepted', order: 'regroup' });
    expect(game.anchor.x).toBeCloseTo(centre.x, 9);
    expect(game.anchor.z).toBeCloseTo(centre.z, 9);
    expect(game.bodies.every((member) => !member.hold)).toBe(true);
    run(game, 150);
    for (const member of game.bodies) {
      const slot = triangleSlot(placeOf(game, member.id), game.anchor, game.heading);
      expect(distance(member, slot)).toBeLessThan(MOVEMENT.slotReturnDistance);
    }
  });

  it('skips the fallen', () => {
    const game = openGame();
    unit(game, 2).alive = false;
    applyCommands(game, [{ type: 'regroup' }]);
    expect(game.anchor.x).toBeCloseTo((unit(game, 1).x + unit(game, 3).x) / 2, 9);
    expect(game.anchor.z).toBeCloseTo((unit(game, 1).z + unit(game, 3).z) / 2, 9);
  });
});

describe('scatter', () => {
  it('dashes each unit away from the centre, then holds', () => {
    const game = openGame();
    const before = game.bodies.map(({ x, z }) => ({ x, z }));
    step(game, [{ type: 'scatter' }]);
    run(game, 40);
    const centre = { x: 0, z: (62 + 66.2 * 2) / 3 };
    game.bodies.forEach((member, index) => {
      const start = before[index];
      if (!start) throw new Error('No start.');
      expect(distance(member, centre)).toBeGreaterThan(distance(start, centre) + 9);
      expect(member.hold).toBe(true);
      expect(member.dest).toBeNull();
    });
  });

  it('dashes for a set distance in whole ticks', () => {
    const game = openGame();
    const fighter = unit(game, 1);
    const { z } = fighter;
    step(game, [{ type: 'scatter' }]);
    run(game, 20);
    expect(z - fighter.z).toBeCloseTo((SCATTER.dashSpeed / 30) * 9, 9);
  });

  it('gives units with no direction of their own a spread of directions', () => {
    const game = openGame();
    for (const member of game.bodies) {
      member.x = 10;
      member.z = 30;
    }
    step(game, [{ type: 'scatter' }]);
    const directions = game.bodies.map((member) => `${String(member.dashX)},${String(member.dashZ)}`);
    expect(new Set(directions).size).toBe(3);
  });

  it('has a cooldown, and can be used again once it ends', () => {
    const game = openGame();
    expect(step(game, [{ type: 'scatter' }])[0]).toMatchObject({ type: 'order-accepted' });
    expect(game.scatterCooldownTicks).toBe(149);
    expect(step(game, [{ type: 'scatter' }])[0]).toMatchObject({
      type: 'order-refused',
      reason: 'on-cooldown',
    });
    run(game, 148);
    expect(game.scatterCooldownTicks).toBe(0);
    expect(step(game, [{ type: 'scatter' }])[0]).toMatchObject({ type: 'order-accepted' });
  });

  it('sets the invulnerability timer, which counts down', () => {
    const game = openGame();
    step(game, [{ type: 'scatter' }]);
    expect(unit(game, 1).invulnerableTicks).toBe(13);
    run(game, 13);
    expect(unit(game, 1).invulnerableTicks).toBe(0);
  });

  it('holds until regrouped', () => {
    const game = openGame();
    step(game, [{ type: 'scatter' }]);
    run(game, 60);
    step(game, [{ type: 'regroup' }]);
    run(game, 150);
    for (const member of game.bodies) {
      const slot = triangleSlot(placeOf(game, member.id), game.anchor, game.heading);
      expect(distance(member, slot)).toBeLessThan(MOVEMENT.slotReturnDistance);
    }
  });
});

describe('off-land points', () => {
  it('leaves a walkable point alone', () => {
    expect(pullOntoLand(openGame(), 10, 20)).toEqual({ x: 10, z: 20 });
  });

  it('moves a point off the land to the nearest walkable cell', () => {
    const game = openGame();
    const point = pullOntoLand(game, 300, 400);
    expect(isWalkable(game, point.x, point.z)).toBe(true);
    const coast = coastDistanceAt(TEST_ISLAND, point.x, point.z);
    expect(coast).toBeLessThan(0.9);
    expect(coast).toBeGreaterThan(0.85);
  });

  it('applies to orders, and the squad stays on the land', () => {
    const game = openGame();
    const events = step(game, [move(ALL, 0, 500)]);
    expect(events[0]).toMatchObject({ type: 'order-accepted' });
    expect(game.anchor).toEqual(pullOntoLand(game, 0, 500));
    run(game, 200);
    for (const member of game.bodies) {
      // Cells are a unit across, so a unit may stand a little past the 0.9 line.
      expect(coastDistanceAt(TEST_ISLAND, member.x, member.z)).toBeLessThan(0.92);
    }
  });
});

describe('obstacles and other units', () => {
  it('route a unit around a rock in its path', () => {
    // Just off the straight line, so the unit goes round one side.
    const game = openGame([{ kind: 'rock', x: 0.4, z: 40, radius: 2 }]);
    const fighter = unit(game, 1);
    fighter.x = 0;
    fighter.z = 50;
    step(game, [move([1], 0, 30)]);
    let widest = 0;
    for (let tick = 0; tick < 90; tick += 1) {
      advance(game);
      expect(Math.hypot(fighter.x - 0.4, fighter.z - 40)).toBeGreaterThanOrEqual(2.7 - 1e-9);
      widest = Math.max(widest, Math.abs(fighter.x));
    }
    expect(widest).toBeGreaterThan(1.5);
    expect(fighter.z).toBeLessThan(31);
  });

  it('move a destination inside an obstacle to the nearest walkable cell, and arrive there', () => {
    const game = openGame([{ kind: 'beacon', x: 0, z: 30, radius: 4.2 }]);
    const events = step(game, [move([1], 0, 30)]);
    const fighter = unit(game, 1);
    const dest = fighter.dest ?? { x: 0, z: 0 };
    expect(isWalkable(game, dest.x, dest.z)).toBe(true);
    expect(distance(dest, { x: 0, z: 30 })).toBeLessThan(4.2 + MOVEMENT.unitRadius + 1);
    events.push(...run(game, 120));
    expect(events.some((event) => event.type === 'unit-gave-up')).toBe(false);
    expect(events.filter((event) => event.type === 'unit-arrived')).toEqual([
      expect.objectContaining({ unitId: 1 }),
    ]);
  });

  it('give up at once on a destination with no route, and report it', () => {
    // A ring of rocks with open ground inside, which nothing outside can reach.
    const ring: Obstacle[] = Array.from({ length: 24 }, (_, index) => {
      const angle = (index / 24) * 2 * Math.PI;
      return { kind: 'rock', x: Math.cos(angle) * 8, z: 30 + Math.sin(angle) * 8, radius: 2 };
    });
    const game = openGame(ring);
    expect(isWalkable(game, 0, 30)).toBe(true);
    const events = step(game, [move([1], 0, 30)]);
    expect(events).toContainEqual({ type: 'unit-gave-up', tick: 0, unitId: 1 });
    const fighter = unit(game, 1);
    expect(fighter.dest).toBeNull();
    expect(fighter.attackMove).toBe(false);
  });

  it('give up 22 ticks after the last progress along the route', () => {
    const game = openGame();
    const fighter = unit(game, 1);
    const events = step(game, [move([1], 0, 20)]);
    // Something holds the unit where it is, so it never gets closer.
    for (let tick = 0; tick < 40; tick += 1) {
      Object.assign(fighter, { x: 0, z: 62 });
      events.push(...advance(game));
    }
    expect(events.find((event) => event.type === 'unit-gave-up')).toMatchObject({ tick: 22 });
  });

  it('walks well past 8 units with no false give-up, which is the 30-tick result', () => {
    const game = openGame();
    const events = step(game, [move([1], 0, 20)]);
    events.push(...run(game, 150));
    expect(events.some((event) => event.type === 'unit-gave-up')).toBe(false);
    expect(events.filter((event) => event.type === 'unit-arrived')).toEqual([
      expect.objectContaining({ unitId: 1 }),
    ]);
    expect(distance(unit(game, 1), { x: 0, z: 20 })).toBeLessThan(MOVEMENT.arriveDistance);
  });

  it('walk at their class speed', () => {
    const game = openGame();
    const fighter = unit(game, 1);
    const { z } = fighter;
    step(game, [move([1], 0, 20)]);
    run(game, 29);
    expect(z - fighter.z).toBeCloseTo(11, 6);
  });

  it('push units apart when they overlap', () => {
    const game = openGame();
    const [first, second] = game.bodies;
    if (!first || !second) throw new Error('No units.');
    Object.assign(first, { x: 0, z: 30, hold: true });
    Object.assign(second, { x: 1, z: 30, hold: true });
    run(game, 60);
    expect(distance(first, second)).toBeGreaterThan(MOVEMENT.unitSpacing - 0.05);
  });
});

describe('refused orders', () => {
  it('refuses a unit that does not exist, a bad point, and an empty or fallen group', () => {
    const game = openGame();
    expect(applyCommands(game, [move([9], 0, 30)])[0]).toMatchObject({
      type: 'order-refused',
      reason: 'unknown-unit',
    });
    expect(applyCommands(game, [move(ALL, NaN, 30)])[0]).toMatchObject({ reason: 'bad-point' });
    expect(applyCommands(game, [move([], 0, 30)])[0]).toMatchObject({ reason: 'no-living-units' });
    unit(game, 1).alive = false;
    expect(applyCommands(game, [move([1], 0, 30)])[0]).toMatchObject({ reason: 'no-living-units' });
  });

  it('refuses orders when nobody is left', () => {
    const game = openGame();
    for (const member of game.bodies) {
      member.alive = false;
    }
    const events = applyCommands(game, [{ type: 'regroup' }, { type: 'scatter' }]);
    expect(events.map((event) => event.type === 'order-refused' && event.reason)).toEqual([
      'no-living-units',
      'no-living-units',
    ]);
    expect(Number.isFinite(game.anchor.x)).toBe(true);
  });

  it('does not count one unit named twice as the whole squad', () => {
    const game = openGame();
    step(game, [move([1, 1, 2], 0, 30)]);
    expect(unit(game, 1).hold).toBe(true);
  });
});

describe('order of play', () => {
  it('applies commands with no time passing, in list order', () => {
    const game = openGame();
    const events = applyCommands(game, [move([1], 0, 30), { type: 'regroup' }]);
    expect(game.tick).toBe(0);
    expect(events.map((event) => event.type)).toEqual(['order-accepted', 'order-accepted']);
    expect(unit(game, 1).hold).toBe(false);
  });

  it('updates units in ID order, so an earlier unit moves first', () => {
    const game = openGame();
    const [first, second] = game.bodies;
    if (!first || !second) throw new Error('No units.');
    Object.assign(first, { x: 0, z: 30, hold: true });
    Object.assign(second, { x: 1, z: 30, hold: true });
    advance(game);
    // The first unit pushes off the second's old spot, a gap of 1. The second then
    // pushes off the first's new spot, a gap of 1.16, so it moves less.
    expect(first.x).toBeCloseTo(-0.16, 9);
    expect(second.x).toBeCloseTo(1.128, 9);
  });
});
