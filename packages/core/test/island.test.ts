import { describe, expect, it } from 'vitest';
import { TEST_ISLAND } from '../data/island';
import { buildIslandMesh, coastDistanceAt, groundHeightAt, rimRadiusAt } from '../src/island';

const { radius, mesh, skirt, relief } = TEST_ISLAND;

describe('island shape', () => {
  it('matches the squad test', () => {
    // Expected values come from running the prototype's own formulas.
    expect(rimRadiusAt(TEST_ISLAND, 0)).toBeCloseTo(104.46737869, 6);
    expect(rimRadiusAt(TEST_ISLAND, 2)).toBeCloseTo(96.46696002, 6);
    expect(rimRadiusAt(TEST_ISLAND, 4.5)).toBeCloseTo(93.86958401, 6);
    expect(groundHeightAt(TEST_ISLAND, 0, 0)).toBeCloseTo(2.86053136, 6);
    expect(groundHeightAt(TEST_ISLAND, 20, -35)).toBeCloseTo(3.45106939, 6);
    expect(groundHeightAt(TEST_ISLAND, -50, 10)).toBeCloseTo(3.11541751, 6);
  });

  it('keeps the coast within the sum of its waves', () => {
    const swing = TEST_ISLAND.rimWaves.reduce((sum, wave) => sum + wave.amplitude, 0);
    for (let step = 0; step < 360; step += 1) {
      const rim = rimRadiusAt(TEST_ISLAND, (step / 360) * 2 * Math.PI);
      expect(rim).toBeGreaterThanOrEqual(radius * (1 - swing));
      expect(rim).toBeLessThanOrEqual(radius * (1 + swing));
    }
  });

  it('measures 0 at the centre and 1 on the coast', () => {
    expect(coastDistanceAt(TEST_ISLAND, TEST_ISLAND.x, TEST_ISLAND.z)).toBe(0);
    const rim = rimRadiusAt(TEST_ISLAND, 1);
    expect(coastDistanceAt(TEST_ISLAND, Math.cos(1) * rim, Math.sin(1) * rim)).toBeCloseTo(1);
  });

  it('keeps walkable ground above the sea and within its hills', () => {
    for (let x = -60; x <= 60; x += 10) {
      for (let z = -60; z <= 60; z += 10) {
        const height = groundHeightAt(TEST_ISLAND, x, z);
        expect(height).toBeGreaterThan(0);
        expect(Math.abs(height - relief.groundLevel)).toBeLessThanOrEqual(relief.height);
      }
    }
  });

  it('flattens the land to ground level at the coast', () => {
    const rim = rimRadiusAt(TEST_ISLAND, 0);
    expect(groundHeightAt(TEST_ISLAND, rim, 0)).toBeCloseTo(relief.groundLevel);
  });
});

describe('island mesh', () => {
  const { positions, indices } = buildIslandMesh(TEST_ISLAND);
  const vertexCount = positions.length / 3;
  const heights = positions.filter((_, index) => index % 3 === 1);

  it('has one vertex for every ring and segment', () => {
    expect(vertexCount).toBe((mesh.rings + skirt.rings + 1) * mesh.segments);
  });

  it('uses only real vertices and finite numbers', () => {
    expect(positions.every(Number.isFinite)).toBe(true);
    expect(indices.length % 3).toBe(0);
    expect(Math.max(...indices)).toBe(vertexCount - 1);
    expect(Math.min(...indices)).toBe(0);
  });

  it('rises above the sea and reaches below it', () => {
    expect(Math.max(...heights)).toBeGreaterThan(relief.groundLevel);
    expect(Math.min(...heights)).toBeLessThan(-skirt.depth / 2);
  });

  it('is the same every time', () => {
    expect(buildIslandMesh(TEST_ISLAND)).toEqual({ positions, indices });
  });
});
