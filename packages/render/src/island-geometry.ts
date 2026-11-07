import type { IslandData, IslandMesh } from '@new-frontier/core';
import { BufferGeometry, Color, Float32BufferAttribute } from 'three';

const LOWLAND = new Color(0x5f7f47);
const HIGHLAND = new Color(0xa5ae5e);
const ROCK = new Color(0x7c786c);

/** Below this height, relative to ground level, land shows as bare rock. */
const ROCK_LINE = -0.75;

/** Turns the core's plain mesh into three.js geometry, adding colour by height. */
export function buildIslandGeometry(island: IslandData, mesh: IslandMesh): BufferGeometry {
  const { groundLevel, height } = island.relief;
  const colours: number[] = [];
  const colour = new Color();

  for (let index = 1; index < mesh.positions.length; index += 3) {
    const above = (mesh.positions[index] ?? 0) - groundLevel;
    if (above < ROCK_LINE) {
      colour.copy(ROCK);
    } else {
      colour.copy(LOWLAND).lerp(HIGHLAND, Math.min(Math.max(above / height + 0.5, 0), 1));
    }
    colours.push(colour.r, colour.g, colour.b);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(mesh.positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colours, 3));
  geometry.setIndex([...mesh.indices]);
  geometry.computeVertexNormals();
  return geometry;
}
