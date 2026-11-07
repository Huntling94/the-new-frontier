import type { IslandData } from '../src/island';

/** The squad test's island. Values are the prototype's, unchanged. */
export const TEST_ISLAND: IslandData = {
  x: 0,
  z: 0,
  radius: 92,
  rimWaves: [
    { frequency: 3, amplitude: 0.08, phase: 1 },
    { frequency: 5, amplitude: 0.05, phase: 2 },
    { frequency: 9, amplitude: 0.025, phase: 2 },
  ],
  noise: {
    seedX: 127.1,
    seedZ: 311.7,
    seedScale: 43758.5453,
    octaves: [
      { scale: 1, weight: 0.6 },
      { scale: 2.1, weight: 0.28 },
      { scale: 4.3, weight: 0.12 },
    ],
  },
  relief: {
    groundLevel: 3,
    height: 1.5,
    midpoint: 0.5,
    noiseScale: 0.05,
    offsetX: 1,
    offsetZ: 2,
    edgeFalloff: 4,
  },
  cliff: {
    start: 0.94,
    drop: 18,
    noiseRow: 3,
  },
  skirt: {
    rings: 5,
    spread: 0.16,
    spreadJitter: 0.03,
    topDrop: 1.3,
    depth: 16,
    depthJitter: 1.4,
    jitterMidpoint: 0.5,
  },
  mesh: {
    rings: 24,
    segments: 96,
    ringSpacing: 0.8,
  },
};
