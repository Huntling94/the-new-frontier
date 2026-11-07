import type { BotUpgrade } from '../src/state';

/** Auto-combat (D-007), from the squad test. */
export const AUTO = {
  thinkSeconds: 0.5,
  /** Share of health below which it drinks, and below which it stops if it cannot. */
  potionBelow: 0.4,
  dangerBelow: 0.22,
  /** Drops older than this are left, and so are drops this close to the island's centre. */
  dropLifeSeconds: 12,
  dropClearOfCentre: 22,
  /** A path this close to the island's centre swings out to the second radius. */
  arenaRadius: 26,
  detourRadius: 34,
};

/** The test bots, from the squad test. */
export const BOTS = {
  thinkSeconds: 0.2,
  /** Where the squad stands to wake the boss, and the way in from the camp side. */
  bossStart: { x: 0, z: 26 },
  bossApproach: { x: 0, z: 50 },
  /** Heals the lowest ally below this share of health. */
  mendBelow: 0.5,
  potionBelow: 0.3,
  /** Gear is bought in this order, up to this level, so it is never at risk. */
  upgradeBelow: 3,
  upgrades: [
    { classId: 'sniper', slot: 'weapon' },
    { classId: 'fighter', slot: 'weapon' },
    { classId: 'fighter', slot: 'chest' },
    { classId: 'healer', slot: 'chest' },
    { classId: 'sniper', slot: 'chest' },
  ] as readonly BotUpgrade[],
  /** The careful bot dodges a telegraph once it is this far through, if it is small enough. */
  dodgeAfterShare: 0.4,
  dodgeSmallerThan: 20,
  regroupAfterSeconds: 1.4,
};

/** A run counts as finished if the boss dies inside this, and as stalled after the second. */
export const RUNS = {
  tickLimit: 36000,
  stallSeconds: 60,
};
