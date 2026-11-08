import { describe, expect, it } from 'vitest';
import { UPGRADES } from '../data/gear';
import { ISLAND_SCENARIO, TOWN_SCENARIO } from '../data/scenarios';
import { createGame, step } from '../src/game';
import { isNearSmith, whyNotTalk } from '../src/npcs';
import { applyCommands } from '../src/orders';
import { nextRandom } from '../src/random';
import { smithEntries } from '../src/reads';
import type { GameState, Item } from '../src/state';
import { repairCost, upgradeChance, upgradeCost, upgradeOffer } from '../src/upgrades';
import { zoneData } from '../src/world';
import { FIGHTER, HEALER, SNIPER, ofType, place, unitOf, itemAt } from './helpers';

const SMITH = zoneData('montclaire').npcs[0]?.at;
if (!SMITH) throw new Error('Montclaire needs its smith.');
const { x: SMITH_X, z: SMITH_Z } = SMITH;

/** A game in Montclaire with the squad standing at the smith's door. */
function atSmith(seed = 1): GameState {
  const state = createGame(seed, TOWN_SCENARIO);
  for (const unit of state.bodies) place(unit, SMITH_X, SMITH_Z + unit.id);
  return state;
}

function inventoryItem(state: GameState, typeId: string): Item {
  const item = state.family.inventory.find((held) => held.typeId === typeId);
  if (!item) throw new Error(`No ${typeId} in the inventory.`);
  return item;
}

function upgrade(state: GameState, itemId: number) {
  return applyCommands(state, [{ type: 'upgrade', itemId }]);
}

function refusal(state: GameState, itemId: number): string | undefined {
  return ofType(upgrade(state, itemId), 'order-refused')[0]?.reason;
}

/** Walks the generator on until the next roll misses at these odds. */
function rollUntilMiss(state: GameState, chance: number): void {
  while (nextRandom({ rng: state.rng }) < chance) nextRandom(state);
}

function awakeEnemy(state: GameState): void {
  const island = createGame(1, ISLAND_SCENARIO);
  const [monster] = island.live.enemies;
  if (!monster) throw new Error('No monster.');
  state.live.enemies.push({ ...monster, awake: true });
}

describe('odds', () => {
  const levels = Array.from({ length: UPGRADES.maxLevel }, (_, level) => level);

  it('do not change: safe to +4, then 50% and halving to +10 (D-042)', () => {
    expect(levels.map(upgradeChance)).toEqual([1, 1, 1, 1, 0.5, 0.25, 0.125, 0.0625, 0.03125, 0.015625]);
  });

  it.each(levels)('from +%s succeed at the offered chance across 10,000 seeded tries, within 1%', (level) => {
    const state = atSmith(level + 1);
    state.family.marks = Number.MAX_SAFE_INTEGER;
    const cap = inventoryItem(state, 'cap');
    let wins = 0;
    for (let tries = 0; tries < 10000; tries += 1) {
      cap.upgrade = level;
      cap.broken = false;
      wins += ofType(upgrade(state, cap.id), 'upgraded').length;
    }
    expect(Math.abs(wins / 10000 - upgradeChance(level))).toBeLessThan(0.01);
    if (level < UPGRADES.guaranteedLevel) expect(wins).toBe(10000);
  });

  it('the roll decides exactly as offered', () => {
    for (let seed = 1; seed <= 300; seed += 1) {
      const state = atSmith(seed);
      state.family.marks = 1000000;
      const rifle = itemAt(state, SNIPER, 'main-hand');
      rifle.upgrade = 4;
      const offer = upgradeOffer(state, rifle.id);
      if (!offer) throw new Error('No offer.');
      const roll = nextRandom({ rng: state.rng });
      const events = upgrade(state, rifle.id);
      expect(ofType(events, 'upgraded').length).toBe(roll < offer.chance ? 1 : 0);
      expect(ofType(events, 'item-broken').length).toBe(roll < offer.chance ? 0 : 1);
    }
  });
});

describe('cost', () => {
  it('does not change, and every weapon pays the main hand’s share, wherever it is (S3e decision 9)', () => {
    expect(upgradeCost(0, 'metal-chest')).toBe(70);
    expect(upgradeCost(0, 'sword')).toBe(91);
    expect(upgradeCost(1, 'leather-boots')).toBe(205);
    expect(upgradeCost(0, 'buckler')).toBe(70);
  });

  it('takes the money, win or lose', () => {
    const state = atSmith();
    state.family.marks = 5000;
    const chest = itemAt(state, FIGHTER, 'chest');
    chest.upgrade = 7;
    const cost = upgradeOffer(state, chest.id)?.cost ?? 0;
    rollUntilMiss(state, upgradeChance(7));
    upgrade(state, chest.id);
    expect(state.family.marks).toBe(5000 - cost);
  });
});

describe('what the smith works on (D-042)', () => {
  it('lists every weapon and armour item, by wearer and then the inventory, and no jewellery', () => {
    const state = atSmith();
    const entries = smithEntries(state);
    expect(entries.filter(({ wearerId }) => wearerId === FIGHTER).map(({ item }) => item.typeId)).toEqual(['sword', 'metal-chest', 'metal-gloves', 'metal-boots']);
    expect(entries.filter(({ wearerId }) => wearerId === null).map(({ item }) => item.typeId)).toEqual(['cap', 'buckler']);
    expect(entries.map(({ wearerId }) => wearerId).lastIndexOf(FIGHTER)).toBeLessThan(entries.map(({ wearerId }) => wearerId).indexOf(null));
    expect(entries.some(({ item }) => item.typeId === 'necklace')).toBe(false);
  });

  it('upgrades a worn item and an inventory item', () => {
    const state = atSmith();
    const sword = itemAt(state, FIGHTER, 'main-hand');
    const cap = inventoryItem(state, 'cap');
    const { attack } = unitOf(state, FIGHTER);
    expect(ofType(upgrade(state, sword.id), 'upgraded')).toEqual([{ type: 'upgraded', tick: 0, itemId: sword.id, level: 1 }]);
    expect(ofType(upgrade(state, cap.id), 'upgraded')).toEqual([{ type: 'upgraded', tick: 0, itemId: cap.id, level: 1 }]);
    expect(cap.upgrade).toBe(1);
    expect(unitOf(state, FIGHTER).attack).toBeCloseTo(attack * 1.1, 8);
  });

  it('refuses jewellery, worn or not', () => {
    const state = atSmith();
    const necklace = inventoryItem(state, 'necklace');
    expect(refusal(state, necklace.id)).toBe('not-upgradable');
    expect(upgradeOffer(state, necklace.id)).toBeNull();
    const worn = createGame(1, TOWN_SCENARIO);
    for (const unit of worn.bodies) place(unit, SMITH_X, SMITH_Z + unit.id);
    expect(refusal(worn, inventoryItem(worn, 'necklace').id)).toBe('not-upgradable');
  });

  it('adds AR and DR only past +4', () => {
    const state = atSmith();
    state.family.marks = 1000000;
    const unit = unitOf(state, FIGHTER);
    const sword = itemAt(state, FIGHTER, 'main-hand');
    const chest = itemAt(state, FIGHTER, 'chest');
    sword.upgrade = 3;
    chest.upgrade = 3;
    upgrade(state, sword.id);
    upgrade(state, chest.id);
    const { ar, dr } = unit;
    sword.upgrade = 5;
    chest.upgrade = 5;
    upgrade(state, itemAt(state, FIGHTER, 'gloves').id);
    expect(unit.ar).toBe(ar + 1);
    expect(unit.dr).toBe(dr + 1);
  });

  it('refuses without the marks, and at +10, taking nothing', () => {
    const state = atSmith();
    state.family.marks = 69;
    const chest = itemAt(state, FIGHTER, 'chest');
    expect(refusal(state, chest.id)).toBe('no-marks');
    expect(state.family.marks).toBe(69);
    const boots = itemAt(state, FIGHTER, 'boots');
    boots.upgrade = 10;
    expect(refusal(state, boots.id)).toBe('already-max');
    expect(upgradeOffer(state, boots.id)).toBeNull();
    expect(refusal(state, 9999)).toBe('unknown-item');
  });
});

describe('a miss (D-042)', () => {
  function missedRifle(): { state: GameState; rifle: Item } {
    const state = atSmith();
    state.family.marks = 5000;
    const rifle = itemAt(state, SNIPER, 'main-hand');
    rifle.upgrade = 5;
    rollUntilMiss(state, upgradeChance(5));
    upgrade(state, rifle.id);
    return { state, rifle };
  }

  it('leaves the item broken, at its level, in the inventory, and its slot empty', () => {
    const { state, rifle } = missedRifle();
    expect(rifle).toMatchObject({ typeId: 'rifle', upgrade: 5, broken: true });
    expect(state.family.inventory).toContain(rifle);
    expect(state.family.characters.find(({ id }) => id === SNIPER)?.items['main-hand']).toBeNull();
  });

  it('leaves an empty main hand fighting with the unarmed type', () => {
    const before = atSmith();
    const { state } = missedRifle();
    expect(unitOf(state, SNIPER).attack).toBeLessThan(unitOf(before, SNIPER).attack);
  });

  it('cannot be equipped, and the refusal is `broken`', () => {
    const { state, rifle } = missedRifle();
    const [refused] = ofType(applyCommands(state, [{ type: 'equip', unitId: SNIPER, itemId: rifle.id, slot: 'main-hand' }]), 'order-refused');
    expect(refused?.reason).toBe('broken');
    expect(state.family.inventory).toContain(rifle);
  });

  it('cannot be upgraded until it is repaired', () => {
    const { state, rifle } = missedRifle();
    expect(refusal(state, rifle.id)).toBe('broken');
  });

  it('repairs to +4, unbroken, for half what the failed step cost, and never fails', () => {
    const { state, rifle } = missedRifle();
    const fee = Math.round(upgradeCost(5, 'rifle') * UPGRADES.repairFeeShare);
    expect(repairCost(state, rifle.id)).toBe(fee);
    const marks = state.family.marks;
    const { rng } = state;
    const events = applyCommands(state, [{ type: 'repair', itemId: rifle.id }]);
    expect(ofType(events, 'repaired')).toEqual([{ type: 'repaired', tick: 0, itemId: rifle.id, level: 4 }]);
    expect(rifle).toMatchObject({ upgrade: 4, broken: false });
    expect(state.family.marks).toBe(marks - fee);
    expect(state.rng).toBe(rng);
    expect(applyCommands(state, [{ type: 'equip', unitId: SNIPER, itemId: rifle.id, slot: 'main-hand' }]).map(({ type }) => type)).toContain('equipped');
  });

  it('refuses a repair for an item that is not broken, or with too few marks', () => {
    const { state, rifle } = missedRifle();
    const [notBroken] = ofType(applyCommands(state, [{ type: 'repair', itemId: itemAt(state, FIGHTER, 'chest').id }]), 'order-refused');
    expect(notBroken?.reason).toBe('not-broken');
    state.family.marks = 0;
    const [poor] = ofType(applyCommands(state, [{ type: 'repair', itemId: rifle.id }]), 'order-refused');
    expect(poor?.reason).toBe('no-marks');
  });
});

describe('reach and talking (D-044)', () => {
  const smithId = 'smith';

  it('works within reach of a living character in the three', () => {
    const state = atSmith();
    expect(isNearSmith(state)).toBe(true);
    expect(whyNotTalk(state, smithId)).toBeNull();
  });

  it('counts only the living: any one at the door is enough, a body on the floor is not', () => {
    const state = atSmith();
    for (const unit of state.bodies) place(unit, -60, 0);
    place(unitOf(state, HEALER), SMITH_X, SMITH_Z);
    expect(whyNotTalk(state, smithId)).toBeNull();
    unitOf(state, HEALER).alive = false;
    expect(whyNotTalk(state, smithId)).toBe('not-near-npc');
  });

  it('refuses work at the smith from out of reach', () => {
    const state = atSmith();
    for (const unit of state.bodies) place(unit, -9, -17);
    expect(refusal(state, itemAt(state, FIGHTER, 'chest').id)).toBe('not-near-smith');
    expect(state.family.marks).toBe(450);
  });

  it('is refused while any enemy is awake, and works once none is', () => {
    const state = atSmith();
    awakeEnemy(state);
    expect(whyNotTalk(state, smithId)).toBe('in-fight');
    expect(refusal(state, itemAt(state, FIGHTER, 'chest').id)).toBe('in-fight');
    state.live.enemies.length = 0;
    expect(whyNotTalk(state, smithId)).toBeNull();
  });

  it('is unknown for an NPC not in this zone', () => {
    expect(whyNotTalk(createGame(1, ISLAND_SCENARIO), smithId)).toBe('unknown-npc');
  });
});

describe('the field anvil is gone (D-039)', () => {
  it('the Lande holds no smith, so an upgrade there is refused', () => {
    const state = createGame(1, ISLAND_SCENARIO);
    expect(isNearSmith(state)).toBe(false);
    const [refused] = ofType(step(state, [{ type: 'upgrade', itemId: itemAt(state, FIGHTER, 'chest').id }]), 'order-refused');
    expect(refused?.reason).toBe('not-near-smith');
  });
});
