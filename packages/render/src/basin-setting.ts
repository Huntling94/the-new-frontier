import { COLOSSE_LAKE_ROUTE, COLOSSE_ROAD, COLOSSE_SOUTH_ROUTE, type Point } from '@new-frontier/core';
import type { Strip } from './basin-shape';

/**
 * What one basin looks like beyond its rules (D-022): the water and ways the eye sees, and
 * how tall its rock stands. `Basin` draws any basin from one of these, so a new basin is a
 * new entry here.
 */
export interface BasinSetting {
  /** The lake beyond the outline. */
  readonly lake: readonly Point[];
  /** The main road, worn into the floor. */
  readonly road: readonly Point[];
  /** Fainter ways off the road. */
  readonly ways: readonly (readonly Point[])[];
  /** A door that leads nowhere yet. */
  readonly door: Point;
  /** A road shut at the basin's edge, and where it would have gone. */
  readonly closedRoad: { readonly end: Point; readonly onward: Point };
  /** The ground's walls that are water. */
  readonly waterIds: readonly string[];
  /** Water that runs on past the rules' end of it. */
  readonly waterOnward: readonly Strip[];
  /** Blocked outline drawn as a flat-topped plateau. Others are drawn as rock outcrops. */
  readonly plateauId: string;
  /** How tall each rock wall stands. */
  readonly wallHeights: Readonly<Record<string, number>>;
  /** Where lavender thins to nothing, and where it is thickest, along x. */
  readonly lavender: { readonly from: number; readonly to: number };
}

/** Where the closed south road meets the edge of the basin (M1 decision 7). */
const COLOSSE_SOUTH_ROAD_END: Point = { x: 11, z: 67 };

const COLOSSE: BasinSetting = {
  lake: [
    { x: -55, z: -109 },
    { x: -45, z: -112 },
    { x: -10, z: -110 },
    { x: 35, z: -105 },
    { x: 58, z: -97 },
    { x: 50, z: -92 },
    { x: 15, z: -84 },
    { x: -5, z: -77 },
    { x: -13, z: -67 },
    { x: -25, z: -64 },
    { x: -38, z: -65 },
    { x: -47, z: -72 },
    { x: -52, z: -95 },
  ],
  road: COLOSSE_ROAD,
  ways: [COLOSSE_LAKE_ROUTE, [...COLOSSE_SOUTH_ROUTE, COLOSSE_SOUTH_ROAD_END]],
  door: { x: -112, z: 21 },
  closedRoad: { end: COLOSSE_SOUTH_ROAD_END, onward: { x: 18, z: 130 } },
  waterIds: ['river', 'pool'],
  waterOnward: [
    {
      points: [
        { x: -105, z: 71 },
        { x: -121, z: 86 },
        { x: -146, z: 118 },
      ],
      half: 1.5,
    },
  ],
  plateauId: 'central-plateau',
  wallHeights: {
    'long-wall': 5.4,
    'plateau-spur-west': 5,
    'plateau-spur-east': 5.2,
    'arch-wall': 5.4,
    'west-rocks': 3.8,
    'short-wall': 3.6,
    'rock-by-the-long-wall': 3.6,
    'south-west-rock': 3.6,
  },
  lavender: { from: -38, to: 112 },
};

const SETTINGS: Readonly<Record<string, BasinSetting>> = { 'carrefour-du-colosse': COLOSSE };

/** The setting of a basin zone. A basin with no entry is a mistake, so it fails at once. */
export function basinSetting(zoneId: string): BasinSetting {
  const setting = SETTINGS[zoneId];
  if (!setting) throw new Error(`The basin ${zoneId} has no setting in basin-setting.ts.`);
  return setting;
}
