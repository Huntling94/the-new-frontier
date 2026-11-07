import { coastDistanceAt, type IslandData, type IslandMesh } from '@new-frontier/core';
import { BufferGeometry, Color, Float32BufferAttribute } from 'three';
import type { ZoneLook } from './looks';

/** Past this share of the way to the coast, ground shows as rock, as in the squad test. */
const ROCK_FROM = 0.95;
/** The squad test darkens its rock, and warms cliff tops towards the grass. */
const ROCK_SHADE = 0.75;
const CLIFF_WARMTH = 0.25;
const SKIRT_WARMTH = 0.06;
/** Patches of lowland and highland colour, from the squad test's colour noise. */
const PATCH_SCALE = 0.09;
const PATCH_GAIN = 1.7;
const PATCH_SHIFT = 0.35;

function hash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function noise(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const top = hash(xi, yi) + (hash(xi + 1, yi) - hash(xi, yi)) * u;
  const bottom = hash(xi, yi + 1) + (hash(xi + 1, yi + 1) - hash(xi, yi + 1)) * u;
  return top + (bottom - top) * v;
}

/** Colour patches only. The core has its own noise for the shape of the land. */
function patches(x: number, y: number): number {
  return noise(x, y) * 0.6 + noise(x * 2.1, y * 2.1) * 0.28 + noise(x * 4.3, y * 4.3) * 0.12;
}

/** Turns the core's plain mesh into three.js geometry, coloured from the zone's palette. */
export function buildGroundGeometry(ground: IslandData, mesh: IslandMesh, look: ZoneLook): BufferGeometry {
  const lowland = new Color(look.lowland);
  const highland = new Color(look.highland);
  const rock = new Color(look.rock).multiplyScalar(ROCK_SHADE);
  const colours: number[] = [];
  const colour = new Color();

  for (let index = 0; index < mesh.positions.length; index += 3) {
    const x = mesh.positions[index] ?? 0;
    const z = mesh.positions[index + 2] ?? 0;
    const coast = coastDistanceAt(ground, x, z);
    if (coast < ROCK_FROM) {
      const share = patches(x * PATCH_SCALE, z * PATCH_SCALE) * PATCH_GAIN - PATCH_SHIFT;
      colour.copy(lowland).lerp(highland, Math.min(Math.max(share, 0), 1));
    } else {
      colour.copy(rock).lerp(highland, coast < 1 ? CLIFF_WARMTH : SKIRT_WARMTH);
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
