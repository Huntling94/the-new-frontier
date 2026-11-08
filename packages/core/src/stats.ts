import { LEVELS } from '../data/combat';
import { UPGRADES } from '../data/gear';
import { SLOTS } from '../data/items';
import { CLASSES } from '../data/squad';
import { itemType, weaponOf } from './items';
import type { Body, Character, Item } from './state';

export function xpToNextLevel(level: number): number {
  return Math.round(LEVELS.xpBase * Math.pow(level, LEVELS.xpPower));
}

/** Upgrade levels past the guaranteed ones. */
function pastGuaranteed(item: Item): number {
  return Math.max(0, item.upgrade - UPGRADES.guaranteedLevel);
}

/**
 * Works out a body's stats from its character's level and items (decision 14). They
 * are calculated, never saved. New maximum health is added to its health.
 *
 * Attack comes from the weapon in hand, or the unarmed type. Armour's Def is scaled by
 * the class's armour skill. Upgrades past +4 add AR on a weapon and DR on anything else.
 */
export function recalculate(character: Character, unit: Body): void {
  const { level, items } = character;
  const { armourScale, health } = CLASSES[character.classId];
  const levelPoints = Math.floor(level / LEVELS.levelsPerPoint);
  const levelsGained = level - 1;
  const held = items['main-hand'];
  const heldType = held ? itemType(held.typeId) : null;
  const fighting = heldType?.weapon && held ? held : null;
  const { stats } = weaponOf(character);
  unit.attack =
    stats.attack *
    (1 + UPGRADES.attackPerLevel * (fighting?.upgrade ?? 0)) *
    (1 + LEVELS.attackPerLevel * levelsGained);
  let ar = stats.ar + levelPoints + (fighting ? pastGuaranteed(fighting) : 0);
  let crit = stats.crit;
  let defence = 0;
  let dr = levelPoints;
  for (const slot of SLOTS) {
    const item = items[slot];
    if (!item || item === fighting) {
      continue;
    }
    const type = itemType(item.typeId);
    ar += type.stats.ar;
    crit += type.stats.crit;
    defence +=
      Math.round(type.stats.defence * armourScale) +
      item.upgrade * UPGRADES.defencePerLevel;
    dr += type.stats.dr + pastGuaranteed(item);
  }
  unit.ar = ar;
  unit.crit = crit;
  unit.defence = defence;
  unit.dr = dr;
  const maxHealth = Math.round(health * (1 + LEVELS.healthPerLevel * levelsGained));
  unit.health = Math.min(maxHealth, unit.health + maxHealth - unit.maxHealth);
  unit.maxHealth = maxHealth;
}
