/**
 * What things look like, in one place (decision 13, D-029). Every table is keyed
 * by the core's type ID and has a plain default, so a new class, monster or zone
 * in the data never breaks the screen. Names and labels for the HUD are here too.
 */

export interface CharacterLook {
  readonly name: string;
  readonly coat: number;
  readonly hat: 'helm' | 'brim' | 'hood' | null;
  readonly weapon: 'sword' | 'rifle' | 'staff' | null;
}

const CHARACTERS: Readonly<Record<string, CharacterLook>> = {
  fighter: { name: 'Fighter', coat: 0x8a3a2a, hat: 'helm', weapon: 'sword' },
  sniper: { name: 'Sniper', coat: 0x2f5a7a, hat: 'brim', weapon: 'rifle' },
  healer: { name: 'Healer', coat: 0xd8d0b8, hat: 'hood', weapon: 'staff' },
};

const PLAIN_CHARACTER: CharacterLook = { name: 'Adventurer', coat: 0x7a7468, hat: null, weapon: null };

export function characterLook(classId: string): CharacterLook {
  return CHARACTERS[classId] ?? PLAIN_CHARACTER;
}

/** How each NPC is dressed, keyed by its ID (D-044), with a plain default. */
const NPCS: Readonly<Record<string, CharacterLook>> = {
  smith: { name: 'Smith', coat: 0x4a3a2c, hat: null, weapon: null },
};

export function npcLook(npcId: string): CharacterLook {
  return NPCS[npcId] ?? PLAIN_CHARACTER;
}

export type MonsterBody = 'swarm' | 'runner' | 'spitter' | 'brute' | 'post' | 'blob';

export interface MonsterLook {
  readonly name: string;
  readonly body: MonsterBody;
  readonly colour: number;
  readonly trim: number;
  /** The core size the model is built for; the model scales with the real size. */
  readonly modelSize: number;
  /** The boss's crown of spikes and glow. */
  readonly crowned: boolean;
  /** Where its health bar floats, above the ground. */
  readonly barHeight: number;
  /** A boss's health shows in the HUD instead of over its head. */
  readonly overheadBar: boolean;
  /** What its cast bar calls the cast, if it casts. */
  readonly castName: string | null;
}

const MONSTERS: Readonly<Record<string, MonsterLook>> = {
  swarm: { name: 'Sand Skitter', body: 'swarm', colour: 0xd8b878, trim: 0x8a6a3a, modelSize: 0.8, crowned: false, barHeight: 0.8, overheadBar: true, castName: null },
  runner: { name: 'Tide Crab', body: 'runner', colour: 0xd86a4a, trim: 0xf0c090, modelSize: 1.15, crowned: false, barHeight: 0.8, overheadBar: true, castName: null },
  spitter: { name: 'Spit Anemone', body: 'spitter', colour: 0xc86aa8, trim: 0xf4d0e0, modelSize: 1.2, crowned: false, barHeight: 0.8, overheadBar: true, castName: null },
  brute: { name: 'Slag Golem', body: 'brute', colour: 0x6c6a70, trim: 0xff9a40, modelSize: 2, crowned: false, barHeight: 3.5, overheadBar: true, castName: null },
  boss: { name: 'The Warden', body: 'brute', colour: 0x3f4a55, trim: 0xffb648, modelSize: 1.5, crowned: true, barHeight: 13, overheadBar: false, castName: 'Warden’s Light' },
  dummy: { name: 'Training Dummy', body: 'post', colour: 0x8a6a48, trim: 0xd8c8a0, modelSize: 1.15, crowned: false, barHeight: 4, overheadBar: true, castName: null },
};

const PLAIN_MONSTER: MonsterLook = {
  name: 'Monster',
  body: 'blob',
  colour: 0x707070,
  trim: 0xc0c0c0,
  modelSize: 1,
  crowned: false,
  barHeight: 2,
  overheadBar: true,
  castName: null,
};

export function monsterLook(kind: string): MonsterLook {
  return MONSTERS[kind] ?? PLAIN_MONSTER;
}

/** A zone's palette (D-022, D-030). Light runs from storm dusk to sunrise, as in the squad test. */
export interface ZoneLook {
  readonly name: string;
  readonly lowland: number;
  readonly highland: number;
  readonly rock: number;
  /** Standing stones, and the walls of a walled zone. */
  readonly stone: number;
  /** Small plants dotted over open ground. */
  readonly tuft: number;
  /** The glow over a gate. */
  readonly gate: number;
  readonly dusk: Light;
  readonly sunrise: Light;
}

export interface Light {
  readonly skyTop: number;
  readonly horizon: number;
  readonly fog: number;
  readonly sun: number;
  readonly sunIntensity: number;
  readonly hemisphere: number;
  readonly deep: number;
  readonly shallow: number;
  readonly glint: number;
}

/** Lande de Montclaire: a lavender heath under the squad test's storm (D-038). */
const HEATH: ZoneLook = {
  name: 'Lande de Montclaire',
  lowland: 0x6f6488,
  highland: 0xa391b4,
  rock: 0x7a7480,
  stone: 0x9a96a0,
  tuft: 0xa77fcf,
  gate: 0x8fd6c4,
  dusk: {
    skyTop: 0x141729,
    horizon: 0x4a4860,
    fog: 0x31324a,
    sun: 0xb4b8dc,
    sunIntensity: 0.62,
    hemisphere: 0.62,
    deep: 0x0b2a35,
    shallow: 0x1e4e58,
    glint: 0x9fc0d8,
  },
  sunrise: {
    skyTop: 0x5f8fc0,
    horizon: 0xffcfb0,
    fog: 0xe0bfb8,
    sun: 0xffe2c8,
    sunIntensity: 0.78,
    hemisphere: 0.62,
    deep: 0x1a6a7c,
    shallow: 0x4fb3b0,
    glint: 0xffe2b8,
  },
};

/** The cave off the Lande. Its name waits for the starting region's naming (D-038). */
const CAVE: ZoneLook = {
  name: 'A cave under the Lande',
  lowland: 0x3b3640,
  highland: 0x544b58,
  rock: 0x4a4550,
  stone: 0x5c5664,
  tuft: 0x6c5a7c,
  gate: 0xffd089,
  dusk: {
    skyTop: 0x050508,
    horizon: 0x0c0b10,
    fog: 0x0c0b10,
    sun: 0x8c84a8,
    sunIntensity: 0.35,
    hemisphere: 0.4,
    deep: 0x000000,
    shallow: 0x000000,
    glint: 0x000000,
  },
  sunrise: {
    skyTop: 0x050508,
    horizon: 0x0c0b10,
    fog: 0x0c0b10,
    sun: 0x8c84a8,
    sunIntensity: 0.35,
    hemisphere: 0.4,
    deep: 0x000000,
    shallow: 0x000000,
    glint: 0x000000,
  },
};

/** Golden afternoon light, the same before and after the beacon: the town is safe. */
const AFTERNOON: Light = {
  skyTop: 0x5f8fc0,
  horizon: 0xffd9b8,
  fog: 0xe8cdb8,
  sun: 0xffe6c8,
  sunIntensity: 0.8,
  hemisphere: 0.6,
  deep: 0x1a6a7c,
  shallow: 0x4fb3b0,
  glint: 0xffe2b8,
};

/** Montclaire, a Provençal market town among lavender fields (S3d decision 8, D-038). */
const TOWN: ZoneLook = {
  name: 'Montclaire',
  lowland: 0x7a6e94,
  highland: 0x8c9a62,
  rock: 0x9a8a70,
  stone: 0xd8ccb0,
  tuft: 0xa77fcf,
  gate: 0xffd089,
  dusk: AFTERNOON,
  sunrise: AFTERNOON,
};

const ZONES: Readonly<Record<string, ZoneLook>> = { lande: HEATH, 'lande-cave': CAVE, montclaire: TOWN };

export function zoneLook(zoneId: string): ZoneLook {
  return ZONES[zoneId] ?? HEATH;
}

/** What a town's buildings, streets and dressing are made of (S3d decision 8). */
export interface TownLook {
  /** Pale limestone walls, a few shades so the street does not look stamped out. */
  readonly walls: readonly number[];
  /** Terracotta roofs. */
  readonly roofs: readonly number[];
  readonly door: number;
  readonly cobbles: number;
  readonly cobbleJoints: number;
  /** Ground the buildings leave: gardens and yards. */
  readonly garden: number;
  readonly trunk: number;
  readonly leaves: number;
  readonly lavender: number;
  readonly water: number;
  /** Each lot's sign board, by lot ID, and the colour of what hangs over the door. */
  readonly signs: Readonly<Record<string, number>>;
  readonly awning: number;
}

const PROVENCE: TownLook = {
  walls: [0xe6dcc4, 0xdccfb2, 0xeee2c8, 0xd4c3a0, 0xe8d6b4],
  roofs: [0xb85c38, 0xc46a40, 0xa8502e, 0xc77a4a],
  door: 0x4a5a6c,
  cobbles: 0xb8a88c,
  cobbleJoints: 0x8c7c64,
  garden: 0x8c9a62,
  trunk: 0xb8ad94,
  leaves: 0x6f8a46,
  lavender: 0xa77fcf,
  water: 0x6fb8d8,
  signs: { smithy: 0x3a3a40, shop: 0x2f5a7a, inn: 0x7a3a2a },
  awning: 0x3f7a70,
};

export function townLook(): TownLook {
  return PROVENCE;
}

/** A spell's flash on the ground when it is cast. Spells not listed show nothing extra. */
export interface SpellLook {
  readonly radius: number;
  readonly colour: number;
  readonly seconds: number;
}

const SPELLS: Readonly<Record<string, SpellLook>> = {
  taunt: { radius: 17, colour: 0xef6a54, seconds: 0.35 },
  cleave: { radius: 7.5, colour: 0xfff0c8, seconds: 0.25 },
  guard: { radius: 4, colour: 0x8fd6c4, seconds: 0.4 },
  rally: { radius: 20, colour: 0xffb648, seconds: 0.35 },
};

export function spellLook(spell: string): SpellLook | null {
  return SPELLS[spell] ?? null;
}

/** What the HUD calls a spell. Spells not listed get their ID, tidied. */
const SPELL_NAMES: Readonly<Record<string, string>> = {
  taunt: 'Taunt',
  cleave: 'Cleave',
  guard: 'Guard',
  'aimed-shot': 'Aimed Shot',
  'crippling-shot': 'Crippling Shot',
  volley: 'Volley',
  mend: 'Mend',
  rally: 'Rally',
  revive: 'Revive',
};

const tidy = (id: string): string =>
  id
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

export function spellName(spell: string): string {
  return SPELL_NAMES[spell] ?? tidy(spell);
}

/** What the screens call each slot (D-028). */
const SLOT_NAMES: Readonly<Record<string, string>> = {
  'main-hand': 'Main hand',
  'off-hand': 'Off hand',
  head: 'Head',
  chest: 'Chest',
  gloves: 'Gloves',
  boots: 'Boots',
  necklace: 'Necklace',
};

export function slotName(slot: string): string {
  return SLOT_NAMES[slot] ?? tidy(slot);
}

/** What the screens call each category, and its tile colour (S3b decision 9). */
const CATEGORIES: Readonly<Record<string, { readonly name: string; readonly colour: string }>> = {
  sword: { name: 'Sword', colour: '#c9d2d8' },
  'great-sword': { name: 'Great Sword', colour: '#c9d2d8' },
  dagger: { name: 'Dagger', colour: '#c9d2d8' },
  spear: { name: 'Spear', colour: '#c9d2d8' },
  pistol: { name: 'Pistol', colour: '#8fc0e0' },
  rifle: { name: 'Rifle', colour: '#8fc0e0' },
  staff: { name: 'Staff', colour: '#9be8a6' },
  shield: { name: 'Shield', colour: '#d8b878' },
  leather: { name: 'Leather', colour: '#c89a6a' },
  metal: { name: 'Metal', colour: '#a8b4bc' },
  coat: { name: 'Coat', colour: '#e0d4b8' },
  jewellery: { name: 'Jewellery', colour: '#ffb648' },
};

export function categoryLook(category: string): { readonly name: string; readonly colour: string } {
  return CATEGORIES[category] ?? { name: tidy(category), colour: '#9fb0ad' };
}

/**
 * Item names, keyed by item type ID (D-029). Items are named by category for now;
 * named items come with a naming session (S3b, D-038).
 */
const ITEM_NAMES: Readonly<Record<string, string>> = {
  sword: 'Sword',
  rifle: 'Rifle',
  staff: 'Staff',
  'metal-chest': 'Metal Armour',
  'metal-gloves': 'Metal Gloves',
  'metal-boots': 'Metal Boots',
  'leather-chest': 'Leather Armour',
  'leather-gloves': 'Leather Gloves',
  'leather-boots': 'Leather Boots',
  'coat-chest': 'Coat',
  'coat-gloves': 'Coat Gloves',
  'coat-boots': 'Coat Boots',
  cap: 'Leather Cap',
  buckler: 'Buckler',
  necklace: 'Necklace',
};

/** An item's name, with a plain default for any type the data adds. */
export function itemName(typeId: string, upgrade = 0): string {
  const base = ITEM_NAMES[typeId] ?? tidy(typeId);
  return `${base}${upgrade > 0 ? ` +${upgrade}` : ''}`;
}

/** Colours of the marks the player makes. */
export const MARKS = {
  selection: 0xffb648,
  target: 0xef6a54,
  move: 0x8fd6c4,
  attackMove: 0xef6a54,
  telegraph: 0xff5a3c,
  shot: 0xffe2a8,
  coin: 0xffcf6e,
  potion: 0xff9aa8,
} as const;
