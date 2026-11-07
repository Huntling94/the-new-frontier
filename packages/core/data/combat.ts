/** The squad test's combat maths. Times are seconds, and rates are per second. */
export const COMBAT = {
  attackModifier: 1.6,
  critMultiplier: 2,
  /** Crit chance is a percentage. */
  critRange: 100,
  rallyMultiplier: 1.3,
  staggerMultiplier: 1.5,
  guardMultiplier: 0.3,
  minDamage: 1,
  /** AR above DR adds this per point, up to the most extra. */
  accuracyPerPointAbove: 0.25,
  accuracyMostExtra: 2,
  /** AR below DR takes this off per point, down to the floor. */
  accuracyPerPointBelow: 0.1,
  accuracyFloor: 0.1,
  /** Each point of Def takes this share off damage, up to the most reduction. */
  defencePerPoint: 0.005,
  defenceMostReduction: 0.75,
  /** Brief invulnerability after being hit. */
  hitInvulnerableSeconds: 0.18,
  /** Share of an enemy's size that counts towards melee range. */
  meleeSizeShare: 0.8,
  /** Share of knockback left after a second. */
  knockbackLeftPerSecond: 0.003,
};

export const SHOTS = {
  speed: 90,
  lifeSeconds: 1.2,
  /** Share of an enemy's size that a shot needs to reach. */
  sizeShare: 0.5,
};

/** How the core picks an enemy for a single-target shot. */
export const AIM = {
  /** An enemy this close to the point counts as aimed at. */
  pointRadius: 12,
  /** Nothing aimed at, so the nearest enemy within this. */
  fallbackRange: 34,
};

export const AUTO_HEAL = {
  /** Allies below this share of health are healed. */
  belowShare: 0.85,
  range: 22,
  manaCost: 14,
  seconds: 1.1,
  healthShare: 0.09,
  attackShare: 2,
  /** With an enemy about, the Healer stays this close to the others. */
  stayWithin: 12,
};

export const MANA = { regenPerSecond: 10 };

export const POTIONS = {
  start: 6,
  cooldownSeconds: 1.5,
  healthShare: 0.4,
};

export const LEVELS = {
  start: 3,
  xpBase: 160,
  xpPower: 1.4,
  attackPerLevel: 0.07,
  healthPerLevel: 0.1,
  /** Each this many levels adds a point of AR and of DR. */
  levelsPerPoint: 4,
};
