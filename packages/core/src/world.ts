import { MOVEMENT } from '../data/movement';
import { ZONES } from '../data/zones';
import { buildGrid, isOpen, isOpenForEnemy, nearestOpen, type Box, type GroundShape, type Grid } from './grid';
import type { IslandData } from './island';
import type { GameState, GameView, Obstacle, Point, Requirement, ZoneContents } from './state';

export type ZoneKind = 'field' | 'dungeon' | 'town';

/**
 * A zone's ground: an island with a noisy coast, a rectangle with walls (S3a decision 5),
 * or a town's streets and open places (S3d decision 1).
 */
export type Ground =
  | (GroundShape & { readonly shape: 'island'; readonly island: IslandData })
  | (GroundShape & {
      readonly shape: 'walled' | 'streets';
      /** Height of the floor. */
      readonly level: number;
    });

/**
 * A place kept for a later system, such as the smithy (S3d decision 1). Its building is
 * drawn by `render` only; the rules hold where its door is and which way it faces.
 */
export interface Lot {
  readonly id: string;
  /** A walkable point at the door, where the system's townsperson will stand. */
  readonly door: Point;
  /** The way the door faces, out into the street. */
  readonly facing: number;
}

/** Gates hold requirements in the shared shape, which nothing checks for gates yet. */
export type { Requirement };

export interface Cost {
  readonly kind: 'marks';
  readonly amount: number;
}

/** A way out of a zone. A two-way link is two gates (D-021). */
export interface GateData {
  readonly id: string;
  /** A character arriving inside this circle on an order takes the squad through. */
  readonly area: Point & { readonly radius: number };
  /** The zone it arrives in, and where the triangle stands there. */
  readonly to: string;
  readonly arrival: Point;
  readonly heading: number;
  readonly requires: readonly Requirement[];
  readonly cost: readonly Cost[];
}

/** One zone's definition (D-021, D-022). Each zone has its own coordinates. */
export interface ZoneData {
  readonly id: string;
  readonly kind: ZoneKind;
  /** Where the zone sits in the shared world frame. Rules ignore it for now (decision 11). */
  readonly place: Point;
  readonly ground: Ground;
  /** Where the squad gets up after a wipe in this zone. */
  readonly camp: Point & { readonly heading: number };
  readonly anvil: Point | null;
  readonly obstacles: readonly Obstacle[];
  readonly contents: ZoneContents;
  /** How long a cleared pack takes to come back, on the game clock. */
  readonly packRespawnSeconds: number;
  readonly gates: readonly GateData[];
  /** Places kept for systems to come. Only towns have any. */
  readonly lots: readonly Lot[];
}

export function zoneData(id: string, zones: readonly ZoneData[] = ZONES): ZoneData {
  const zone = zones.find((candidate) => candidate.id === id);
  if (!zone) {
    throw new Error(`No zone is called ${id}.`);
  }
  return zone;
}

/** The zone that runs. */
export function zoneOf(state: GameView): ZoneData {
  return zoneData(state.zoneId);
}

/** What the zone holds, or a test scenario's replacement. */
export function contentsOf(state: GameView, zoneId: string = state.zoneId): ZoneContents {
  const record = state.records.find(({ id }) => id === zoneId);
  return record?.contents ?? zoneData(zoneId).contents;
}

export function obstaclesOf(state: GameView): readonly Obstacle[] {
  return contentsOf(state).obstacles ?? zoneOf(state).obstacles;
}

/** Grids are built the first time a zone runs, and kept, but never saved (decision 6). */
const grids = new WeakMap<ZoneData, WeakMap<readonly Obstacle[], Grid>>();

export function gridFor(zone: ZoneData, obstacles: readonly Obstacle[] = zone.obstacles): Grid {
  let byObstacles = grids.get(zone);
  if (!byObstacles) {
    byObstacles = new WeakMap();
    grids.set(zone, byObstacles);
  }
  let grid = byObstacles.get(obstacles);
  if (!grid) {
    grid = buildGrid(zone.ground, obstacles);
    byObstacles.set(obstacles, grid);
  }
  return grid;
}

/** The grid of the zone that runs. */
export function gridOf(state: GameView): Grid {
  return gridFor(zoneOf(state), obstaclesOf(state));
}

export function isWalkable(state: GameView, x: number, z: number): boolean {
  return isOpen(gridOf(state), x, z);
}

export function isWalkableForEnemy(state: GameView, x: number, z: number): boolean {
  return isOpenForEnemy(gridOf(state), x, z);
}

/** Moves a point that cannot be walked to the nearest point that can. */
export function pullOntoLand(state: GameView, x: number, z: number): Point {
  return nearestOpen(gridOf(state), { x, z });
}

function pushOutOfBox(body: { x: number; z: number }, box: Box, radius: number): void {
  const left = body.x - (box.minX - radius);
  const right = box.maxX + radius - body.x;
  const top = body.z - (box.minZ - radius);
  const bottom = box.maxZ + radius - body.z;
  const least = Math.min(left, right, top, bottom);
  if (least <= 0) {
    return;
  }
  if (least === left) body.x -= left;
  else if (least === right) body.x += right;
  else if (least === top) body.z -= top;
  else body.z += bottom;
}

/** Moves a body to the edge of any obstacle or wall it has walked into, which makes it slide round. */
export function pushOutOfObstacles(
  state: GameState,
  body: { x: number; z: number },
  radius: number,
): void {
  for (const obstacle of obstaclesOf(state)) {
    const dx = body.x - obstacle.x;
    const dz = body.z - obstacle.z;
    const distance = Math.hypot(dx, dz);
    const reach = obstacle.radius + radius;
    if (distance < reach && distance > MOVEMENT.minObstacleDistance) {
      body.x = obstacle.x + (dx / distance) * reach;
      body.z = obstacle.z + (dz / distance) * reach;
    }
  }
  const { ground } = zoneOf(state);
  if (ground.shape === 'walled') {
    for (const wall of ground.walls) {
      pushOutOfBox(body, wall, radius);
    }
  }
}

/** The gate whose area holds a point, if any. */
export function gateAt(state: GameView, point: Point): ZoneData['gates'][number] | null {
  return (
    zoneOf(state).gates.find(({ area }) => {
      return Math.hypot(point.x - area.x, point.z - area.z) < area.radius;
    }) ?? null
  );
}
