/** Upgrades (D-005) and armour, from the squad test. */
export const UPGRADES = {
  /** Safe up to this level. After it, each step halves the odds. */
  guaranteedLevel: 4,
  maxLevel: 10,
  costBase: 70,
  costPower: 1.55,
  weaponCostShare: 1.3,
  attackPerLevel: 0.1,
  defencePerLevel: 6,
  spareWeaponAttackShare: 0.85,
  spareArmourDefenceShare: 0.8,
};

export const MARKS = { start: 450 };

/** Def is before the class's armour scale. */
export const ARMOUR = {
  chest: { defence: 34, dr: 3 },
  gloves: { defence: 15, dr: 1 },
  boots: { defence: 15, dr: 1 },
};

/** A living character this close can use the anvil. */
export const ANVIL = { reach: 10 };
