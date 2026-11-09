import {
  COLOSSE_LAKE_ROUTE,
  COLOSSE_ROAD,
  COLOSSE_SOUTH_ROUTE,
  GARGANTA_FALLS_ROUTE,
  GARGANTA_MAIN_ROUTE,
  GARGANTA_POCKET_ROUTE,
  type Point,
} from '@new-frontier/core';
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
  /** A door at the end of the road: barred if it leads nowhere yet, open if a gate stands in it. */
  readonly door: Point;
  readonly doorOpen?: boolean;
  /** The way the portal is set back from the door's point, and its turn. West and a quarter turn unless set. */
  readonly doorBack?: Point;
  readonly doorTurn?: number;
  /** A road shut at the basin's edge, where it would have gone, and the way it runs out, its width as a share of the usual, and how wide its cutting is. */
  readonly closedRoad: {
    readonly end: Point;
    readonly onward: Point;
    readonly out?: Point;
    readonly width?: number;
    readonly half?: number;
  };
  /** The way the ranges are cut behind the first gate. East unless set. */
  readonly gatePass?: Point;
  /** The ground's walls that are water. */
  readonly waterIds: readonly string[];
  /** Water that runs on past the rules' end of it. */
  readonly waterOnward: readonly Strip[];
  /** Blocked outlines drawn as flat-topped plateaus. Others are drawn as rock outcrops. */
  readonly plateauIds: readonly string[];
  /** Keeps an outcrop's stones inside its outline, for rock that stands beside a narrow way. */
  readonly snugRidges?: boolean;
  /** Dark walls beyond the outline. */
  readonly fortress?: readonly (readonly Point[])[];
  /** A pale stone way across the lake, as a centreline and half its width. */
  readonly causeway?: Strip;
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
  // The gate to Garganta da Cidadela stands in it (M2 decision 7).
  doorOpen: true,
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
  plateauIds: ['central-plateau'],
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

const pts = (...coords: readonly (readonly [number, number])[]): Point[] => coords.map(([x, z]) => ({ x, z }));

/** The appendix's falls route, bent below the left pillar: its straight leg there would cross the rock. */
const GARGANTA_FALLS_WAY: readonly Point[] = [...GARGANTA_FALLS_ROUTE.slice(0, 5), { x: 12, z: 46.5 }, ...GARGANTA_FALLS_ROUTE.slice(5)];

const GARGANTA: BasinSetting = {
  lake: pts([-33, -103], [-21, -104], [-3, -104], [12, -103], [21, -88], [24, -78], [22, -70], [16, -60], [7, -56], [-26, -56], [-33, -56], [-42, -64], [-46, -73], [-47, -83], [-42, -94]),
  road: GARGANTA_MAIN_ROUTE,
  ways: [GARGANTA_FALLS_WAY, GARGANTA_POCKET_ROUTE],
  // The citadel door, in the gap in the fortress wall (M2 decision 8).
  door: { x: -11, z: -117 },
  doorBack: { x: 0, z: -1 },
  doorTurn: 0,
  // The falls end, at the top of the east spur (M2 decision 8).
  closedRoad: { end: { x: 68.75, z: -41.5 }, onward: { x: 82, z: -130 }, out: { x: 0.15, z: -1 }, width: 0.55, half: 5 },
  gatePass: { x: 0, z: 110 },
  waterIds: [],
  waterOnward: [],
  plateauIds: ['left-pillar', 'large-pillar'],
  snugRidges: true,
  fortress: [
    pts([-72, -72], [-72, -82], [-63, -98], [-50, -109], [-33, -117], [-19, -120], [-19, -104], [-33, -103], [-42, -94], [-47, -83], [-46, -72]),
    pts([-3, -120], [14, -120], [27, -113], [40, -104], [48, -82], [48, -73], [24, -74], [21, -88], [12, -103], [-2, -104]),
  ],
  causeway: { points: pts([-11, -60.5], [-11, -104]), half: 5 },
  wallHeights: {},
  // No lavender here: the bounds never reach these numbers.
  lavender: { from: 1000, to: 1001 },
};

const SETTINGS: Readonly<Record<string, BasinSetting>> = { 'carrefour-du-colosse': COLOSSE, 'garganta-da-cidadela': GARGANTA };

/** The setting of a basin zone. A basin with no entry is a mistake, so it fails at once. */
export function basinSetting(zoneId: string): BasinSetting {
  const setting = SETTINGS[zoneId];
  if (!setting) throw new Error(`The basin ${zoneId} has no setting in basin-setting.ts.`);
  return setting;
}
