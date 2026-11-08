import { describe, expect, it } from 'vitest';
import { LEVELS } from '../data/combat';
import { SLOTS, STARTING_INVENTORY, UNARMED } from '../data/items';
import { EMPTY_SCENARIO } from '../data/scenarios';
import { CLASSES } from '../data/squad';
import { characterOf } from '../src/family';
import { createGame } from '../src/game';
import { createItem, everyItem, itemType } from '../src/items';
import { applyCommands } from '../src/orders';
import { nextRandom } from '../src/random';
import { previewChange } from '../src/reads';
import type { Command, GameState } from '../src/state';
import { FIGHTER, HEALER, SNIPER, dummyGame, dummyOf, itemAt, ofType, place, run, sendAway, unitOf } from './helpers';

const refusals = (state: GameState, commands: readonly Command[]): string[] =>
  ofType(applyCommands(state, commands), 'order-refused').map(({ reason }) => reason);

function inventoryItem(state: GameState, typeId: string): number {
  const found = state.family.inventory.find((item) => item.typeId === typeId);
  if (found) return found.id;
  const item = createItem(state, typeId);
  state.family.inventory.push(item);
  return item.id;
}

describe('items (S3b decisions 7 to 14)', () => {
  it('start on each class as its weapon and armour, with the inventory holding a cap, buckler and necklace', () => {
    const state = createGame(1, EMPTY_SCENARIO);
    const typesOf = (id: number): (string | null)[] => SLOTS.map((slot) => characterOf(state, id).items[slot]?.typeId ?? null);
    expect(typesOf(FIGHTER)).toEqual(['sword', null, null, 'metal-chest', 'metal-gloves', 'metal-boots', null]);
    expect(typesOf(SNIPER)).toEqual(['rifle', null, null, 'leather-chest', 'leather-gloves', 'leather-boots', null]);
    expect(typesOf(HEALER)).toEqual(['staff', null, null, 'coat-chest', 'coat-gloves', 'coat-boots', null]);
    expect(state.family.inventory.map(({ typeId }) => typeId)).toEqual(STARTING_INVENTORY);
  });

  it('count their IDs apart, so unit and enemy IDs do not move', () => {
    const state = createGame(1, EMPTY_SCENARIO);
    const ids = everyItem(state).map(({ item }) => item.id).sort((a, b) => a - b);
    expect(ids).toEqual(Array.from({ length: 15 }, (_, index) => index + 1));
    expect(state.nextItemId).toBe(16);
    expect(state.nextId).toBe(4);
  });

  it('keep every number a character fights with (decision 10)', () => {
    const state = dummyGame();
    const fighter = unitOf(state, FIGHTER);
    // The squad test's Fighter at level 3: 62 attack × 1.14, AR 4, crit 8, Def of 46 + 20 + 20, DR 5.
    expect(fighter.attack).toBeCloseTo(70.68, 8);
    expect([fighter.ar, fighter.crit, fighter.defence, fighter.dr]).toEqual([4, 8, 86, 5]);
    expect(itemType('rifle').weapon).toEqual({ range: 25, attackSeconds: 1.05, knockback: 0, melee: false, attackStat: 'ranged' });
  });

  it('let the rifle and staff fill both hands, and the sword one (decision 10)', () => {
    expect(itemType('rifle').fills).toEqual(['off-hand']);
    expect(itemType('staff').fills).toEqual(['off-hand']);
    expect(itemType('sword').fills).toEqual([]);
  });

});

describe('equip and unequip (decision 17)', () => {
  it('moves the cap from the inventory onto the Fighter, and back', () => {
    const state = dummyGame();
    const cap = inventoryItem(state, 'cap');
    const defence = unitOf(state, FIGHTER).defence;
    const events = applyCommands(state, [{ type: 'equip', unitId: FIGHTER, itemId: cap, slot: 'head' }]);
    expect(ofType(events, 'equipped')).toHaveLength(1);
    expect(itemAt(state, FIGHTER, 'head').id).toBe(cap);
    expect(state.family.inventory.some(({ id }) => id === cap)).toBe(false);
    expect(unitOf(state, FIGHTER).defence).toBe(defence + Math.round(Math.round(8 * CLASSES.fighter.armourScale)));
    applyCommands(state, [{ type: 'unequip', unitId: FIGHTER, slot: 'head' }]);
    expect(characterOf(state, FIGHTER).items.head).toBeNull();
    expect(state.family.inventory.some(({ id }) => id === cap)).toBe(true);
    expect(unitOf(state, FIGHTER).defence).toBe(defence);
  });

  it('sends whatever was in the slot back to the inventory', () => {
    const state = dummyGame();
    const sword = itemAt(state, FIGHTER, 'main-hand').id;
    const spare = inventoryItem(state, 'sword');
    applyCommands(state, [{ type: 'equip', unitId: FIGHTER, itemId: spare, slot: 'main-hand' }]);
    expect(itemAt(state, FIGHTER, 'main-hand').id).toBe(spare);
    expect(state.family.inventory.map(({ id }) => id)).toContain(sword);
  });

  it('empties the off hand into the inventory when a two-handed weapon goes in, and the reverse (rule 2)', () => {
    const state = dummyGame();
    characterOf(state, FIGHTER).arts.push('marksmanship');
    const buckler = inventoryItem(state, 'buckler');
    const sword = itemAt(state, FIGHTER, 'main-hand').id;
    applyCommands(state, [{ type: 'equip', unitId: FIGHTER, itemId: buckler, slot: 'off-hand' }]);
    expect(itemAt(state, FIGHTER, 'off-hand').id).toBe(buckler);
    const rifle = inventoryItem(state, 'rifle');
    const preview = previewChange(state, { type: 'equip', unitId: FIGHTER, itemId: rifle, slot: 'main-hand' });
    expect(preview.displaced.map(({ id }) => id)).toEqual([buckler]);
    applyCommands(state, [{ type: 'equip', unitId: FIGHTER, itemId: rifle, slot: 'main-hand' }]);
    expect(characterOf(state, FIGHTER).items['off-hand']).toBeNull();
    expect(state.family.inventory.map(({ id }) => id)).toEqual(expect.arrayContaining([buckler, sword]));
    // Putting the buckler back in sends the two-handed rifle to the inventory.
    applyCommands(state, [{ type: 'equip', unitId: FIGHTER, itemId: buckler, slot: 'off-hand' }]);
    expect(characterOf(state, FIGHTER).items['main-hand']).toBeNull();
    expect(state.family.inventory.map(({ id }) => id)).toContain(rifle);
  });

  it('is refused during a fight, for a missing art, a missing level, or the wrong slot', () => {
    const state = dummyGame();
    const buckler = inventoryItem(state, 'buckler');
    const necklace = inventoryItem(state, 'necklace');
    const cap = inventoryItem(state, 'cap');
    expect(refusals(state, [{ type: 'equip', unitId: SNIPER, itemId: buckler, slot: 'off-hand' }])).toEqual(['needs-art']);
    expect(characterOf(state, FIGHTER).level).toBeLessThan(4);
    expect(refusals(state, [{ type: 'equip', unitId: FIGHTER, itemId: necklace, slot: 'necklace' }])).toEqual(['needs-level']);
    characterOf(state, FIGHTER).level = 4;
    expect(refusals(state, [{ type: 'equip', unitId: FIGHTER, itemId: necklace, slot: 'necklace' }])).toEqual([]);
    expect(refusals(state, [{ type: 'equip', unitId: FIGHTER, itemId: cap, slot: 'chest' }])).toEqual(['wrong-slot']);
    expect(refusals(state, [{ type: 'unequip', unitId: FIGHTER, slot: 'head' }])).toEqual(['slot-empty']);
    const fight = createGame(1, { ...EMPTY_SCENARIO, contents: { dummy: null, boss: null, packs: [{ x: 0, z: 40, level: 3, mobs: [{ kind: 'rooster', count: 1 }] }] } });
    const [monster] = fight.live.enemies;
    if (!monster) throw new Error('No monster.');
    monster.awake = true;
    const capInFight = inventoryItem(fight, 'cap');
    expect(refusals(fight, [{ type: 'equip', unitId: FIGHTER, itemId: capInFight, slot: 'head' }])).toEqual(['in-fight']);
    expect(refusals(fight, [{ type: 'unequip', unitId: FIGHTER, slot: 'chest' }])).toEqual(['in-fight']);
  });

  it('keeps every item in exactly one place, across random equips and unequips (rule 1)', () => {
    const state = dummyGame(9);
    characterOf(state, FIGHTER).level = 10;
    for (const typeId of ['rifle', 'staff', 'buckler', 'cap', 'leather-chest']) inventoryItem(state, typeId);
    const total = everyItem(state).length;
    const rolls = { rng: 12345 };
    const pick = <T>(list: readonly T[]): T => list[Math.floor(nextRandom(rolls) * list.length)] as T;
    let accepted = 0;
    for (let turn = 0; turn < 400; turn += 1) {
      const unitId = pick([FIGHTER, SNIPER, HEALER]);
      const slot = pick(SLOTS);
      const command: Command =
        nextRandom(rolls) < 0.6 && state.family.inventory.length > 0
          ? { type: 'equip', unitId, itemId: pick(state.family.inventory).id, slot }
          : { type: 'unequip', unitId, slot };
      accepted += ofType(applyCommands(state, [command]), 'order-accepted').length;
      const places = everyItem(state);
      expect(places).toHaveLength(total);
      expect(new Set(places.map(({ item }) => item.id)).size).toBe(total);
      for (const character of state.family.characters) {
        const held = character.items['main-hand'];
        if (held && itemType(held.typeId).fills.includes('off-hand')) expect(character.items['off-hand']).toBeNull();
      }
    }
    expect(accepted).toBeGreaterThan(50);
  });
});

describe('the unarmed type (decision 12)', () => {
  it('fights with an empty main hand, so nobody stands idle', () => {
    const state = dummyGame();
    sendAway(state);
    applyCommands(state, [{ type: 'unequip', unitId: FIGHTER, slot: 'main-hand' }]);
    const fighter = unitOf(state, FIGHTER);
    const levelScale = 1 + LEVELS.attackPerLevel * (characterOf(state, FIGHTER).level - 1);
    expect(fighter.attack).toBeCloseTo(UNARMED.stats.attack * levelScale, 8);
    const dummy = dummyOf(state);
    place(fighter, dummy.x + 2, dummy.z);
    fighter.targetId = dummy.id;
    fighter.forced = true;
    const hits = ofType(run(state, 90), 'hit').filter(({ sourceId }) => sourceId === FIGHTER);
    expect(hits.length).toBeGreaterThan(1);
  });

  it('refuses a spell whose weapon is not in hand, and allows one that names none (D-027)', () => {
    const state = dummyGame();
    applyCommands(state, [{ type: 'unequip', unitId: FIGHTER, slot: 'main-hand' }]);
    expect(refusals(state, [{ type: 'cast', unitId: FIGHTER, spell: 'cleave' }])).toEqual(['needs-weapon']);
    expect(refusals(state, [{ type: 'cast', unitId: FIGHTER, spell: 'guard' }])).toEqual([]);
  });
});
