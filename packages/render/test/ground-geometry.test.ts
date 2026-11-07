import { buildIslandMesh, createGame, currentZone, ISLAND_SCENARIO } from '@new-frontier/core';
import { describe, expect, it } from 'vitest';
import { buildGroundGeometry } from '../src/ground-geometry';
import { zoneLook } from '../src/looks';

describe('ground geometry', () => {
  const zone = currentZone(createGame(1, ISLAND_SCENARIO));
  const mesh = buildIslandMesh(zone.ground);
  const geometry = buildGroundGeometry(zone.ground, mesh, zoneLook(zone.id));

  it('keeps every vertex and triangle from the core', () => {
    expect(Array.from(geometry.getAttribute('position').array)).toEqual(
      mesh.positions.map(Math.fround),
    );
    expect(geometry.getIndex()?.count).toBe(mesh.indices.length);
  });

  it('gives each vertex a colour and a usable normal', () => {
    const vertices = mesh.positions.length / 3;
    expect(geometry.getAttribute('color').count).toBe(vertices);
    expect(geometry.getAttribute('normal').count).toBe(vertices);
    expect(Array.from(geometry.getAttribute('normal').array).every(Number.isFinite)).toBe(true);
  });

  it('colours land and rock differently', () => {
    const { array } = geometry.getAttribute('color');
    const colours = new Set<string>();
    for (let index = 0; index < array.length; index += 3) {
      colours.add(`${array[index]},${array[index + 1]},${array[index + 2]}`);
    }
    expect(colours.size).toBeGreaterThan(2);
  });
});
