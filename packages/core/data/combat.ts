/** Nothing resisted. Every hit is physical today, and physical uses none (D-049). */
export const NO_RESISTANCE = { fire: 0, ice: 0, lightning: 0, mental: 0 };

/** The combat maths (D-049). Times are seconds, and rates are per second. */
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
  /** AR below DR takes this off for the difference plus one, down to the floor. */
  accuracyPerPointBelow: 0.1,
  accuracyFloor: 0.1,
  /** Each point of Def takes this share off damage, up to the most reduction. */
  defencePerPoint: 0.005,
  defenceMostReduction: 0.95,
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

/**
 * What share of a kill's XP a character keeps, by its level against the monster's (D-051).
 * "Above" means the character is the higher level. Bands are read in the order here.
 */
export const XP_BANDS = {
  /** More than this far above, plus this share of its own level, earns nothing. */
  noneAbove: 10,
  noneAbovePerLevel: 0.1,
  /** More than this far above earns this share. */
  reducedAbove: 10,
  reducedShare: 0.6,
  /** More than this far below earns this share, which is checked before the next. */
  farBelow: 20,
  farBelowShare: 1.2,
  /** More than this far below earns this share. */
  nearBelow: 5,
  nearBelowShare: 1.4,
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
