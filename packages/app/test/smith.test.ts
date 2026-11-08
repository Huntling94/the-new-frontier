import { createGame, TOWN_SCENARIO, type GameState } from '@new-frontier/core';
import { describe, expect, it } from 'vitest';
import { oddsText, smithGroups } from '../src/smith';

/** The smith's door, from the town's data. */
function game(): GameState {
  return createGame(1, TOWN_SCENARIO);
}

describe('the smith’s screen', () => {
  it('groups every weapon and armour by who wears it, then the inventory, with no jewellery (S3e decision 5)', () => {
    const groups = smithGroups(game());
    expect(groups.map(({ title }) => title)).toEqual(['Aurelio, Fighter', 'Inês, Sniper', 'Mireille, Healer', 'Inventory']);
    expect(groups[0]?.rows.map(({ name }) => name)).toEqual(['Sword', 'Metal Armour', 'Metal Gloves', 'Metal Boots']);
    expect(groups[3]?.rows.map(({ name }) => name)).toEqual(['Leather Cap', 'Buckler']);
    const names = groups.flatMap(({ rows }) => rows.map(({ name }) => name));
    expect(names.some((name) => name.includes('Necklace'))).toBe(false);
  });

  it('offers each item its next step, with what it costs and whether it is affordable', () => {
    const state = game();
    state.family.marks = 90;
    const [sword, chest] = smithGroups(state)[0]?.rows ?? [];
    expect(sword).toMatchObject({ action: 'upgrade', cost: 91, chance: 1, affordable: false, odds: '+1: guaranteed' });
    expect(chest).toMatchObject({ action: 'upgrade', cost: 70, affordable: true });
  });

  it('shows a broken item with its repair', () => {
    const state = game();
    const cap = state.family.inventory.find(({ typeId }) => typeId === 'cap');
    if (!cap) throw new Error('No cap.');
    cap.upgrade = 6;
    cap.broken = true;
    const row = smithGroups(state)[3]?.rows.find(({ itemId }) => itemId === cap.id);
    expect(row).toMatchObject({ name: 'Leather Cap +6', action: 'repair', chance: null, odds: 'Broken at +6. Repair to +4' });
  });

  it('says what a miss does before every step that can fail (S3e decision 6)', () => {
    expect(oddsText(3, { chance: 1, cost: 1 })).toBe('+4: guaranteed');
    expect(oddsText(4, { chance: 0.5, cost: 1 })).toBe('+5: 50%. A miss breaks the item');
    expect(oddsText(8, { chance: 0.03125, cost: 1 })).toBe('+9: 3.1%. A miss breaks the item');
    expect(oddsText(10, null)).toBe('Maxed');
  });
});
