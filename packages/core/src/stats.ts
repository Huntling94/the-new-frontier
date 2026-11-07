import { LEVELS } from '../data/combat';
import { ARMOUR, UPGRADES } from '../data/gear';
import { CLASSES } from '../data/squad';
import type { ClassId, GearItem, GearSlot, Unit } from './state';

export function xpToNextLevel(level: number): number {
  return Math.round(LEVELS.xpBase * Math.pow(level, LEVELS.xpPower));
}

/** A new item for that slot, or the basic spare the smith hands over (D-005). */
export function createItem(classId: ClassId, slot: GearSlot, spare: boolean): GearItem {
  const data = CLASSES[classId];
  const item = { upgrade: 0, spare, attack: 0, ar: 0, crit: 0, defence: 0, dr: 0 };
  if (slot === 'weapon') {
    const share = spare ? UPGRADES.spareWeaponAttackShare : 1;
    return { ...item, attack: Math.round(data.attack * share), ar: data.ar, crit: data.crit };
  }
  const armour = ARMOUR[slot];
  const defence = Math.round(armour.defence * data.armourScale);
  const share = spare ? UPGRADES.spareArmourDefenceShare : 1;
  return { ...item, defence: Math.round(defence * share), dr: armour.dr };
}

export function createGear(classId: ClassId): Record<GearSlot, GearItem> {
  return {
    weapon: createItem(classId, 'weapon', false),
    chest: createItem(classId, 'chest', false),
    gloves: createItem(classId, 'gloves', false),
    boots: createItem(classId, 'boots', false),
  };
}

/** Upgrade levels past the guaranteed ones. */
function pastGuaranteed(item: GearItem): number {
  return Math.max(0, item.upgrade - UPGRADES.guaranteedLevel);
}

/** Works out a unit's stats from its level and gear. New maximum health is added to its health. */
export function recalculate(unit: Unit): void {
  const { level, gear } = unit;
  const { weapon, chest, gloves, boots } = gear;
  const levelPoints = Math.floor(level / LEVELS.levelsPerPoint);
  const levelsGained = level - 1;
  unit.attack =
    weapon.attack *
    (1 + UPGRADES.attackPerLevel * weapon.upgrade) *
    (1 + LEVELS.attackPerLevel * levelsGained);
  unit.ar = weapon.ar + levelPoints + pastGuaranteed(weapon);
  unit.crit = weapon.crit;
  const armour = [chest, gloves, boots];
  unit.defence = armour.reduce(
    (sum, item) => sum + item.defence + item.upgrade * UPGRADES.defencePerLevel,
    0,
  );
  unit.dr = armour.reduce((sum, item) => sum + item.dr + pastGuaranteed(item), levelPoints);
  const maxHealth = Math.round(
    CLASSES[unit.classId].health * (1 + LEVELS.healthPerLevel * levelsGained),
  );
  unit.health = Math.min(maxHealth, unit.health + maxHealth - unit.maxHealth);
  unit.maxHealth = maxHealth;
}
