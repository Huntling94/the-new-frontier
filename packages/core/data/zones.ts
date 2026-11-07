import type { ZoneData } from '../src/world';
import { TEST_ISLAND } from './island';

/** The world (D-015). One zone for now, with the squad test's layout. */
export const ZONES: readonly ZoneData[] = [
  {
    id: 'isle',
    island: TEST_ISLAND,
    walkableEdge: 0.9,
    offLandPull: 0.86,
    fixedObstacles: [
      { kind: 'beacon', x: 0, z: 0, radius: 4.2 },
      { kind: 'waystone', x: 6, z: 66, radius: 1.1 },
    ],
    obstacleGroups: [
      { kind: 'tree', count: 60, minScale: 0.8, maxScale: 1.35, radiusPerScale: 1.25 },
      { kind: 'rock', count: 34, minScale: 0.7, maxScale: 2, radiusPerScale: 1.3 },
    ],
    placement: {
      minCoastDistanceSquared: 0.04,
      maxCoastDistanceSquared: 0.68,
      triesPerObstacle: 8,
    },
    clearings: [
      { x: 0, z: 0, radius: 34 },
      { x: 0, z: 68, radius: 20 },
    ],
  },
];
