import type { Point } from '@new-frontier/core';

/**
 * The shape of the land round a basin (M1 decision 5). Height is look only (D-022): the
 * rules' floor is flat, and nothing here is read by them. Plain numbers, so it can be tested
 * without a screen.
 */

/** A strip of ground, as a centreline and half its width. */
export interface Strip {
  readonly points: readonly Point[];
  readonly half: number;
  /** How far a pass's cutting climbs back up to the full height of the land. */
  readonly shoulder?: number;
}

export interface BasinPlan {
  readonly outline: readonly Point[];
  readonly lake: readonly Point[];
  /** Rivers and pools, which the land keeps low beside. */
  readonly water: readonly Strip[];
  /** Where the ranges are cut low: a way in, or a way that used to be. */
  readonly passes: readonly Strip[];
}

/** The land just under the floor, so the floor's exact edge is what the eye sees. */
export const UNDER_FLOOR = -0.12;

const RANGE = {
  /** The tallest the ranges reach, beside the lake and at the south. */
  north: 36,
  south: 13,
  /** Where those two heights apply, along z. */
  northAt: -105,
  southAt: 70,
  /** The foot of the slope starts this far outside the outline, so no character clips it. */
  foot: 1.2,
  /** How quickly the land climbs from the foot: most of the height within about this many units. */
  rise: 11,
};
const LAKE = { depth: 4, shelf: 0.6, fall: 1.4, shore: 9 };
const BANK = { clear: 1.5, spread: 7 };
const PASS = { floor: 0.04, shoulder: 12 };

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

export function smooth(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function hash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function noise(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const u = smooth(x - xi);
  const v = smooth(y - yi);
  const top = hash(xi, yi) + (hash(xi + 1, yi) - hash(xi, yi)) * u;
  const bottom = hash(xi, yi + 1) + (hash(xi + 1, yi + 1) - hash(xi, yi + 1)) * u;
  return top + (bottom - top) * v;
}

/** Sharp crests, where plain noise would give round hills. */
function ridges(x: number, z: number): number {
  const crest = (scale: number): number => 1 - Math.abs(noise(x * scale, z * scale) * 2 - 1);
  return crest(0.022) * 0.6 + crest(0.051) * 0.28 + crest(0.11) * 0.12;
}

function segmentDistance(x: number, z: number, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const share = clamp01(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1));
  return Math.hypot(x - a.x - share * dx, z - a.z - share * dz);
}

export function lineDistance(x: number, z: number, points: readonly Point[]): number {
  let least = Infinity;
  for (let index = 0; index + 1 < points.length; index += 1) {
    least = Math.min(least, segmentDistance(x, z, points[index] as Point, points[index + 1] as Point));
  }
  return least;
}

export function ringDistance(x: number, z: number, points: readonly Point[]): number {
  return Math.min(lineDistance(x, z, points), segmentDistance(x, z, points[points.length - 1] as Point, points[0] as Point));
}

/** Whether a point is inside a closed outline, by the even-odd rule. */
export function insideRing(x: number, z: number, points: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const a = points[i] as Point;
    const b = points[j] as Point;
    if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

/**
 * The land's height above the floor at a point. Under the floor inside the outline,
 * below it under the lake, and rising outside: highest beside the lake, lower to the south.
 */
export function landHeight(plan: BasinPlan, x: number, z: number): number {
  if (insideRing(x, z, plan.outline)) return UNDER_FLOOR;
  const shore = ringDistance(x, z, plan.lake);
  if (insideRing(x, z, plan.lake)) return -Math.min(LAKE.depth, LAKE.shelf + shore * LAKE.fall);
  const reach = ringDistance(x, z, plan.outline);
  if (reach < RANGE.foot) return UNDER_FLOOR;

  const peak = RANGE.north + (RANGE.south - RANGE.north) * smooth((z - RANGE.northAt) / (RANGE.southAt - RANGE.northAt));
  let height = peak * (1 - Math.exp(-(reach - RANGE.foot) / RANGE.rise)) * (0.55 + ridges(x, z) * 0.75);
  height *= smooth(shore / LAKE.shore);
  for (const { points, half } of plan.water) {
    height *= smooth((lineDistance(x, z, points) - half - BANK.clear) / BANK.spread);
  }
  for (const { points, half, shoulder } of plan.passes) {
    height *= PASS.floor + (1 - PASS.floor) * smooth((lineDistance(x, z, points) - half) / (shoulder ?? PASS.shoulder));
  }
  return Math.max(height, UNDER_FLOOR);
}
