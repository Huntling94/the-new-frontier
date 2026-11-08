import { COLOSSE_LAKE, COLOSSE_SCENARIO, createGame, currentZone, hashState, step } from '@new-frontier/core';
import { describe, expect, it } from 'vitest';
import { insideRing, landHeight, UNDER_FLOOR, type BasinPlan } from '../src/basin-shape';
import { ZoneScene } from '../src/zone-scene';

function plan(): { readonly shape: BasinPlan; readonly ground: Extract<ReturnType<typeof currentZone>['ground'], { shape: 'basin' }> } {
  const { ground } = currentZone(createGame(1, COLOSSE_SCENARIO));
  if (ground.shape !== 'basin') throw new Error('Carrefour du Colosse is not a basin.');
  return { ground, shape: { outline: ground.outline, lake: COLOSSE_LAKE, water: [], passes: [] } };
}

describe('the land round a basin (M1 decision 5)', () => {
  it('stays under the floor everywhere inside the outline, so nothing can clip a character', () => {
    const { ground, shape } = plan();
    let checked = 0;
    for (let z = ground.bounds.minZ; z < ground.bounds.maxZ; z += 1.5) {
      for (let x = ground.bounds.minX; x < ground.bounds.maxX; x += 1.5) {
        if (!insideRing(x, z, ground.outline)) continue;
        expect(landHeight(shape, x, z)).toBe(UNDER_FLOOR);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(4000);
  });

  it('is highest beside the lake and lower to the south', () => {
    const { shape } = plan();
    const highest = (z: number): number => {
      let top = 0;
      for (let x = -115; x <= 115; x += 2) top = Math.max(top, landHeight(shape, x, z));
      return top;
    };
    expect(highest(-85)).toBeGreaterThan(highest(100));
  });

  it('dips below the floor under the lake', () => {
    const { shape } = plan();
    expect(landHeight(shape, 10, -100)).toBeLessThan(0);
  });
});

describe('the basin scene', () => {
  it('builds and is freed, and changes no rule, event or tick', () => {
    const drawn = createGame(9, COLOSSE_SCENARIO);
    const plain = createGame(9, COLOSSE_SCENARIO);
    const scene = new ZoneScene(drawn, currentZone(drawn));
    scene.update(1 / 60, { x: 100, z: 9 }, { x: 100, z: 9 });
    expect(scene.scene.children.length).toBeGreaterThan(5);
    scene.dispose();
    for (let tick = 0; tick < 120; tick += 1) {
      step(drawn, []);
      step(plain, []);
    }
    expect(hashState(drawn)).toBe(hashState(plain));
  });
});
