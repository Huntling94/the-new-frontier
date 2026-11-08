import { UPGRADES } from '../data/gear';
import { SLOTS } from '../data/items';
import { itemType, inFight, refresh } from './items';
import { isNearSmith } from './npcs';
import { nextRandom } from './random';
import type {
  Character,
  GameEvent,
  GameState,
  GameView,
  GearSlot,
  Item,
  RefusalReason,
  RepairCommand,
  UpgradeCommand,
} from './state';

type ItemRead = GameView['family']['inventory'][number];

export interface UpgradeOffer {
  /** Chance of success, from 0 to 1. */
  readonly chance: number;
  readonly cost: number;
}

/** Safe up to the guaranteed level, and each step past it halves the odds (D-042). */
export function upgradeChance(level: number): number {
  return level < UPGRADES.guaranteedLevel
    ? 1
    : 1 / Math.pow(2, level + 1 - UPGRADES.guaranteedLevel);
}

/** What a step costs. Every weapon pays the main hand's share, wherever it is (S3e decision 9). */
export function upgradeCost(level: number, typeId: string): number {
  const share = itemType(typeId).weapon ? UPGRADES.weaponCostShare : 1;
  return Math.round(UPGRADES.costBase * Math.pow(level + 1, UPGRADES.costPower) * share);
}

/** Weapons and armour go to the smith. Jewellery never does (D-042). */
export function isUpgradable(typeId: string): boolean {
  return itemType(typeId).category !== 'jewellery';
}

/** Any item the family owns: in the inventory, or worn by any character. */
export function findItem(state: GameView, itemId: number): ItemRead | null {
  const inInventory = state.family.inventory.find(({ id }) => id === itemId);
  if (inInventory) {
    return inInventory;
  }
  for (const character of state.family.characters) {
    for (const slot of SLOTS) {
      const held = character.items[slot];
      if (held?.id === itemId) {
        return held;
      }
    }
  }
  return null;
}

/** The odds and cost of the next step, or null if there is nothing to offer. */
export function upgradeOffer(state: GameView, itemId: number): UpgradeOffer | null {
  const item = findItem(state, itemId);
  if (!item || item.broken || !isUpgradable(item.typeId) || item.upgrade >= UPGRADES.maxLevel) {
    return null;
  }
  return { chance: upgradeChance(item.upgrade), cost: upgradeCost(item.upgrade, item.typeId) };
}

/** The fee to mend a broken item, or null if it is not broken (S3e decision 8). */
export function repairCost(state: GameView, itemId: number): number | null {
  const item = findItem(state, itemId);
  return item?.broken ? Math.round(upgradeCost(item.upgrade, item.typeId) * UPGRADES.repairFeeShare) : null;
}

interface Held {
  readonly item: Item;
  readonly wearer: { readonly character: Character; readonly slot: GearSlot } | null;
}

function held(state: GameState, itemId: number): Held | null {
  const item = state.family.inventory.find(({ id }) => id === itemId);
  if (item) {
    return { item, wearer: null };
  }
  for (const character of state.family.characters) {
    for (const slot of SLOTS) {
      const worn = character.items[slot];
      if (worn?.id === itemId) {
        return { item: worn, wearer: { character, slot } };
      }
    }
  }
  return null;
}

/** What stops any work at the smith: being out of reach, or a fight. */
function smithRefusal(state: GameState): RefusalReason | null {
  if (!isNearSmith(state)) {
    return 'not-near-smith';
  }
  return inFight(state) ? 'in-fight' : null;
}

/** A miss leaves the item at its level and marks it broken. If worn, it goes to the inventory (D-042). */
function breakItem(state: GameState, { item, wearer }: Held): void {
  item.broken = true;
  if (wearer) {
    wearer.character.items[wearer.slot] = null;
    state.family.inventory.push(item);
  }
}

export function applyUpgrade(state: GameState, command: UpgradeCommand, events: GameEvent[]): RefusalReason | null {
  const found = held(state, command.itemId);
  if (!found) {
    return 'unknown-item';
  }
  const { item, wearer } = found;
  if (!isUpgradable(item.typeId)) {
    return 'not-upgradable';
  }
  if (item.broken) {
    return 'broken';
  }
  const refusal = smithRefusal(state);
  if (refusal) {
    return refusal;
  }
  const offer = upgradeOffer(state, item.id);
  if (!offer) {
    return 'already-max';
  }
  if (state.family.marks < offer.cost) {
    return 'no-marks';
  }
  state.family.marks -= offer.cost;
  const { tick } = state;
  if (nextRandom(state) < offer.chance) {
    item.upgrade += 1;
    events.push({ type: 'upgraded', tick, itemId: item.id, level: item.upgrade });
  } else {
    breakItem(state, found);
    events.push({ type: 'item-broken', tick, itemId: item.id, level: item.upgrade });
  }
  if (wearer) {
    refresh(state, wearer.character);
  }
  return null;
}

/** Repair never fails: the item comes back at +4, for a fee (D-042). */
export function applyRepair(state: GameState, command: RepairCommand, events: GameEvent[]): RefusalReason | null {
  const found = held(state, command.itemId);
  if (!found) {
    return 'unknown-item';
  }
  const { item } = found;
  const fee = repairCost(state, item.id);
  if (fee === null) {
    return 'not-broken';
  }
  const refusal = smithRefusal(state);
  if (refusal) {
    return refusal;
  }
  if (state.family.marks < fee) {
    return 'no-marks';
  }
  state.family.marks -= fee;
  item.broken = false;
  item.upgrade = UPGRADES.repairLevel;
  events.push({ type: 'repaired', tick: state.tick, itemId: item.id, level: item.upgrade });
  return null;
}
