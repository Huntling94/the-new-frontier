import { GRID, MOVEMENT } from '../data/movement';
import { coastDistanceAt } from './island';
import type { Obstacle, Point } from './state';

/**
 * A zone's walkable ground as a grid of square cells (D-023). It is built from the
 * zone's data, never saved, and read by movement, enemies, orders, gates and routes.
 */

/** An axis-aligned box on the ground, such as a wall. */
export interface Box {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

/** A street: a centreline through a few points, so it can bend, and its width (S3d decision 1). */
export interface Street {
  readonly id: string;
  readonly points: readonly Point[];
  readonly width: number;
}

/** An open place, such as a plaza: an outline of points in order, closed back to the first. */
export interface Place {
  readonly id: string;
  readonly outline: readonly Point[];
}

/** What the grid needs from a zone's ground. */
export type GroundShape =
  | {
      readonly shape: 'island';
      readonly island: Parameters<typeof coastDistanceAt>[0];
      /** Share of the way to the coast where walkable ground ends. */
      readonly walkableEdge: number;
      /** The same for enemies, which stay a little further from the sea. */
      readonly enemyEdge: number;
    }
  | {
      readonly shape: 'walled';
      readonly bounds: Box;
      readonly walls: readonly Box[];
    }
  | {
      /** Walkable ground is every point inside a street or a place, and nothing else. */
      readonly shape: 'streets';
      readonly bounds: Box;
      readonly streets: readonly Street[];
      readonly places: readonly Place[];
    }
  | {
      /**
       * Walkable ground is every point inside the outline, minus the blocked outlines
       * and the blocked walls, each a centreline and a width (M1 decision 3). Water is
       * blocked ground. Single rocks are ordinary obstacles.
       */
      readonly shape: 'basin';
      readonly bounds: Box;
      readonly outline: readonly Point[];
      readonly blocked: readonly Place[];
      readonly walls: readonly Street[];
    };

/** A cell a character may stand in. Obstacles are grown by a character's radius. */
const OPEN = 1;
/** A cell an enemy may stand in. Enemies slide round obstacles, so only ground and walls count. */
const ENEMY_OPEN = 2;

export interface Grid {
  readonly minX: number;
  readonly minZ: number;
  readonly cols: number;
  readonly rows: number;
  readonly cell: number;
  /** One per cell, row by row: `OPEN` and `ENEMY_OPEN` as bits. */
  readonly flags: Uint8Array;
  /** The connected area each open cell belongs to, or -1. Cells in different areas have no route. */
  readonly areas: Int32Array;
  /** The same for the cells an enemy may stand in. */
  readonly enemyAreas: Int32Array;
}

function insideBox(box: Box, x: number, z: number, grow: number): boolean {
  return x > box.minX - grow && x < box.maxX + grow && z > box.minZ - grow && z < box.maxZ + grow;
}

/** How far a point is from the segment between two others. */
function segmentDistance(x: number, z: number, from: Point, to: Point): number {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const lengthSquared = dx * dx + dz * dz;
  const along = lengthSquared === 0 ? 0 : ((x - from.x) * dx + (z - from.z) * dz) / lengthSquared;
  const share = Math.min(1, Math.max(0, along));
  return Math.hypot(x - (from.x + dx * share), z - (from.z + dz * share));
}

/** How far a point is from a line through points, or from a closed outline. */
function pathDistance(points: readonly Point[], x: number, z: number, closed: boolean): number {
  let least = Infinity;
  const count = closed ? points.length : points.length - 1;
  for (let index = 0; index < count; index += 1) {
    const from = points[index];
    const to = points[(index + 1) % points.length];
    if (from && to) {
      least = Math.min(least, segmentDistance(x, z, from, to));
    }
  }
  return least;
}

/** Whether a point is inside an outline, by counting the edges a ray to the east crosses. */
function insideOutline(outline: readonly Point[], x: number, z: number): boolean {
  let inside = false;
  for (let index = 0, last = outline.length - 1; index < outline.length; last = index, index += 1) {
    const a = outline[index];
    const b = outline[last];
    if (a && b && a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Whether a character may stand at a point of a town's ground: inside a street or a
 * place, and a character's radius clear of its edge, as of a wall.
 */
function onStreets(ground: Extract<GroundShape, { shape: 'streets' }>, x: number, z: number): boolean {
  const radius = MOVEMENT.unitRadius;
  if (!insideBox(ground.bounds, x, z, -radius)) {
    return false;
  }
  const inStreet = ground.streets.some(({ points, width }) => pathDistance(points, x, z, false) < width / 2 - radius);
  return (
    inStreet ||
    ground.places.some(({ outline }) => insideOutline(outline, x, z) && pathDistance(outline, x, z, true) > radius)
  );
}

/**
 * Whether a character may stand at a point of a basin: inside its outline, a character's
 * radius clear of the edge, and clear of every blocked outline and blocked wall.
 */
function inBasin(ground: Extract<GroundShape, { shape: 'basin' }>, x: number, z: number): boolean {
  const radius = MOVEMENT.unitRadius;
  if (!insideOutline(ground.outline, x, z) || pathDistance(ground.outline, x, z, true) <= radius) {
    return false;
  }
  const inBlocked = ground.blocked.some(
    ({ outline }) => insideOutline(outline, x, z) || pathDistance(outline, x, z, true) <= radius,
  );
  return !inBlocked && !ground.walls.some(({ points, width }) => pathDistance(points, x, z, false) < width / 2 + radius);
}

function groundBounds(ground: GroundShape): Box {
  if (ground.shape !== 'island') {
    return ground.bounds;
  }
  const { island } = ground;
  const swing = island.rimWaves.reduce((sum, wave) => sum + wave.amplitude, 0);
  const reach = island.radius * (1 + swing);
  return { minX: island.x - reach, maxX: island.x + reach, minZ: island.z - reach, maxZ: island.z + reach };
}

function groundFlags(ground: GroundShape, x: number, z: number): number {
  const radius = MOVEMENT.unitRadius;
  if (ground.shape === 'island') {
    const coast = coastDistanceAt(ground.island, x, z);
    return (coast < ground.walkableEdge ? OPEN : 0) | (coast < ground.enemyEdge ? ENEMY_OPEN : 0);
  }
  if (ground.shape === 'streets') {
    return onStreets(ground, x, z) ? OPEN | ENEMY_OPEN : 0;
  }
  if (ground.shape === 'basin') {
    return inBasin(ground, x, z) ? OPEN | ENEMY_OPEN : 0;
  }
  const { bounds, walls } = ground;
  const inside = insideBox(bounds, x, z, -radius);
  const walled = walls.some((wall) => insideBox(wall, x, z, radius));
  return inside && !walled ? OPEN | ENEMY_OPEN : 0;
}

type Layout = Pick<Grid, 'minX' | 'minZ' | 'cols' | 'rows' | 'cell'>;

export function cellCentre(grid: Layout, index: number): Point {
  const col = index % grid.cols;
  const row = (index - col) / grid.cols;
  return { x: grid.minX + (col + 1 / 2) * grid.cell, z: grid.minZ + (row + 1 / 2) * grid.cell };
}

/** The cell holding a point, or -1 off the grid. */
export function cellAt(grid: Grid, x: number, z: number): number {
  const col = Math.floor((x - grid.minX) / grid.cell);
  const row = Math.floor((z - grid.minZ) / grid.cell);
  if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows) {
    return -1;
  }
  return row * grid.cols + col;
}

function isOpenCell(grid: Pick<Grid, 'flags'>, index: number): boolean {
  return index >= 0 && (grid.flags[index] ?? 0) % (OPEN + 1) === OPEN;
}

function isEnemyCell(grid: Pick<Grid, 'flags'>, index: number): boolean {
  return index >= 0 && (grid.flags[index] ?? 0) >= ENEMY_OPEN;
}

/** Which cells count as open: a character's, or an enemy's (S3i decision 4). */
type CellTest = (grid: Pick<Grid, 'flags'>, index: number) => boolean;

/** Whether a character may stand at a point. */
export function isOpen(grid: Grid, x: number, z: number): boolean {
  return isOpenCell(grid, cellAt(grid, x, z));
}

/** Whether an enemy may stand at a point. */
export function isOpenForEnemy(grid: Grid, x: number, z: number): boolean {
  return isEnemyCell(grid, cellAt(grid, x, z));
}

/** Labels each connected area of open cells, so an unreachable goal is known at once. */
function labelAreas(grid: Layout & Pick<Grid, 'flags'>, open: CellTest): Int32Array {
  const areas = new Int32Array(grid.cols * grid.rows).fill(-1);
  const steps = [-grid.cols, grid.cols, -1, 1];
  let next = 0;
  for (let start = 0; start < areas.length; start += 1) {
    if (areas[start] !== -1 || !open(grid, start)) {
      continue;
    }
    const queue = [start];
    areas[start] = next;
    for (let head = 0; head < queue.length; head += 1) {
      const index = queue[head] ?? 0;
      const col = index % grid.cols;
      for (const step of steps) {
        const other = index + step;
        const wraps = (step === -1 && col === 0) || (step === 1 && col === grid.cols - 1);
        if (!wraps && other >= 0 && other < areas.length && areas[other] === -1 && open(grid, other)) {
          areas[other] = next;
          queue.push(other);
        }
      }
    }
    next += 1;
  }
  return areas;
}

/** Builds the grid for a zone's ground and obstacles. */
export function buildGrid(ground: GroundShape, obstacles: readonly Obstacle[]): Grid {
  const { cell } = GRID;
  const bounds = groundBounds(ground);
  const cols = Math.ceil((bounds.maxX - bounds.minX) / cell);
  const rows = Math.ceil((bounds.maxZ - bounds.minZ) / cell);
  const base = { minX: bounds.minX, minZ: bounds.minZ, cols, rows, cell };
  const flags = new Uint8Array(cols * rows);
  for (let index = 0; index < flags.length; index += 1) {
    const { x, z } = cellCentre(base, index);
    flags[index] = groundFlags(ground, x, z);
  }
  // Each obstacle closes the cells within its radius plus a character's.
  for (const obstacle of obstacles) {
    const reach = obstacle.radius + MOVEMENT.unitRadius;
    const fromCol = Math.max(0, Math.floor((obstacle.x - reach - bounds.minX) / cell));
    const toCol = Math.min(cols - 1, Math.floor((obstacle.x + reach - bounds.minX) / cell));
    const fromRow = Math.max(0, Math.floor((obstacle.z - reach - bounds.minZ) / cell));
    const toRow = Math.min(rows - 1, Math.floor((obstacle.z + reach - bounds.minZ) / cell));
    for (let row = fromRow; row <= toRow; row += 1) {
      for (let col = fromCol; col <= toCol; col += 1) {
        const index = row * cols + col;
        const centre = cellCentre(base, index);
        if (Math.hypot(centre.x - obstacle.x, centre.z - obstacle.z) < reach) {
          flags[index] = (flags[index] ?? 0) & ENEMY_OPEN;
        }
      }
    }
  }
  const layout = { ...base, flags };
  return { ...layout, areas: labelAreas(layout, isOpenCell), enemyAreas: labelAreas(layout, isEnemyCell) };
}

/**
 * The open point nearest a point, which is the point itself if it is open. Off the
 * grid, the search starts from the nearest edge cell.
 */
export function nearestOpen(grid: Grid, point: Point): Point {
  if (isOpen(grid, point.x, point.z)) {
    return { x: point.x, z: point.z };
  }
  const index = nearestOpenCell(grid, point);
  return index < 0 ? { x: point.x, z: point.z } : cellCentre(grid, index);
}

function nearestOpenCell(grid: Grid, point: Point, open: CellTest = isOpenCell): number {
  const clamp = (value: number, most: number): number => Math.min(Math.max(value, 0), most);
  const col = clamp(Math.floor((point.x - grid.minX) / grid.cell), grid.cols - 1);
  const row = clamp(Math.floor((point.z - grid.minZ) / grid.cell), grid.rows - 1);
  let best = -1;
  let bestDistance = Infinity;
  const consider = (c: number, r: number): void => {
    if (r < 0 || c < 0 || r >= grid.rows || c >= grid.cols) {
      return;
    }
    const index = r * grid.cols + c;
    if (open(grid, index)) {
      const centre = cellCentre(grid, index);
      const distance = Math.hypot(centre.x - point.x, centre.z - point.z);
      if (distance < bestDistance) {
        best = index;
        bestDistance = distance;
      }
    }
  };
  let lastRing = Math.max(grid.cols, grid.rows);
  for (let ring = 0; ring <= lastRing; ring += 1) {
    // The square ring of cells this many steps out: its top and bottom rows, then its sides.
    for (let c = col - ring; c <= col + ring; c += 1) {
      consider(c, row - ring);
      if (ring > 0) consider(c, row + ring);
    }
    for (let r = row - ring + 1; r <= row + ring - 1; r += 1) {
      consider(col - ring, r);
      consider(col + ring, r);
    }
    // A closer cell can sit a few rings further out, along a diagonal.
    if (best >= 0) {
      lastRing = Math.min(lastRing, Math.ceil(ring * Math.SQRT2) + 1);
    }
  }
  return best;
}

/**
 * Whether a straight walk from one point to another stays on open cells. The cells
 * holding the two ends are not checked, so a character pressed against an obstacle
 * can still walk away from it, and can walk up to an enemy standing beside one.
 */
export function lineClear(grid: Grid, from: Point, to: Point, open: CellTest = isOpenCell): boolean {
  const { cell, cols, rows } = grid;
  const fx = (from.x - grid.minX) / cell;
  const fz = (from.z - grid.minZ) / cell;
  const tx = (to.x - grid.minX) / cell;
  const tz = (to.z - grid.minZ) / cell;
  let col = Math.floor(fx);
  let row = Math.floor(fz);
  const endCol = Math.floor(tx);
  const endRow = Math.floor(tz);
  const stepCol = Math.sign(tx - fx);
  const stepRow = Math.sign(tz - fz);
  const dx = Math.abs(tx - fx);
  const dz = Math.abs(tz - fz);
  // How far along the line, as a share, the next column and row edges are.
  let nextCol = dx === 0 ? Infinity : (stepCol > 0 ? col + 1 - fx : fx - col) / dx;
  let nextRow = dz === 0 ? Infinity : (stepRow > 0 ? row + 1 - fz : fz - row) / dz;
  const colShare = dx === 0 ? Infinity : 1 / dx;
  const rowShare = dz === 0 ? Infinity : 1 / dz;
  const cells = Math.abs(endCol - col) + Math.abs(endRow - row);
  for (let count = 0; count < cells; count += 1) {
    if (nextCol < nextRow) {
      col += stepCol;
      nextCol += colShare;
    } else {
      row += stepRow;
      nextRow += rowShare;
    }
    const last = col === endCol && row === endRow;
    const off = col < 0 || row < 0 || col >= cols || row >= rows;
    if (!last && (off || !open(grid, row * cols + col))) {
      return false;
    }
  }
  return true;
}

/** A binary heap of cells, cheapest first: A* takes the most promising cell next (D-029). */
class CellHeap {
  private readonly cells: number[] = [];
  private readonly costs: number[] = [];

  get size(): number {
    return this.cells.length;
  }

  push(cell: number, cost: number): void {
    const { cells, costs } = this;
    let at = cells.length;
    cells.push(cell);
    costs.push(cost);
    while (at > 0) {
      const parent = (at - 1) >> 1;
      if ((costs[parent] ?? 0) <= cost) {
        break;
      }
      cells[at] = cells[parent] ?? 0;
      costs[at] = costs[parent] ?? 0;
      at = parent;
    }
    cells[at] = cell;
    costs[at] = cost;
  }

  pop(): number {
    const { cells, costs } = this;
    const top = cells[0] ?? -1;
    const cell = cells.pop() ?? 0;
    const cost = costs.pop() ?? 0;
    const size = cells.length;
    if (size === 0) {
      return top;
    }
    let at = 0;
    for (;;) {
      const left = at * 2 + 1;
      const right = left + 1;
      let child = left;
      if (right < size && (costs[right] ?? 0) < (costs[left] ?? 0)) {
        child = right;
      }
      if (left >= size || (costs[child] ?? 0) >= cost) {
        break;
      }
      cells[at] = cells[child] ?? 0;
      costs[at] = costs[child] ?? 0;
      at = child;
    }
    cells[at] = cell;
    costs[at] = cost;
    return top;
  }
}

/** Distance in cells with diagonal steps allowed, which never overestimates a route. */
function octile(grid: Grid, from: number, to: number): number {
  const dx = Math.abs((from % grid.cols) - (to % grid.cols));
  const dz = Math.abs(Math.floor(from / grid.cols) - Math.floor(to / grid.cols));
  return dx + dz + (Math.SQRT2 - 2) * Math.min(dx, dz);
}

/** A* from cell to cell, eight ways, never cutting a corner. Returns the cells, start first. */
function searchCells(grid: Grid, start: number, goal: number, open: CellTest): number[] | null {
  const { cols } = grid;
  const total = cols * grid.rows;
  const cost = new Float64Array(total).fill(Infinity);
  const from = new Int32Array(total).fill(-1);
  const done = new Uint8Array(total);
  const heap = new CellHeap();
  cost[start] = 0;
  heap.push(start, octile(grid, start, goal));
  while (heap.size > 0) {
    const index = heap.pop();
    if (index === goal) {
      const cells = [goal];
      for (let at = from[goal] ?? -1; at >= 0; at = from[at] ?? -1) {
        cells.push(at);
      }
      return cells.reverse();
    }
    if (done[index] === 1) {
      continue;
    }
    done[index] = 1;
    const col = index % cols;
    for (let dz = -1; dz <= 1; dz += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const c = col + dx;
        const other = index + dz * cols + dx;
        if ((dx === 0 && dz === 0) || c < 0 || c >= cols || !open(grid, other)) {
          continue;
        }
        const diagonal = dx !== 0 && dz !== 0;
        if (diagonal && (!open(grid, index + dx) || !open(grid, index + dz * cols))) {
          continue;
        }
        const next = (cost[index] ?? 0) + (diagonal ? Math.SQRT2 : 1);
        if (next < (cost[other] ?? Infinity)) {
          cost[other] = next;
          from[other] = index;
          heap.push(other, next + octile(grid, other, goal));
        }
      }
    }
  }
  return null;
}

/** Keeps only the corners a straight line cannot cut, so the route runs in long straight legs. */
function smooth(grid: Grid, points: readonly Point[], open: CellTest): Point[] {
  const route: Point[] = [];
  let anchor = points[0];
  let at = 1;
  while (anchor && at < points.length) {
    let reach = at;
    while (reach + 1 < points.length && lineClear(grid, anchor, points[reach + 1] as Point, open)) {
      reach += 1;
    }
    anchor = points[reach];
    if (anchor) {
      route.push(anchor);
    }
    at = reach + 1;
  }
  return route;
}

function routeOn(grid: Grid, from: Point, to: Point, open: CellTest, areas: Int32Array): Point[] | null {
  if (lineClear(grid, from, to, open)) {
    return [{ x: to.x, z: to.z }];
  }
  const startCell = cellAt(grid, from.x, from.z);
  const goalCell = cellAt(grid, to.x, to.z);
  const start = open(grid, startCell) ? startCell : nearestOpenCell(grid, from, open);
  const goal = open(grid, goalCell) ? goalCell : nearestOpenCell(grid, to, open);
  if (start < 0 || goal < 0 || areas[start] !== areas[goal]) {
    return null;
  }
  const cells = searchCells(grid, start, goal, open);
  if (!cells) {
    return null;
  }
  const middle = cells.slice(1, -1).map((index) => cellCentre(grid, index));
  return smooth(grid, [from, ...middle, { x: to.x, z: to.z }], open);
}

/**
 * The corners to walk through from one point to another, ending at the goal, or
 * null if no route exists. A straight walk that is clear needs no search.
 */
export function findRoute(grid: Grid, from: Point, to: Point): Point[] | null {
  return routeOn(grid, from, to, isOpenCell, grid.areas);
}

/** Whether a straight walk stays on ground an enemy may stand on, stones aside. */
export function lineClearForEnemy(grid: Grid, from: Point, to: Point): boolean {
  return lineClear(grid, from, to, isEnemyCell);
}

/** The same search as `findRoute`, on the ground an enemy may stand on (D-060). */
export function findRouteForEnemy(grid: Grid, from: Point, to: Point): Point[] | null {
  return routeOn(grid, from, to, isEnemyCell, grid.enemyAreas);
}

/** The furthest open point along the line from one point towards another. */
export function clearAlong(grid: Grid, from: Point, to: Point): Point {
  if (lineClear(grid, from, to) && isOpen(grid, to.x, to.z)) {
    return { x: to.x, z: to.z };
  }
  const length = Math.hypot(to.x - from.x, to.z - from.z);
  const steps = Math.ceil(length / (grid.cell / 2));
  let last = { x: from.x, z: from.z };
  for (let step = 1; step <= steps; step += 1) {
    const share = step / steps;
    const point = { x: from.x + (to.x - from.x) * share, z: from.z + (to.z - from.z) * share };
    if (!isOpen(grid, point.x, point.z)) {
      break;
    }
    last = point;
  }
  return last;
}

/** Whether a route exists between two points, which is known at once from the areas. */
export function canReach(grid: Grid, from: Point, to: Point): boolean {
  const area = (point: Point): number => {
    const cell = cellAt(grid, point.x, point.z);
    const open = isOpenCell(grid, cell) ? cell : nearestOpenCell(grid, point);
    return open < 0 ? -1 : (grid.areas[open] ?? -1);
  };
  const start = area(from);
  return start >= 0 && start === area(to);
}
