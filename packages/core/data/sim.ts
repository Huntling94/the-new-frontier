/** Rule steps per second (D-015). */
export const TICK_RATE = 30;

/**
 * Taken off before rounding seconds up to ticks. Without it, a value that lands
 * a hair over a whole tick through floating-point error would round up too far.
 */
export const ROUNDING_SLACK = 1e-9;

/** Constants of the seeded generator, the published mulberry32. */
export const GENERATOR = {
  increment: 0x6d2b79f5,
  multiplier: 61,
  shiftA: 15,
  shiftB: 7,
  shiftC: 14,
  range: 2 ** 32,
};

/** Constants of the state hash, the published 32-bit FNV-1a. */
export const STATE_HASH = {
  offset: 0x811c9dc5,
  prime: 0x01000193,
  radix: 16,
  width: 8,
};
