import type { Place, Street } from '../src/grid';
import type { Obstacle, PackData, Point } from '../src/state';

/**
 * Carrefour du Colosse, the second field (M1): a walled basin 240 by 240 units,
 * hand-placed from the maintainer's own sketch of 9 Nov 2026 and frozen (D-022).
 * Game units, centred on (0, 0), x east and z south. The ranges, the lake, the river
 * and the height of rocks and walls are look only and belong to `render` (decision 5).
 */

/**
 * The grid covers the walkable ground, which spans x -114 to 120 and z -68 to 68. The
 * mountains and the lake fill out the 240 by 240 footprint in `render`.
 */
export const COLOSSE_BOUNDS = { minX: -120, maxX: 120, minZ: -72, maxZ: 72 };

/**
 * The basin's outline, east tip first. Traced by eye, with the east tip widened at the
 * plan stage (decision 8): the tip's two edges ran 10.3 apart about 10 units in from the
 * gate. The road is now at least 11.5 wide along its whole length.
 */
export const COLOSSE_OUTLINE: readonly Point[] = [
  { x: -47, z: -68 },
  { x: -35, z: -64 },
  { x: -18, z: -64 },
  { x: 0, z: -65 },
  { x: 6, z: -62 },
  { x: 7, z: -48 },
  { x: 6, z: -30 },
  { x: 12, z: -22 },
  { x: 27, z: -15 },
  { x: 55, z: -9 },
  { x: 85, z: -2 },
  { x: 103, z: 2 },
  { x: 119, z: 6 },
  { x: 120, z: 14 },
  { x: 116, z: 20 },
  { x: 104, z: 22 },
  { x: 100, z: 22 },
  { x: 88, z: 27 },
  { x: 85, z: 40 },
  { x: 80, z: 48 },
  { x: 55, z: 53 },
  { x: 35, z: 57 },
  { x: 17, z: 66 },
  { x: 5, z: 68 },
  { x: -8, z: 63 },
  { x: -18, z: 55 },
  { x: -30, z: 48 },
  { x: -43, z: 48 },
  { x: -60, z: 57 },
  { x: -70, z: 58 },
  { x: -77, z: 51 },
  { x: -79, z: 45 },
  { x: -93, z: 41 },
  { x: -108, z: 35 },
  { x: -114, z: 20 },
  { x: -112, z: 6 },
  { x: -102, z: -2 },
  { x: -102, z: -9 },
  { x: -94, z: -15 },
  { x: -78, z: -16 },
  { x: -60, z: -12 },
  { x: -43, z: -13 },
  { x: -32, z: -23 },
  { x: -30, z: -35 },
  { x: -34, z: -48 },
];

/** Ground no one may stand on: a plateau in the middle, and a ridge in the neck. */
export const COLOSSE_BLOCKED: readonly Place[] = [
  {
    id: 'central-plateau',
    outline: [
      { x: 10, z: 16 },
      { x: 20, z: 16 },
      { x: 26, z: 22 },
      { x: 25, z: 37 },
      { x: 15, z: 41 },
      { x: 7, z: 42 },
      { x: 3, z: 37 },
      { x: 3, z: 22 },
    ],
  },
  {
    id: 'neck-ridge',
    outline: [
      { x: -11, z: -59 },
      { x: -3, z: -59 },
      { x: -8, z: -54 },
      { x: -7, z: -48 },
      { x: -9, z: -43 },
      { x: -10, z: -35 },
      { x: -16, z: -35 },
      { x: -14, z: -45 },
      { x: -12, z: -53 },
    ],
  },
];

/** Bending walls, rock bands and water, as a centreline and a width, all blocked. */
export const COLOSSE_WALLS: readonly Street[] = [
  {
    id: 'long-wall',
    width: 2.3,
    points: [
      { x: -43, z: 2 },
      { x: -34, z: 1 },
      { x: -30, z: 11 },
      { x: -20, z: 20 },
      { x: -19, z: 27 },
      { x: -15, z: 32 },
      { x: -9, z: 32 },
      { x: -8, z: 20 },
    ],
  },
  { id: 'plateau-spur-west', width: 2, points: [{ x: 1, z: 23 }, { x: 0, z: 35 }] },
  {
    id: 'plateau-spur-east',
    width: 2.3,
    points: [
      { x: 25, z: 20 },
      { x: 32, z: 15 },
      { x: 35, z: 11 },
      { x: 55, z: 12 },
      { x: 65, z: 18 },
    ],
  },
  {
    id: 'arch-wall',
    width: 2.3,
    points: [
      { x: 22, z: 55 },
      { x: 21, z: 47 },
      { x: 30, z: 39 },
      { x: 40, z: 43 },
      { x: 43, z: 48 },
    ],
  },
  {
    id: 'west-rocks',
    width: 2,
    points: [
      { x: -95, z: -8 },
      { x: -85, z: -8 },
      { x: -92, z: -4 },
      { x: -88, z: 1 },
    ],
  },
  { id: 'short-wall', width: 2, points: [{ x: -77, z: 14 }, { x: -72, z: 17 }] },
  { id: 'rock-by-the-long-wall', width: 2, points: [{ x: -46, z: 18 }, { x: -38, z: 20 }] },
  { id: 'south-west-rock', width: 2, points: [{ x: -67, z: 46 }, { x: -58, z: 42 }] },
  { id: 'river', width: 3, points: [{ x: -105, z: 71 }, { x: -85, z: 55 }, { x: -54, z: 35 }] },
  { id: 'pool', width: 3, points: [{ x: -48, z: 36 }, { x: -36, z: 36 }] },
];

/** Single rocks, each a centre and a radius. */
export const COLOSSE_OBSTACLES: readonly Obstacle[] = [
  { kind: 'rock', x: -97, z: 5, radius: 1.8 },
  { kind: 'rock', x: -86, z: 11, radius: 2 },
  { kind: 'rock', x: -67, z: 8, radius: 3.3 },
  { kind: 'rock', x: -45, z: 25, radius: 1.8 },
  { kind: 'rock', x: 85, z: 25, radius: 1.8 },
  { kind: 'rock', x: 48, z: 28, radius: 2 },
  { kind: 'rock', x: 80, z: 35, radius: 1.5 },
];

/** The main road, east to west. It is not ground of its own: it is where the squad walks, and what the tests measure. */
export const COLOSSE_ROAD: readonly Point[] = [
  { x: 115, z: 12 },
  { x: 98, z: 6 },
  { x: 80, z: 5 },
  { x: 55, z: 0 },
  { x: 25, z: -4 },
  { x: 3, z: -6 },
  { x: -12, z: -15 },
  { x: -24, z: -16 },
  { x: -35, z: -11 },
  { x: -47, z: -3 },
  { x: -51, z: 8 },
  { x: -53, z: 22 },
  { x: -60, z: 30 },
  { x: -75, z: 31 },
  { x: -93, z: 27 },
  { x: -110, z: 21 },
];

/** From the first fork to the lake end. */
export const COLOSSE_LAKE_ROUTE: readonly Point[] = [
  { x: -24, z: -16 },
  { x: -24, z: -53 },
];

/** Towards the closed south road. It is not a way out: the road is blocked by look (decision 7). */
export const COLOSSE_SOUTH_ROUTE: readonly Point[] = [
  { x: -51, z: 8 },
  { x: -42, z: 12 },
  { x: -33, z: 20 },
  { x: -28, z: 35 },
  { x: -18, z: 43 },
  { x: -3, z: 52 },
  { x: 11, z: 61 },
];

/** Eight packs, placed by hand, at levels rising westward (decisions 9 and 10). Levels are starting points. */
export const COLOSSE_PACKS: readonly PackData[] = [
  {
    x: 73,
    z: 18,
    level: 6,
    mobs: [
      { kind: 'rooster', count: 3 },
      { kind: 'wasp', count: 3 },
    ],
  },
  {
    x: 40,
    z: -2,
    level: 7,
    mobs: [
      { kind: 'rooster', count: 2 },
      { kind: 'viper', count: 2 },
    ],
  },
  {
    x: 55,
    z: 40,
    level: 7,
    mobs: [
      { kind: 'boar', count: 1 },
      { kind: 'wasp', count: 4 },
    ],
  },
  {
    x: -5,
    z: -12,
    level: 8,
    mobs: [
      { kind: 'viper', count: 3 },
      { kind: 'rooster', count: 2 },
    ],
  },
  {
    x: -22,
    z: -48,
    level: 9,
    mobs: [
      { kind: 'boar', count: 1 },
      { kind: 'rooster', count: 3 },
    ],
  },
  {
    x: -5,
    z: 50,
    level: 9,
    mobs: [
      { kind: 'boar', count: 1 },
      { kind: 'viper', count: 3 },
    ],
  },
  {
    x: -60,
    z: -5,
    level: 10,
    mobs: [
      { kind: 'viper', count: 3 },
      { kind: 'wasp', count: 3 },
    ],
  },
  {
    x: -95,
    z: 25,
    level: 11,
    mobs: [
      { kind: 'boar', count: 2 },
      { kind: 'rooster', count: 2 },
    ],
  },
];

/** Where the squad gets up after a wipe: at the east tip, just inside the gate. */
export const COLOSSE_CAMP = { x: 100, z: 9, heading: Math.PI };
