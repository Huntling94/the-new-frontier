import { randomBetween, rimRadiusAt, ZONES, type Obstacle, type ObstacleKind } from '@new-frontier/core';

/**
 * Lays out Lande de Montclaire's standing stones and rocks once, from a seed, so the
 * result can be baked into a data file and committed (D-022). This is the generator
 * every seed used to run, with the same values, so seed 1 gives the layout it always did.
 */

interface ObstacleGroup {
  readonly kind: ObstacleKind;
  readonly count: number;
  readonly minScale: number;
  readonly maxScale: number;
  readonly radiusPerScale: number;
}

const RECIPE = {
  zone: 'lande',
  seed: 1,
  /** The squad test's trees, now standing stones of the same sizes. */
  groups: [
    { kind: 'stone', count: 60, minScale: 0.8, maxScale: 1.35, radiusPerScale: 1.25 },
    { kind: 'rock', count: 34, minScale: 0.7, maxScale: 2, radiusPerScale: 1.3 },
  ] as readonly ObstacleGroup[],
  /** Squared, so that obstacles spread evenly over the area. */
  minCoastDistanceSquared: 0.04,
  maxCoastDistanceSquared: 0.68,
  triesPerObstacle: 8,
  /** Clear ground kept between obstacles, so that no unit can wedge between two. */
  minGap: 1.8,
  /** Circles kept free: the boss's clearing and the camp. */
  clearings: [
    { x: 0, z: 0, radius: 34 },
    { x: 0, z: 68, radius: 20 },
  ],
};

/** Kinds placed by hand, which the layout keeps its distance from. */
const BAKED: readonly ObstacleKind[] = ['stone', 'rock'];

function hasRoom(obstacle: Obstacle, others: readonly Obstacle[]): boolean {
  return others.every((other) => {
    const distance = Math.hypot(other.x - obstacle.x, other.z - obstacle.z);
    return distance - other.radius - obstacle.radius >= RECIPE.minGap;
  });
}

function isClear(x: number, z: number): boolean {
  return RECIPE.clearings.every((clearing) => Math.hypot(clearing.x - x, clearing.z - z) >= clearing.radius);
}

/** The placed obstacles, without the fixed ones they keep clear of. */
export function bakeLayout(): Obstacle[] {
  const zone = ZONES.find(({ id }) => id === RECIPE.zone);
  if (!zone || zone.ground.shape !== 'island') {
    throw new Error(`${RECIPE.zone} is not an island.`);
  }
  const { island } = zone.ground;
  const generator = { rng: RECIPE.seed >>> 0 };
  const obstacles: Obstacle[] = zone.obstacles.filter(({ kind }) => !BAKED.includes(kind));
  const fixed = obstacles.length;
  for (const group of RECIPE.groups) {
    const maxTries = group.count * RECIPE.triesPerObstacle;
    let placed = 0;
    for (let tries = 0; placed < group.count && tries < maxTries; tries += 1) {
      const angle = randomBetween(generator, 0, 2 * Math.PI);
      const share = Math.sqrt(
        randomBetween(generator, RECIPE.minCoastDistanceSquared, RECIPE.maxCoastDistanceSquared),
      );
      const radius = rimRadiusAt(island, angle) * share;
      const x = island.x + Math.cos(angle) * radius;
      const z = island.z + Math.sin(angle) * radius;
      if (isClear(x, z)) {
        const scale = randomBetween(generator, group.minScale, group.maxScale);
        const obstacle = { kind: group.kind, x, z, radius: group.radiusPerScale * scale };
        if (hasRoom(obstacle, obstacles)) {
          obstacles.push(obstacle);
          placed += 1;
        }
      }
    }
  }
  return obstacles.slice(fixed);
}

/** The data file, as committed. Numbers keep every digit, so the layout is exact. */
export function layoutFile(obstacles: readonly Obstacle[]): string {
  const lines = obstacles.map(({ kind, x, z, radius }) => {
    return `  { kind: '${kind}', x: ${String(x)}, z: ${String(z)}, radius: ${String(radius)} },`;
  });
  return [
    "import type { Obstacle } from '../src/state';",
    '',
    '/**',
    " * Lande de Montclaire's standing stones and rocks, baked from seed 1 by `pnpm bake`",
    ' * (D-022). Do not edit by hand: change the recipe in `packages/tools/src/bake.ts`',
    ' * and bake again, so every change to the world shows in a diff.',
    ' */',
    'export const LANDE_LAYOUT: readonly Obstacle[] = [',
    ...lines,
    '];',
    '',
  ].join('\n');
}
