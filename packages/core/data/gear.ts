/** Upgrades (D-042), from the squad test. Costs and the repair fee are placeholders until balance. */
export const UPGRADES = {
  /** Safe up to this level. After it, each step halves the odds. */
  guaranteedLevel: 4,
  maxLevel: 10,
  costBase: 70,
  costPower: 1.55,
  /** The main hand's upgrades cost this much more. */
  weaponCostShare: 1.3,
  attackPerLevel: 0.1,
  defencePerLevel: 6,
  /** A broken item comes back at this level (D-042). */
  repairLevel: 4,
  /** The repair fee, as a share of what the failed step cost (S3e decision 8). */
  repairFeeShare: 0.5,
};

export const MARKS = { start: 450 };

/** A living character this close can talk to an NPC (S3e decision 2). */
export const NPC_TALK = { reach: 10 };
