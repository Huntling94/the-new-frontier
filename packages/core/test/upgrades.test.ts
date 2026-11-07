import { describe, expect, it } from 'vitest';
import { ARMOUR, UPGRADES } from '../data/gear';
import { CLASSES } from '../data/squad';
import { applyCommands } from '../src/orders';
import { nextRandom } from '../src/random';
import type { GameState, GearSlot } from '../src/state';
import { isNearAnvil, upgradeChance, upgradeCost, upgradeOffer } from '../src/upgrades';
import { FIGHTER, SNIPER, HEALER, dummyGame, ofType, place, sendAway, unitOf } from './helpers';

function upgrade(state: GameState, unitId: number, slot: GearSlot) {
  return applyCommands(state, [{ type: 'upgrade', unitId, slot }]);
}

function refusal(state: GameState, unitId: number, slot: GearSlot): string | undefined {
  return ofType(upgrade(state, unitId, slot), 'order-refused')[0]?.reason;
}

describe('ge.c bugs that must not come back', () => {
  const levels = Array.from({ length: UPGRADES.maxLevel }, (_, level) => level);

  it('upgrade odds never rise as upgrade level rises', () => {
    for (const level of levels.slice(1)) {
      expect(upgradeChance(level)).toBeLessThanOrEqual(upgradeChance(level - 1));
    }
  });

  it('upgrade odds fall past +4', () => {
    expect(levels.map(upgradeChance)).toEqual([
      1, 1, 1, 1, 0.5, 0.25, 0.125, 0.0625, 0.03125, 0.015625,
    ]);
    for (const level of levels.slice(UPGRADES.guaranteedLevel + 1)) {
      expect(upgradeChance(level)).toBeLessThan(upgradeChance(level - 1));
    }
  });

  it('the odds offered match the odds rolled', () => {
    for (const level of levels) {
      let wins = 0;
      let losses = 0;
      for (let seed = 1; seed <= 300; seed += 1) {
        const state = dummyGame(seed);
        state.marks = 1000000;
        const unit = unitOf(state, SNIPER);
        unit.gear.weapon.upgrade = level;
        const offer = upgradeOffer(state, SNIPER, 'weapon');
        if (!offer) throw new Error('No offer.');
        const roll = nextRandom({ rng: state.rng });
        const events = upgrade(state, SNIPER, 'weapon');
        const won = ofType(events, 'upgraded').length === 1;
        expect(won).toBe(roll < offer.chance);
        expect(ofType(events, 'item-destroyed').length).toBe(won ? 0 : 1);
        wins += won ? 1 : 0;
        losses += won ? 0 : 1;
      }
      expect(wins + losses).toBe(300);
      if (level < UPGRADES.guaranteedLevel) {
        expect(losses).toBe(0);
      }
    }
  });

  it('paying for an upgrade actually takes the money, win or lose', () => {
    const state = dummyGame();
    const offer = upgradeOffer(state, FIGHTER, 'chest');
    upgrade(state, FIGHTER, 'chest');
    expect(state.marks).toBe(450 - (offer?.cost ?? 0));

    let losses = 0;
    for (let seed = 1; seed <= 100; seed += 1) {
      const risky = dummyGame(seed);
      risky.marks = 5000;
      unitOf(risky, FIGHTER).gear.chest.upgrade = 7;
      const cost = upgradeOffer(risky, FIGHTER, 'chest')?.cost ?? 0;
      losses += ofType(upgrade(risky, FIGHTER, 'chest'), 'item-destroyed').length;
      expect(risky.marks).toBe(5000 - cost);
    }
    expect(losses).toBeGreaterThan(0);
  });
});

describe('cost', () => {
  it('follows the squad test, and weapons cost more', () => {
    expect(upgradeCost(0, 'chest')).toBe(70);
    expect(upgradeCost(0, 'weapon')).toBe(91);
    expect(upgradeCost(1, 'boots')).toBe(205);
  });

  it('reaching +5 costs over 2,000', () => {
    const total = [0, 1, 2, 3, 4].reduce((sum, level) => sum + upgradeCost(level, 'chest'), 0);
    expect(total).toBeGreaterThan(2000);
  });
});

describe('upgrade offers', () => {
  it('shows the next step, and nothing past +10 or for an unknown unit', () => {
    const state = dummyGame();
    expect(upgradeOffer(state, FIGHTER, 'gloves')).toEqual({ chance: 1, cost: 70 });
    unitOf(state, FIGHTER).gear.gloves.upgrade = UPGRADES.maxLevel;
    expect(upgradeOffer(state, FIGHTER, 'gloves')).toBeNull();
    expect(upgradeOffer(state, 99, 'gloves')).toBeNull();
  });
});

describe('upgrades', () => {
  it('raises the item and the stats from it', () => {
    const state = dummyGame();
    const unit = unitOf(state, FIGHTER);
    const { attack, defence } = unit;
    const events = upgrade(state, FIGHTER, 'weapon');
    expect(ofType(events, 'upgraded')).toEqual([
      { type: 'upgraded', tick: 0, unitId: FIGHTER, slot: 'weapon', level: 1 },
    ]);
    expect(unit.attack).toBeCloseTo(attack * 1.1, 8);
    upgrade(state, FIGHTER, 'boots');
    expect(unit.defence).toBe(defence + UPGRADES.defencePerLevel);
  });

  it('adds AR and DR only past +4', () => {
    const state = dummyGame();
    const unit = unitOf(state, FIGHTER);
    state.marks = 1000000;
    unit.gear.weapon.upgrade = 4;
    upgrade(state, FIGHTER, 'chest');
    const { ar, dr } = unit;
    unit.gear.chest.upgrade = 5;
    unit.gear.weapon.upgrade = 6;
    unit.gear.boots.upgrade = 3;
    upgrade(state, FIGHTER, 'gloves');
    expect(unit.ar).toBe(ar + 2);
    expect(unit.dr).toBe(dr + 1);
  });

  it('a miss destroys the item, and the smith hands over a basic spare (D-005)', () => {
    const state = dummyGame();
    const unit = unitOf(state, FIGHTER);
    state.marks = 1000000;
    unit.gear.weapon.upgrade = 9;
    unit.gear.chest.upgrade = 9;
    state.rng = 0;
    let weaponGone = false;
    let chestGone = false;
    for (let tries = 0; tries < 50 && !(weaponGone && chestGone); tries += 1) {
      if (!weaponGone) {
        weaponGone = ofType(upgrade(state, FIGHTER, 'weapon'), 'item-destroyed').length === 1;
        if (!weaponGone) unit.gear.weapon.upgrade = 9;
      }
      if (!chestGone) {
        chestGone = ofType(upgrade(state, FIGHTER, 'chest'), 'item-destroyed').length === 1;
        if (!chestGone) unit.gear.chest.upgrade = 9;
      }
    }
    expect(weaponGone && chestGone).toBe(true);
    const { armourScale, attack } = CLASSES.fighter;
    expect(unit.gear.weapon).toMatchObject({
      upgrade: 0,
      spare: true,
      attack: Math.round(attack * 0.85),
    });
    expect(unit.gear.chest).toMatchObject({
      upgrade: 0,
      spare: true,
      defence: Math.round(Math.round(ARMOUR.chest.defence * armourScale) * 0.8),
    });
    expect(unit.attack).toBeCloseTo(53 * 1.14, 8);
  });

  it('is refused without the marks, with nothing taken', () => {
    const state = dummyGame();
    state.marks = 69;
    expect(refusal(state, FIGHTER, 'chest')).toBe('no-marks');
    expect(state.marks).toBe(69);
    expect(unitOf(state, FIGHTER).gear.chest.upgrade).toBe(0);
  });

  it('is refused at +10', () => {
    const state = dummyGame();
    unitOf(state, FIGHTER).gear.boots.upgrade = 10;
    expect(refusal(state, FIGHTER, 'boots')).toBe('already-max');
    expect(state.marks).toBe(450);
  });

  it('is refused for an unknown unit', () => {
    expect(refusal(dummyGame(), 99, 'boots')).toBe('unknown-unit');
  });
});

describe('the anvil', () => {
  it('stands at the waystone, within reach of camp', () => {
    expect(isNearAnvil(dummyGame())).toBe(true);
  });

  it('is out of reach for a squad elsewhere, and refuses the upgrade', () => {
    const state = dummyGame();
    sendAway(state);
    expect(isNearAnvil(state)).toBe(false);
    expect(refusal(state, FIGHTER, 'chest')).toBe('not-near-anvil');
    expect(state.marks).toBe(450);
  });

  it('any living character near it opens every slot, a downed character included', () => {
    const state = dummyGame();
    sendAway(state);
    place(unitOf(state, HEALER), 6, 60);
    unitOf(state, FIGHTER).alive = false;
    expect(isNearAnvil(state)).toBe(true);
    expect(refusal(state, FIGHTER, 'chest')).toBeUndefined();
    expect(unitOf(state, FIGHTER).gear.chest.upgrade).toBe(1);
  });

  it('a downed character beside it does not count', () => {
    const state = dummyGame();
    sendAway(state);
    const fighter = unitOf(state, FIGHTER);
    place(fighter, 6, 60);
    fighter.alive = false;
    expect(isNearAnvil(state)).toBe(false);
  });
});
