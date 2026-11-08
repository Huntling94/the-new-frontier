import { ANVIL, UPGRADES } from '../data/gear';
import { nextRandom } from './random';
import { characterOf } from './family';
import { createItem, itemType } from './items';
import { recalculate } from './stats';
import { zoneOf } from './world';
import type {
  GameEvent,
  GameState,
  GameView,
  GearSlot,
  RefusalReason,
  UpgradeCommand,
} from './state';

export interface UpgradeOffer {
  /** Chance of success, from 0 to 1. */
  readonly chance: number;
  readonly cost: number;
}

/** Safe up to the guaranteed level, and each step past it halves the odds (D-005). */
export function upgradeChance(level: number): number {
  return level < UPGRADES.guaranteedLevel
    ? 1
    : 1 / Math.pow(2, level + 1 - UPGRADES.guaranteedLevel);
}

export function upgradeCost(level: number, slot: GearSlot): number {
  const share = slot === 'main-hand' ? UPGRADES.weaponCostShare : 1;
  return Math.round(UPGRADES.costBase * Math.pow(level + 1, UPGRADES.costPower) * share);
}

/** The odds and cost of an upgrade, or null if there is nothing to offer. */
export function upgradeOffer(state: GameView, unitId: number, slot: GearSlot): UpgradeOffer | null {
  const unit = state.bodies.find((candidate) => candidate.id === unitId);
  const item = unit ? characterOf(state, unit.id).items[slot] : null;
  if (!item || item.upgrade >= UPGRADES.maxLevel) {
    return null;
  }
  const level = item.upgrade;
  return { chance: upgradeChance(level), cost: upgradeCost(level, slot) };
}

/** Whether any living character can reach the zone's anvil, if it has one. */
export function isNearAnvil(state: GameView): boolean {
  const { anvil } = zoneOf(state);
  return (
    anvil !== null &&
    state.bodies.some((unit) => {
      return unit.alive && Math.hypot(unit.x - anvil.x, unit.z - anvil.z) < ANVIL.reach;
    })
  );
}

export function applyUpgrade(
  state: GameState,
  command: UpgradeCommand,
  events: GameEvent[],
): RefusalReason | null {
  const { unitId, slot } = command;
  const unit = state.bodies.find((candidate) => candidate.id === unitId);
  if (!unit) {
    return 'unknown-unit';
  }
  if (!characterOf(state, unit.id).items[slot]) {
    return 'slot-empty';
  }
  if (!isNearAnvil(state)) {
    return 'not-near-anvil';
  }
  const offer = upgradeOffer(state, unitId, slot);
  if (!offer) {
    return 'already-max';
  }
  if (state.family.marks < offer.cost) {
    return 'no-marks';
  }
  state.family.marks -= offer.cost;
  const { tick } = state;
  const character = characterOf(state, unit.id);
  const item = character.items[slot];
  if (!item) {
    return 'slot-empty';
  }
  if (nextRandom(state) < offer.chance) {
    item.upgrade += 1;
    events.push({ type: 'upgraded', tick, unitId, slot, level: item.upgrade });
  } else {
    // The item is gone, and the smith hands over its type's spare (D-005, decision 13).
    character.items[slot] = createItem(state, itemType(item.typeId).spare);
    events.push({ type: 'item-destroyed', tick, unitId, slot, level: item.upgrade });
  }
  recalculate(character, unit);
  return null;
}
