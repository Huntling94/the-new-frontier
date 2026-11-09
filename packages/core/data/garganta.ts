import type { Place } from '../src/grid';
import type { PackData, Point } from '../src/state';

/**
 * Garganta da Cidadela, the third field (M2): a canyon running north from a gate at its
 * south end to a causeway across a lake, with an east branch to the falls. Hand-placed from
 * the maintainer's own sketch of 9 Nov 2026 and frozen (D-022). Game units, centred on
 * (0, 0), x east and z south. The lake, the fortress walls, the ranges and all height are
 * look only and belong to `render` (decision 6).
 */

/** The grid covers the walkable ground. The ranges, lake and walls fill out the 240 by 240 footprint in `render`. */
export const GARGANTA_BOUNDS = { minX: -48, maxX: 84, minZ: -124, maxZ: 108 };

/** The canyon's outline, from the north-west corner of the causeway's end, down the west side and back up the east. */
export const GARGANTA_OUTLINE: readonly Point[] = [
  { x: -19, z: -120 },
  { x: -19, z: -104 },
  { x: -24, z: -104 },
  { x: -16, z: -95 },
  { x: -16, z: -60.5 },
  { x: -32.5, z: -60 },
  { x: -31, z: -44.5 },
  { x: -20, z: -34.5 },
  { x: -15.5, z: -17.5 },
  { x: -13.5, z: 7 },
  { x: -15.5, z: 18.5 },
  { x: -21.5, z: 23 },
  { x: -33, z: 28.5 },
  { x: -40.5, z: 36 },
  { x: -40, z: 51.5 },
  { x: -32, z: 63.5 },
  { x: -16.5, z: 72.5 },
  { x: -4.5, z: 81 },
  { x: -0.5, z: 90 },
  { x: -0.5, z: 104 },
  { x: 11.5, z: 104 },
  { x: 13, z: 98.5 },
  { x: 11, z: 80 },
  { x: 2, z: 69 },
  { x: -9.5, z: 61.5 },
  { x: -23, z: 55.5 },
  { x: -29, z: 49 },
  { x: -27.5, z: 41 },
  { x: -1, z: 29.5 },
  { x: 4, z: 35 },
  { x: 5.5, z: 40 },
  { x: 9.5, z: 47.5 },
  { x: 20.5, z: 51.5 },
  { x: 34.5, z: 48 },
  { x: 50, z: 50.5 },
  { x: 62.5, z: 42 },
  { x: 64, z: 34 },
  { x: 59, z: 24 },
  { x: 54.5, z: 7 },
  { x: 55, z: -4.5 },
  { x: 63, z: -11.5 },
  { x: 73, z: -18.5 },
  { x: 70, z: -27.5 },
  { x: 77, z: -35 },
  { x: 73, z: -42 },
  { x: 64.5, z: -41 },
  { x: 61.5, z: -32.5 },
  { x: 50, z: -11.5 },
  { x: 46, z: -1 },
  { x: 46, z: 12 },
  { x: 48.5, z: 24 },
  { x: 44.5, z: 31 },
  { x: 38.5, z: 33 },
  { x: 34.5, z: 24 },
  { x: 33.5, z: 9.5 },
  { x: 26.5, z: 6 },
  { x: 22, z: 12.5 },
  { x: 17.5, z: 10 },
  { x: 9, z: 11.5 },
  { x: 9.5, z: 18 },
  { x: 13, z: 23 },
  { x: 10, z: 23.5 },
  { x: 2.5, z: 20 },
  { x: 0, z: 13 },
  { x: -1, z: 4 },
  { x: -4, z: -10.5 },
  { x: -3.5, z: -27.5 },
  { x: 0, z: -43.5 },
  { x: 9, z: -53.5 },
  { x: 9, z: -60.5 },
  { x: -6, z: -60.5 },
  { x: -6, z: -95 },
  { x: 2.5, z: -104 },
  { x: -2.5, z: -104 },
  { x: -3, z: -120 },
];

/** Ground no one may stand on: the sliver splitting the corridor, a rock island, and the two pillars. */
export const GARGANTA_BLOCKED: readonly Place[] = [
  {
    id: 'sliver',
    outline: [
      { x: -8, z: 7.5 },
      { x: -5, z: 14.5 },
      { x: -5, z: 21 },
      { x: -9, z: 21 },
      { x: -10, z: 17 },
    ],
  },
  {
    id: 'rock-island',
    outline: [
      { x: -13, z: 24.5 },
      { x: -8, z: 22 },
      { x: -4, z: 23 },
      { x: -5, z: 27 },
      { x: -10.5, z: 29 },
      { x: -14, z: 27 },
    ],
  },
  {
    id: 'left-pillar',
    outline: [
      { x: 11, z: 28 },
      { x: 17, z: 26 },
      { x: 18, z: 39.5 },
      { x: 14.5, z: 44 },
      { x: 11, z: 41.5 },
      { x: 9.5, z: 34.5 },
    ],
  },
  {
    id: 'large-pillar',
    outline: [
      { x: 22, z: 24.5 },
      { x: 31, z: 22 },
      { x: 37, z: 29.5 },
      { x: 36, z: 37 },
      { x: 29, z: 40 },
      { x: 22.5, z: 38 },
    ],
  },
];

/** From the south gate to the citadel door. It is not ground of its own: it is what the tests walk and measure. */
export const GARGANTA_MAIN_ROUTE: readonly Point[] = [
  { x: 6, z: 101 },
  { x: 5, z: 87 },
  { x: -4, z: 74 },
  { x: -18, z: 66 },
  { x: -30, z: 58 },
  { x: -34, z: 44 },
  { x: -34, z: 37 },
  { x: -26, z: 30 },
  { x: -17, z: 24 },
  { x: -13, z: 18 },
  { x: -12, z: 8 },
  { x: -9, z: 0 },
  { x: -9, z: -16 },
  { x: -10, z: -36 },
  { x: -10, z: -50 },
  { x: -11, z: -60 },
  { x: -11, z: -96 },
  { x: -11, z: -117 },
];

/** From the junction above the sliver to the falls end. */
export const GARGANTA_FALLS_ROUTE: readonly Point[] = [
  { x: -9, z: 0 },
  { x: -4, z: 12 },
  { x: -2, z: 22 },
  { x: 6, z: 28 },
  { x: 8, z: 38 },
  { x: 21, z: 44 },
  { x: 40, z: 40 },
  { x: 54, z: 34 },
  { x: 52, z: 20 },
  { x: 50, z: 7 },
  { x: 54, z: -8 },
  { x: 63, z: -18 },
  { x: 69, z: -36 },
];

/** The pocket behind the pillars. */
export const GARGANTA_POCKET_ROUTE: readonly Point[] = [
  { x: 21, z: 44 },
  { x: 20, z: 37 },
  { x: 20, z: 27 },
  { x: 22, z: 18 },
];

/**
 * Four packs, placed by hand in the wider stretches (decisions 9 and 10). Levels are starting
 * points. A 12-unit landing square does not fit the canyon's bends, so the first three land
 * in a smaller one. The first stands a little up the canyon from the appendix's spot, so
 * arriving at the south gate does not wake it.
 */
export const GARGANTA_PACKS: readonly PackData[] = [
  {
    x: -7.5,
    z: 70.5,
    spread: 4,
    level: 11,
    mobs: [
      { kind: 'rooster', count: 3 },
      { kind: 'wasp', count: 2 },
    ],
  },
  {
    x: -35,
    z: 45,
    spread: 4,
    level: 12,
    mobs: [
      { kind: 'viper', count: 3 },
      { kind: 'wasp', count: 2 },
    ],
  },
  {
    x: 40,
    z: 41,
    spread: 4,
    level: 13,
    mobs: [
      { kind: 'boar', count: 1 },
      { kind: 'rooster', count: 3 },
    ],
  },
  {
    x: -11,
    z: -50,
    level: 14,
    mobs: [
      { kind: 'boar', count: 2 },
      { kind: 'viper', count: 2 },
    ],
  },
];

/** Where the squad arrives and gets up after a wipe: just inside the south gate, facing north. */
export const GARGANTA_CAMP = { x: 5, z: 92, heading: -Math.PI / 2 };
