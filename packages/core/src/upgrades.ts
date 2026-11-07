import { ANVIL, UPGRADES } from '../data/gear';
import { ZONES } from '../data/zones';
import { nextRandom } from './random';
import { createItem, recalculate } from './stats';
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
  const share = slot === 'weapon' ? UPGRADES.weaponCostShare : 1;
  return Math.round(UPGRADES.costBase * Math.pow(level + 1, UPGRADES.costPower) * share);
}

/** The odds and cost of an upgrade, or null if there is nothing to offer. */
export function upgradeOffer(state: GameView, unitId: number, slot: GearSlot): UpgradeOffer | null {
  const unit = state.units.find((candidate) => candidate.id === unitId);
  if (!unit || unit.gear[slot].upgrade >= UPGRADES.maxLevel) {
    return null;
  }
  const level = unit.gear[slot].upgrade;
  return { chance: upgradeChance(level), cost: upgradeCost(level, slot) };
}

/** Whether any living character can reach an anvil. */
export function isNearAnvil(state: GameView): boolean {
  return ZONES.some(({ anvil }) =>
    state.units.some((unit) => {
      return unit.alive && Math.hypot(unit.x - anvil.x, unit.z - anvil.z) < ANVIL.reach;
    }),
  );
}

export function applyUpgrade(
  state: GameState,
  command: UpgradeCommand,
  events: GameEvent[],
): RefusalReason | null {
  const { unitId, slot } = command;
  const unit = state.units.find((candidate) => candidate.id === unitId);
  if (!unit) {
    return 'unknown-unit';
  }
  if (!isNearAnvil(state)) {
    return 'not-near-anvil';
  }
  const offer = upgradeOffer(state, unitId, slot);
  if (!offer) {
    return 'already-max';
  }
  if (state.marks < offer.cost) {
    return 'no-marks';
  }
  state.marks -= offer.cost;
  const { tick } = state;
  const item = unit.gear[slot];
  if (nextRandom(state) < offer.chance) {
    item.upgrade += 1;
    events.push({ type: 'upgraded', tick, unitId, slot, level: item.upgrade });
  } else {
    unit.gear[slot] = createItem(unit.classId, slot, true);
    events.push({ type: 'item-destroyed', tick, unitId, slot, level: item.upgrade });
  }
  recalculate(unit);
  return null;
}
