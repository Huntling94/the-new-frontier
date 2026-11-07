import { GENERATOR } from '../data/sim';

/** The generator keeps nothing of its own: its whole state sits in game state (D-015). */
interface HasGenerator {
  rng: number;
}

/** The next value, from 0 up to but not including 1. */
export function nextRandom(state: HasGenerator): number {
  const { increment, multiplier, shiftA, shiftB, shiftC, range } = GENERATOR;
  state.rng = (state.rng + increment) >>> 0;
  let mixed = Math.imul(state.rng ^ (state.rng >>> shiftA), 1 | state.rng);
  mixed ^= mixed + Math.imul(mixed ^ (mixed >>> shiftB), multiplier | mixed);
  return ((mixed ^ (mixed >>> shiftC)) >>> 0) / range;
}

export function randomBetween(state: HasGenerator, low: number, high: number): number {
  return low + nextRandom(state) * (high - low);
}
