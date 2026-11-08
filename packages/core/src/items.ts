import { ARTS, CATEGORIES, ITEM_TYPES, SLOTS, SPELL_WEAPONS, UNARMED } from '../data/items';
import { CLASSES } from '../data/squad';
import { characterOf } from './family';
import { recalculate } from './stats';
import type {
  Character,
  ClassId,
  EquipCommand,
  GameEvent,
  GameState,
  GameView,
  GearSlot,
  Item,
  ItemStats,
  ItemTypeData,
  RefusalReason,
  Requirement,
  SpellId,
  UnequipCommand,
  WeaponData,
} from './state';

type CharacterView = GameView['family']['characters'][number];

/** An item type by ID. Every ID in state comes from the data, so a miss is a bug. */
export function itemType(typeId: string): ItemTypeData {
  const type = ITEM_TYPES[typeId];
  if (!type) {
    throw new Error(`No item type ${typeId}.`);
  }
  return type;
}

/** A new item of that type, with the next item ID (decision 7). */
export function createItem(state: GameState, typeId: string): Item {
  itemType(typeId);
  const id = state.nextItemId;
  state.nextItemId += 1;
  return { id, typeId, upgrade: 0, broken: false };
}

/** Every slot empty. */
export function emptySlots(): Record<GearSlot, Item | null> {
  return Object.fromEntries(SLOTS.map((slot) => [slot, null])) as Record<GearSlot, Item | null>;
}

/** What a new character of the class wears, as new items (decision 9). */
export function startingItems(state: GameState, classId: ClassId): Record<GearSlot, Item | null> {
  const items = emptySlots();
  for (const slot of SLOTS) {
    const typeId = CLASSES[classId].startingItems[slot];
    items[slot] = typeId ? createItem(state, typeId) : null;
  }
  return items;
}

/** The weapon a character fights with: its main hand's, or the unarmed type (decision 12). */
export function weaponOf(character: CharacterView): { readonly stats: ItemStats; readonly weapon: WeaponData } {
  const held = character.items['main-hand'];
  const type = held ? itemType(held.typeId) : null;
  return type?.weapon ? { stats: type.stats, weapon: type.weapon } : UNARMED;
}

/** The character's spells, in the order its keys follow: each known art's, in turn (D-027). */
export function spellsKnown(character: CharacterView): SpellId[] {
  return character.arts.flatMap((art) => ARTS[art].spells);
}

/** Whether a spell's weapon is in hand. Healing arts name none (D-027). */
export function hasSpellWeapon(character: CharacterView, spell: SpellId): boolean {
  const needed = SPELL_WEAPONS[spell];
  const held = character.items['main-hand'];
  return needed === null || (held !== null && itemType(held.typeId).category === needed);
}

function unmet(character: CharacterView, requirement: Requirement): RefusalReason | null {
  switch (requirement.kind) {
    case 'level':
      return character.level >= requirement.level ? null : 'needs-level';
    case 'art':
      return character.arts.includes(requirement.art) ? null : 'needs-art';
    case 'quest':
      // No quests exist yet, so none is ever finished.
      return 'needs-level';
  }
}

/**
 * Why a character may not use an item type, or null if it may (decision 17). A weapon
 * category needs an art that permits it (D-027). Any class may wear any armour.
 */
export function whyNot(character: CharacterView, typeId: string): RefusalReason | null {
  const type = itemType(typeId);
  for (const requirement of type.requires) {
    const reason = unmet(character, requirement);
    if (reason) {
      return reason;
    }
  }
  const permitted = character.arts.some((art) => ARTS[art].categories.includes(type.category));
  return CATEGORIES[type.category].kind === 'weapon' && !permitted ? 'needs-art' : null;
}

/** Any enemy awake in the zone that runs counts as a fight (decision 17). */
export function inFight(state: GameView): boolean {
  return state.live.enemies.some((enemy) => enemy.alive && enemy.awake && enemy.kind !== 'dummy');
}

/** The slots an item in this slot leaves empty: those its type fills, and any filler of this slot. */
function displaced(character: Character, slot: GearSlot, typeId: string): GearSlot[] {
  const fills = itemType(typeId).fills.filter((other) => other !== slot);
  const fillers = SLOTS.filter((other) => {
    const held = character.items[other];
    return other !== slot && held !== null && itemType(held.typeId).fills.includes(slot);
  });
  return [...fills, ...fillers];
}

function toInventory(state: GameState, character: Character, slot: GearSlot): Item | null {
  const held = character.items[slot];
  if (held) {
    state.family.inventory.push(held);
    character.items[slot] = null;
  }
  return held;
}

/** Works out the stats again for a character with a body in the field. */
export function refresh(state: GameState, character: Character): void {
  const body = state.bodies.find(({ id }) => id === character.id);
  if (body) {
    recalculate(character, body);
  }
}

function findCharacter(state: GameState, id: number): Character | null {
  return state.family.characters.find((candidate) => candidate.id === id) ?? null;
}

/**
 * Moves an item from the inventory into a slot. Whatever was there, and anything a
 * two-handed item displaces, goes back to the inventory (decision 17, rule 2).
 */
export function applyEquip(state: GameState, command: EquipCommand, events: GameEvent[]): RefusalReason | null {
  const character = findCharacter(state, command.unitId);
  if (!character) {
    return 'unknown-unit';
  }
  const index = state.family.inventory.findIndex(({ id }) => id === command.itemId);
  const item = state.family.inventory[index];
  if (!item) {
    return 'unknown-item';
  }
  if (item.broken) {
    return 'broken';
  }
  if (!itemType(item.typeId).fits.includes(command.slot)) {
    return 'wrong-slot';
  }
  if (inFight(state)) {
    return 'in-fight';
  }
  const reason = whyNot(character, item.typeId);
  if (reason) {
    return reason;
  }
  state.family.inventory.splice(index, 1);
  for (const slot of [command.slot, ...displaced(character, command.slot, item.typeId)]) {
    const sent = toInventory(state, character, slot);
    if (sent) {
      events.push({ type: 'unequipped', tick: state.tick, unitId: character.id, itemId: sent.id, slot });
    }
  }
  character.items[command.slot] = item;
  events.push({ type: 'equipped', tick: state.tick, unitId: character.id, itemId: item.id, slot: command.slot });
  refresh(state, character);
  return null;
}

/** Sends an equipped item back to the inventory (decision 17). */
export function applyUnequip(state: GameState, command: UnequipCommand, events: GameEvent[]): RefusalReason | null {
  const character = findCharacter(state, command.unitId);
  if (!character) {
    return 'unknown-unit';
  }
  const held = character.items[command.slot];
  if (!held) {
    return 'slot-empty';
  }
  if (inFight(state)) {
    return 'in-fight';
  }
  toInventory(state, character, command.slot);
  events.push({ type: 'unequipped', tick: state.tick, unitId: character.id, itemId: held.id, slot: command.slot });
  refresh(state, character);
  return null;
}

/** Every item the family owns, with where it is: rule 1 says each appears once. */
export function everyItem(state: GameView): { readonly item: GameView['family']['inventory'][number]; readonly where: string }[] {
  const worn = state.family.characters.flatMap((character) =>
    SLOTS.flatMap((slot) => {
      const held = character.items[slot];
      return held ? [{ item: held, where: `${String(character.id)}:${slot}` }] : [];
    }),
  );
  return [...state.family.inventory.map((item) => ({ item, where: 'inventory' })), ...worn];
}

/** The character's item in a slot, for reads outside the core. */
export function itemIn(state: GameView, characterId: number, slot: GearSlot): GameView['family']['inventory'][number] | null {
  return characterOf(state, characterId).items[slot];
}
