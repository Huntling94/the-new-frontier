import type { Place, Street } from '../src/grid';
import type { Obstacle, Point } from '../src/state';
import type { Lot, NpcData } from '../src/world';

/**
 * Montclaire, the first town (S3d decision 2): hand-placed from the maintainer's sketch
 * of 8 Nov 2026, and a start he will revisit. Town units, x east and z south, as on the
 * Lande. A plaza in the north, a loop of streets round a large central block, and a gate
 * street dropping south to the gate onto Lande de Montclaire.
 */

/** The whole town, 120 by 120. */
export const MONTCLAIRE_BOUNDS = { minX: -60, maxX: 60, minZ: -60, maxZ: 60 };

/** Every street is 12 wide, the loop's and the main street's least (decision 3). */
const STREET_WIDTH = 12;

/**
 * The plaza, about 82 by 32 with the fountain at its middle. It has an oval feel, with
 * a flat north side and a flat south side where the central block's buildings push in.
 */
const PLAZA: Place = {
  id: 'plaza',
  outline: [
    { x: -38, z: -41 },
    { x: -10, z: -42 },
    { x: 17, z: -41 },
    { x: 27, z: -37.5 },
    { x: 31.5, z: -30 },
    { x: 31, z: -21 },
    { x: 26, z: -13.5 },
    { x: 12, z: -10 },
    { x: -28, z: -10 },
    { x: -43, z: -12.5 },
    { x: -50, z: -19 },
    { x: -51, z: -29 },
    { x: -46.5, z: -37 },
  ],
};

/** Where the left, right and bottom streets meet. */
const WEST_CORNER: Point = { x: -51, z: 37 };
const EAST_CORNER: Point = { x: 51, z: 13.5 };
/** Where the gate street leaves the bottom street, a third of the way along from the west. */
const GATE_JUNCTION: Point = { x: -18, z: 30 };

const STREETS: readonly Street[] = [
  // About 52 long from the plaza's lower left, leaning slightly west, with a gentle bend.
  { id: 'left', points: [{ x: -44, z: -20 }, { x: -46, z: 9 }, WEST_CORNER], width: STREET_WIDTH },
  // About 40 long from the plaza's lower right, towards five o'clock.
  { id: 'right', points: [{ x: 24, z: -20 }, { x: 39, z: -5 }, EAST_CORNER], width: STREET_WIDTH },
  // About 105 long, joining the other two's lower ends and rising to the east.
  { id: 'bottom', points: [WEST_CORNER, GATE_JUNCTION, { x: 15, z: 23 }, EAST_CORNER], width: STREET_WIDTH },
  // About 30 long, straight south to the gate in the town's south edge.
  { id: 'gate', points: [GATE_JUNCTION, { x: -17.5, z: 45 }, { x: -17, z: 60 }], width: STREET_WIDTH },
];

export const MONTCLAIRE_GROUND = { streets: STREETS, places: [PLAZA] };

/** The plaza's middle, where the fountain stands. */
export const FOUNTAIN: Point = { x: -9.6, z: -25.3 };

/** The fountain is the only prop that blocks (decision 8). Planters and trees stand off the streets. */
export const MONTCLAIRE_OBSTACLES: readonly Obstacle[] = [{ kind: 'fountain', ...FOUNTAIN, radius: 3 }];

/** A new game starts just south of the fountain, facing it (decision 6). */
export const MONTCLAIRE_START = { x: -9.6, z: -17, heading: -Math.PI / 2 };

/** Doors face west, into the street (decision 4). */
const WEST = Math.PI;

/**
 * Lots for the systems to come (decision 4): the smithy and the shop on the left
 * street, facing it from the central block, and the inn beside the gate street.
 * Each door stands just inside the street's east edge.
 */
const SMITHY_DOOR: Point = { x: -40.6, z: -4 };

export const MONTCLAIRE_LOTS: readonly Lot[] = [
  { id: 'smithy', door: SMITHY_DOOR, facing: WEST },
  { id: 'shop', door: { x: -42.2, z: 13 }, facing: WEST },
  { id: 'inn', door: { x: -13, z: 47 }, facing: WEST },
];

/** The smith stands at the smithy's door (D-044). The maintainer asked for a name, so NPCs can be told apart; the naming session may change it (D-038). */
export const MONTCLAIRE_NPCS: readonly NpcData[] = [
  { id: 'smith', name: 'Gaspard', at: SMITHY_DOOR, facing: WEST, services: ['smith'], quests: [] },
];
