/** Upgrades (D-005), from the squad test. Spares' shares are in `data/items.ts`. */
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
};

export const MARKS = { start: 450 };

/** A living character this close can use the anvil. */
export const ANVIL = { reach: 10 };
