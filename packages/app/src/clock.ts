import { TICK_RATE } from '@new-frontier/core';
import { FEEL } from './feel';

const TICK = 1 / TICK_RATE;

/**
 * Runs whole ticks from real time (D-015), and gives the share of the way to the
 * next tick for drawing in between (decision 2).
 */
export class Clock {
  private carried = 0;
  /** Seconds of slow time left (decision 5). */
  meter = FEEL.slowTime.limit;
  slowed = false;
  /** Speeds ticks up for browser tests (decision 16). */
  speed = 1;
  /** Most ticks one frame may run, so a slow machine cannot freeze. */
  maxTicks = 8;

  /** How many ticks to run this frame. `real` is seconds since the last frame. */
  advance(real: number, wantSlow: boolean): number {
    const seconds = Math.min(real, FEEL.longestFrame);
    const { share, limit, recharge } = FEEL.slowTime;
    this.slowed = wantSlow && this.meter > 0;
    this.meter = this.slowed ? Math.max(0, this.meter - seconds) : Math.min(limit, this.meter + seconds * recharge);
    this.carried += seconds * (this.slowed ? share : 1) * this.speed;
    const ticks = Math.min(Math.floor(this.carried / TICK), Math.max(this.maxTicks, Math.ceil(this.speed * 2)));
    this.carried = Math.min(this.carried - ticks * TICK, TICK);
    return ticks;
  }

  /** The share of the way from the last tick to the next. */
  get alpha(): number {
    return Math.min(this.carried / TICK, 1);
  }
}
