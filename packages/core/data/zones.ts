import type { PackData } from '../src/state';
import type { ZoneData } from '../src/world';
import { PACKS } from './enemies';
import { TEST_ISLAND } from './island';
import { LANDE_LAYOUT } from './lande-layout';

/** A cleared pack comes back after this long. A placeholder until balance (decision 2). */
const PACK_RESPAWN_SECONDS = 180;

/** The cave's one pack, at the Lande's level, in the corner past the wall. */
const CAVE_PACKS: readonly PackData[] = [
  {
    x: 30,
    z: -18,
    level: 4,
    mobs: [
      { kind: 'runner', count: 2 },
      { kind: 'swarm', count: 3 },
    ],
  },
];

/**
 * The world (D-021). Lande de Montclaire is the squad test's island, renamed, with
 * its trees baked as standing stones (D-022, D-038). The cave off its edge is the
 * first walled zone, and its name waits for the starting region's naming.
 */
export const ZONES: readonly ZoneData[] = [
  {
    id: 'lande',
    kind: 'field',
    place: { x: 0, z: 0 },
    ground: { shape: 'island', island: TEST_ISLAND, walkableEdge: 0.9, enemyEdge: 0.87 },
    camp: { x: 0, z: 62, heading: -Math.PI / 2 },
    anvil: { x: 6, z: 66 },
    obstacles: [
      { kind: 'beacon', x: 0, z: 0, radius: 4.2 },
      { kind: 'waystone', x: 6, z: 66, radius: 1.1 },
      ...LANDE_LAYOUT,
    ],
    contents: { dummy: null, packs: PACKS, boss: { x: 0, z: 16 } },
    packRespawnSeconds: PACK_RESPAWN_SECONDS,
    gates: [
      {
        id: 'lande-to-cave',
        area: { x: -16, z: 72, radius: 3 },
        to: 'lande-cave',
        arrival: { x: -30, z: 16 },
        heading: 0,
        requires: [],
        cost: [],
      },
    ],
  },
  {
    id: 'lande-cave',
    kind: 'dungeon',
    place: { x: -150, z: 110 },
    ground: {
      shape: 'walled',
      level: 3,
      bounds: { minX: -40, maxX: 40, minZ: -28, maxZ: 28 },
      // An L that a straight walk from the mouth cannot pass.
      walls: [
        { minX: -16, maxX: -12, minZ: -28, maxZ: 6 },
        { minX: -16, maxX: 8, minZ: 2, maxZ: 6 },
      ],
    },
    camp: { x: -30, z: 16, heading: 0 },
    anvil: null,
    obstacles: [],
    contents: { dummy: null, packs: CAVE_PACKS, boss: null },
    packRespawnSeconds: PACK_RESPAWN_SECONDS,
    gates: [
      {
        id: 'cave-to-lande',
        area: { x: -36, z: 22, radius: 3 },
        to: 'lande',
        arrival: { x: -12, z: 64 },
        heading: -Math.PI / 4,
        requires: [],
        cost: [],
      },
    ],
  },
];

/** Where a new game begins. */
export const START_ZONE = 'lande';
