import { MOVEMENT } from '../data/movement';
import { ZONES } from '../data/zones';
import { TAU, coastDistanceAt, rimRadiusAt, type IslandData } from './island';
import { randomBetween } from './random';
import type { GameState, Obstacle, ObstacleKind, Point, ZoneState } from './state';

export interface ObstacleGroup {
  readonly kind: ObstacleKind;
  readonly count: number;
  readonly minScale: number;
  readonly maxScale: number;
  readonly radiusPerScale: number;
}

export interface ZoneData {
  readonly id: string;
  readonly island: IslandData;
  /** Share of the way to the coast where walkable ground ends. */
  readonly walkableEdge: number;
  /** The same for enemies, which stay a little further from the sea. */
  readonly enemyEdge: number;
  /** Share of the way to the coast that an off-land point is pulled in to. */
  readonly offLandPull: number;
  readonly anvil: Point;
  readonly fixedObstacles: readonly Obstacle[];
  readonly obstacleGroups: readonly ObstacleGroup[];
  readonly placement: {
    /** Squared, so that obstacles spread evenly over the area. */
    readonly minCoastDistanceSquared: number;
    readonly maxCoastDistanceSquared: number;
    readonly triesPerObstacle: number;
    /** Clear ground kept between obstacles, so that no unit can wedge between two. */
    readonly minGap: number;
  };
  /** Circles kept free of placed obstacles. */
  readonly clearings: readonly (Point & { readonly radius: number })[];
}

function isClear(zone: ZoneData, x: number, z: number): boolean {
  return zone.clearings.every((clearing) => {
    return Math.hypot(clearing.x - x, clearing.z - z) >= clearing.radius;
  });
}

function hasRoom(obstacle: Obstacle, others: readonly Obstacle[], minGap: number): boolean {
  return others.every((other) => {
    const distance = Math.hypot(other.x - obstacle.x, other.z - obstacle.z);
    return distance - other.radius - obstacle.radius >= minGap;
  });
}

function placeGroup(
  state: GameState,
  zone: ZoneData,
  group: ObstacleGroup,
  obstacles: Obstacle[],
): void {
  const { island, placement } = zone;
  const maxTries = group.count * placement.triesPerObstacle;
  let placed = 0;
  for (let tries = 0; placed < group.count && tries < maxTries; tries += 1) {
    const angle = randomBetween(state, 0, TAU);
    const share = Math.sqrt(
      randomBetween(state, placement.minCoastDistanceSquared, placement.maxCoastDistanceSquared),
    );
    const radius = rimRadiusAt(island, angle) * share;
    const x = island.x + Math.cos(angle) * radius;
    const z = island.z + Math.sin(angle) * radius;
    if (isClear(zone, x, z)) {
      const scale = randomBetween(state, group.minScale, group.maxScale);
      const obstacle = { kind: group.kind, x, z, radius: group.radiusPerScale * scale };
      if (hasRoom(obstacle, obstacles, placement.minGap)) {
        obstacles.push(obstacle);
        placed += 1;
      }
    }
  }
}

/** Lays out every zone from the generator, so the seed decides the world. */
export function buildZones(state: GameState): ZoneState[] {
  return ZONES.map((zone) => {
    const obstacles = [...zone.fixedObstacles];
    for (const group of zone.obstacleGroups) {
      placeGroup(state, zone, group, obstacles);
    }
    return { id: zone.id, obstacles };
  });
}

export function isWalkable(x: number, z: number): boolean {
  return ZONES.some((zone) => coastDistanceAt(zone.island, x, z) < zone.walkableEdge);
}

export function isWalkableForEnemy(x: number, z: number): boolean {
  return ZONES.some((zone) => coastDistanceAt(zone.island, x, z) < zone.enemyEdge);
}

function nearestZone(x: number, z: number): ZoneData {
  return ZONES.reduce((best, zone) =>
    coastDistanceAt(zone.island, x, z) < coastDistanceAt(best.island, x, z) ? zone : best,
  );
}

/** Moves a point that is off the land to just inside the coast, on the same line from the centre. */
export function pullOntoLand(x: number, z: number): Point {
  if (isWalkable(x, z)) {
    return { x, z };
  }
  const { island, offLandPull } = nearestZone(x, z);
  const angle = Math.atan2(z - island.z, x - island.x);
  const radius = rimRadiusAt(island, angle) * offLandPull;
  return { x: island.x + Math.cos(angle) * radius, z: island.z + Math.sin(angle) * radius };
}

/** Moves a body to the edge of any obstacle it has walked into, which makes it slide round. */
export function pushOutOfObstacles(
  state: GameState,
  body: { x: number; z: number },
  radius: number,
): void {
  for (const zone of state.zones) {
    for (const obstacle of zone.obstacles) {
      const dx = body.x - obstacle.x;
      const dz = body.z - obstacle.z;
      const distance = Math.hypot(dx, dz);
      const reach = obstacle.radius + radius;
      if (distance < reach && distance > MOVEMENT.minObstacleDistance) {
        body.x = obstacle.x + (dx / distance) * reach;
        body.z = obstacle.z + (dz / distance) * reach;
      }
    }
  }
}
