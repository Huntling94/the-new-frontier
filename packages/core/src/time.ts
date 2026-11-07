import { MOVEMENT, SCATTER } from '../data/movement';
import { ROUNDING_SLACK, TICK_RATE } from '../data/sim';

/** Rounds up, so a timer never runs shorter than its data says. */
export function secondsToTicks(seconds: number): number {
  return Math.max(Math.ceil(seconds * TICK_RATE - ROUNDING_SLACK), 0);
}

/** Each timing, converted once. These never change. */
export const TICKS = {
  giveUp: secondsToTicks(MOVEMENT.giveUpSeconds),
  scatterCooldown: secondsToTicks(SCATTER.cooldownSeconds),
  dash: secondsToTicks(SCATTER.dashSeconds),
  invulnerable: secondsToTicks(SCATTER.invulnerableSeconds),
};

/** Turns a per-second value into a per-tick one. */
export function perTick(perSecond: number): number {
  return perSecond / TICK_RATE;
}
