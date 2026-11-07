import type { EnemyData } from '../src/state';

/**
 * A level 5 Tide Crab with far more health and a longer reach. A crab walks in
 * to hit, but the dummy stands still, so a crab's reach would miss a Fighter at
 * the edge of melee range. These are not balance.
 */
export const DUMMY: EnemyData = {
  level: 5,
  health: 34000,
  attack: 89,
  ar: 3,
  dr: 3,
  defence: 19,
  size: 1.15,
  reach: 5.5,
  xp: 338,
  strikeSeconds: 1,
  respawnSeconds: 10,
  knockbackShare: 1,
};
