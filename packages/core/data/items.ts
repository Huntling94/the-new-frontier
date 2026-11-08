import type {
  ArtData,
  ArtId,
  CategoryData,
  CategoryId,
  GearSlot,
  ItemStats,
  ItemTypeData,
  SpellId,
  WeaponData,
} from '../src/state';

/** The seven slots, in the order screens show them (D-028, decision 8). */
export const SLOTS: readonly GearSlot[] = ['main-hand', 'off-hand', 'head', 'chest', 'gloves', 'boots', 'necklace'];

/** Every category, from the genre's usual set. More can be added here (decision 9). */
export const CATEGORIES: Readonly<Record<CategoryId, CategoryData>> = {
  sword: { kind: 'weapon' },
  'great-sword': { kind: 'weapon' },
  dagger: { kind: 'weapon' },
  spear: { kind: 'weapon' },
  pistol: { kind: 'weapon' },
  rifle: { kind: 'weapon' },
  staff: { kind: 'weapon' },
  shield: { kind: 'weapon' },
  leather: { kind: 'armour' },
  metal: { kind: 'armour' },
  coat: { kind: 'armour' },
  jewellery: { kind: 'armour' },
};

/** One art per class for now, each known from the start (D-027, decision 15). */
export const ARTS: Readonly<Record<ArtId, ArtData>> = {
  swordplay: { spells: ['taunt', 'cleave', 'guard'], categories: ['sword', 'shield'] },
  marksmanship: { spells: ['aimed-shot', 'crippling-shot', 'volley'], categories: ['rifle'] },
  mending: { spells: ['mend', 'rally', 'revive'], categories: ['staff'] },
};

/**
 * The weapon a spell needs in hand, or null for none (D-027). Healing arts name none.
 * Today's characters always hold their class's weapon, so no spell is refused in a run.
 */
export const SPELL_WEAPONS: Readonly<Record<SpellId, CategoryId | null>> = {
  taunt: null,
  cleave: 'sword',
  guard: null,
  'aimed-shot': 'rifle',
  'crippling-shot': 'rifle',
  volley: 'rifle',
  mend: null,
  rally: null,
  revive: null,
};

const NO_STATS: ItemStats = { attack: 0, ar: 0, crit: 0, defence: 0, dr: 0 };

/** The squad test's weapons, moved off the classes with the same numbers (decision 10). */
const SWORD: WeaponData = { range: 3.3, attackSeconds: 0.85, knockback: 8, melee: true, attackStat: 'melee' };
const RIFLE: WeaponData = { range: 25, attackSeconds: 1.05, knockback: 0, melee: false, attackStat: 'ranged' };
const STAFF: WeaponData = { range: 22, attackSeconds: 1.5, knockback: 0, melee: false, attackStat: 'magic' };

function weapon(
  category: CategoryId,
  stats: Pick<ItemStats, 'attack' | 'ar' | 'crit'>,
  data: WeaponData,
  twoHanded: boolean,
): ItemTypeData {
  return {
    category,
    fits: ['main-hand'],
    fills: twoHanded ? ['off-hand'] : [],
    stats: { ...NO_STATS, ...stats },
    weapon: data,
    requires: [],
    price: 100,
  };
}

function armour(
  category: CategoryId,
  slot: GearSlot,
  stats: Partial<ItemStats>,
  options: { price?: number; requires?: ItemTypeData['requires'] } = {},
): ItemTypeData {
  return {
    category,
    fits: [slot],
    fills: [],
    stats: { ...NO_STATS, ...stats },
    weapon: null,
    requires: options.requires ?? [],
    price: options.price ?? 60,
  };
}

/** Today's shared armour numbers by slot, before the class's armour scale (decision 11). */
const CHEST = { defence: 34, dr: 3 };
const HANDS = { defence: 15, dr: 1 };
const FEET = { defence: 15, dr: 1 };

/**
 * Every item type, keyed by ID (D-028, D-029). Names and looks are in `render`. Prices,
 * and the cap, buckler and necklace numbers, are placeholders until balance.
 */
export const ITEM_TYPES: Readonly<Record<string, ItemTypeData>> = {
  sword: weapon('sword', { attack: 62, ar: 4, crit: 8 }, SWORD, false),
  rifle: weapon('rifle', { attack: 76, ar: 5, crit: 12 }, RIFLE, true),
  staff: weapon('staff', { attack: 34, ar: 3, crit: 0 }, STAFF, true),
  'metal-chest': armour('metal', 'chest', CHEST),
  'metal-gloves': armour('metal', 'gloves', HANDS),
  'metal-boots': armour('metal', 'boots', FEET),
  'leather-chest': armour('leather', 'chest', CHEST),
  'leather-gloves': armour('leather', 'gloves', HANDS),
  'leather-boots': armour('leather', 'boots', FEET),
  'coat-chest': armour('coat', 'chest', CHEST),
  'coat-gloves': armour('coat', 'gloves', HANDS),
  'coat-boots': armour('coat', 'boots', FEET),
  cap: armour('leather', 'head', { defence: 8 }, { price: 40 }),
  buckler: armour('shield', 'off-hand', { defence: 10, dr: 1 }, { price: 50 }),
  necklace: armour('jewellery', 'necklace', { ar: 1, dr: 1 }, {
    price: 80,
    requires: [{ kind: 'level', level: 4 }],
  }),
};

/**
 * What an empty main hand fights with, so a character never stands idle (decision 12).
 * It is not an item, and cannot be upgraded. Its numbers are placeholders.
 */
export const UNARMED: { readonly stats: ItemStats; readonly weapon: WeaponData } = {
  stats: { ...NO_STATS, attack: 20 },
  weapon: { range: 2.5, attackSeconds: 1, knockback: 0, melee: true, attackStat: 'melee' },
};

/** The inventory a new family starts with, so the screen has something to show (decision 18). */
export const STARTING_INVENTORY: readonly string[] = ['cap', 'buckler', 'necklace'];
