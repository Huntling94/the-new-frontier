import { createGame, ISLAND_SCENARIO, upgradeOffer, type GearSlot } from '@new-frontier/core';
import { describe, expect, it } from 'vitest';
import { anvilRows, oddsText, type AnvilCharacter } from '../src/anvil';

describe('the anvil', () => {
  it('shows every slot it is given, with D-028’s seven, in the gear’s order', () => {
    const slots = ['main-hand', 'off-hand', 'head', 'chest', 'gloves', 'boots', 'necklace'];
    const character: AnvilCharacter = {
      id: 1,
      classId: 'fighter',
      gear: Object.fromEntries(slots.map((slot, index) => [slot, { upgrade: index, spare: slot === 'head' }])),
    };
    const rows = anvilRows(character, (slot) => (slot === 'necklace' ? null : { chance: 1, cost: 100 }), 150);
    expect(rows.map(({ slot }) => slot)).toEqual(slots);
    expect(rows.map(({ name }) => name)).toEqual([
      'Sword',
      'Off Hand +1',
      'Spare Hat +2',
      'Coat +3',
      'Gloves +4',
      'Boots +5',
      'Necklace +6',
    ]);
    expect(rows.find(({ slot }) => slot === 'necklace')).toMatchObject({ offer: null, affordable: false, odds: 'Maxed' });
    expect(rows[0]).toMatchObject({ affordable: true, odds: '+1: guaranteed' });
  });

  it('builds the real squad’s rows from the core’s offers', () => {
    const state = createGame(1, ISLAND_SCENARIO);
    for (const unit of state.units) {
      const rows = anvilRows(unit, (slot) => upgradeOffer(state, unit.id, slot as GearSlot), state.marks);
      expect(rows.map(({ slot }) => slot)).toEqual(Object.keys(unit.gear));
      for (const row of rows) expect(row.offer).toEqual(upgradeOffer(state, unit.id, row.slot as GearSlot));
    }
  });

  it('writes the odds as the squad test did', () => {
    expect(oddsText(3, { chance: 1, cost: 1 })).toBe('+4: guaranteed');
    expect(oddsText(4, { chance: 0.5, cost: 1 })).toBe('+5: 50% or destroyed');
    expect(oddsText(8, { chance: 0.03125, cost: 1 })).toBe('+9: 3.1% or destroyed');
  });
});
