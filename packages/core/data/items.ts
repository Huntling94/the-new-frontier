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

/** The seven slots, in the order screens and the anvil show them (D-028, decision 8). */
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

/** Share of a weapon's attack and of armour's Def that a smith's spare keeps (D-005). */
const SPARE = { weapon: 0.85, armour: 0.8 };

/** The squad test's weapons, moved off the classes with the same numbers (decision 10). */
const SWORD: WeaponData = { range: 3.3, attackSeconds: 0.85, knockback: 8, melee: true, attackStat: 'melee' };
const RIFLE: WeaponData = { range: 25, attackSeconds: 1.05, knockback: 0, melee: false, attackStat: 'ranged' };
const STAFF: WeaponData = { range: 22, attackSeconds: 1.5, knockback: 0, melee: false, attackStat: 'magic' };

function weapon(
  category: CategoryId,
  stats: Pick<ItemStats, 'attack' | 'ar' | 'crit'>,
  data: WeaponData,
  twoHanded: boolean,
  spare: string,
  quality = 1,
): ItemTypeData {
  return {
    category,
    fits: ['main-hand'],
    fills: twoHanded ? ['off-hand'] : [],
    stats: { ...NO_STATS, ...stats },
    weapon: data,
    requires: [],
    price: 100,
    quality,
    spare,
  };
}

function armour(
  category: CategoryId,
  slot: GearSlot,
  stats: Partial<ItemStats>,
  spare: string,
  options: { quality?: number; price?: number; requires?: ItemTypeData['requires'] } = {},
): ItemTypeData {
  return {
    category,
    fits: [slot],
    fills: [],
    stats: { ...NO_STATS, ...stats },
    weapon: null,
    requires: options.requires ?? [],
    price: options.price ?? 60,
    quality: options.quality ?? 1,
    spare,
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
  sword: weapon('sword', { attack: 62, ar: 4, crit: 8 }, SWORD, false, 'plain-sword'),
  rifle: weapon('rifle', { attack: 76, ar: 5, crit: 12 }, RIFLE, true, 'plain-rifle'),
  staff: weapon('staff', { attack: 34, ar: 3, crit: 0 }, STAFF, true, 'plain-staff'),
  'plain-sword': weapon('sword', { attack: 62, ar: 4, crit: 8 }, SWORD, false, 'plain-sword', SPARE.weapon),
  'plain-rifle': weapon('rifle', { attack: 76, ar: 5, crit: 12 }, RIFLE, true, 'plain-rifle', SPARE.weapon),
  'plain-staff': weapon('staff', { attack: 34, ar: 3, crit: 0 }, STAFF, true, 'plain-staff', SPARE.weapon),
  'metal-chest': armour('metal', 'chest', CHEST, 'plain-chest'),
  'metal-gloves': armour('metal', 'gloves', HANDS, 'plain-gloves'),
  'metal-boots': armour('metal', 'boots', FEET, 'plain-boots'),
  'leather-chest': armour('leather', 'chest', CHEST, 'plain-chest'),
  'leather-gloves': armour('leather', 'gloves', HANDS, 'plain-gloves'),
  'leather-boots': armour('leather', 'boots', FEET, 'plain-boots'),
  'coat-chest': armour('coat', 'chest', CHEST, 'plain-chest'),
  'coat-gloves': armour('coat', 'gloves', HANDS, 'plain-gloves'),
  'coat-boots': armour('coat', 'boots', FEET, 'plain-boots'),
  'plain-chest': armour('leather', 'chest', CHEST, 'plain-chest', { quality: SPARE.armour }),
  'plain-gloves': armour('leather', 'gloves', HANDS, 'plain-gloves', { quality: SPARE.armour }),
  'plain-boots': armour('leather', 'boots', FEET, 'plain-boots', { quality: SPARE.armour }),
  cap: armour('leather', 'head', { defence: 8 }, 'plain-cap', { price: 40 }),
  'plain-cap': armour('leather', 'head', { defence: 8 }, 'plain-cap', { quality: SPARE.armour, price: 40 }),
  buckler: armour('shield', 'off-hand', { defence: 10, dr: 1 }, 'plain-buckler', { price: 50 }),
  'plain-buckler': armour('shield', 'off-hand', { defence: 10, dr: 1 }, 'plain-buckler', { quality: SPARE.armour, price: 50 }),
  necklace: armour('jewellery', 'necklace', { ar: 1, dr: 1 }, 'plain-necklace', {
    price: 80,
    requires: [{ kind: 'level', level: 4 }],
  }),
  'plain-necklace': armour('jewellery', 'necklace', { ar: 1, dr: 1 }, 'plain-necklace', {
    quality: SPARE.armour,
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

/** The store a new family starts with, so the screen has something to show (decision 18). */
export const STARTING_STORE: readonly string[] = ['cap', 'buckler', 'necklace'];
