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
  /** What the anvil calls the weapon. */
  readonly weaponName: string;
}

const CHARACTERS: Readonly<Record<string, CharacterLook>> = {
  fighter: { name: 'Fighter', coat: 0x8a3a2a, hat: 'helm', weapon: 'sword', weaponName: 'Sword' },
  sniper: { name: 'Sniper', coat: 0x2f5a7a, hat: 'brim', weapon: 'rifle', weaponName: 'Rifle' },
  healer: { name: 'Healer', coat: 0xd8d0b8, hat: 'hood', weapon: 'staff', weaponName: 'Lamp Staff' },
};

const PLAIN_CHARACTER: CharacterLook = { name: 'Adventurer', coat: 0x7a7468, hat: null, weapon: null, weaponName: 'Weapon' };

export function characterLook(classId: string): CharacterLook {
  return CHARACTERS[classId] ?? PLAIN_CHARACTER;
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
  readonly leaves: readonly number[];
  readonly bark: number;
  readonly grass: number;
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

const MEADOW: ZoneLook = {
  name: 'Test Island',
  lowland: 0x5f7f47,
  highland: 0xa5ae5e,
  rock: 0x7c786c,
  leaves: [0x4f7a44, 0x6f9a4a, 0x98a24c],
  bark: 0x5a4632,
  grass: 0x7f9d4e,
  dusk: {
    skyTop: 0x0d1a29,
    horizon: 0x41505f,
    fog: 0x2a3a4a,
    sun: 0xa9c0dc,
    sunIntensity: 0.62,
    hemisphere: 0.62,
    deep: 0x0b2a35,
    shallow: 0x1e4e58,
    glint: 0x9fc0d8,
  },
  sunrise: {
    skyTop: 0x4f8fc0,
    horizon: 0xffd3a0,
    fog: 0xe9c09a,
    sun: 0xffe2b8,
    sunIntensity: 0.78,
    hemisphere: 0.62,
    deep: 0x1a6a7c,
    shallow: 0x4fb3b0,
    glint: 0xffe2b8,
  },
};

const ZONES: Readonly<Record<string, ZoneLook>> = { isle: MEADOW };

export function zoneLook(zoneId: string): ZoneLook {
  return ZONES[zoneId] ?? MEADOW;
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

/** What the anvil calls a gear slot's item. The weapon takes its name from the class. */
const SLOT_NAMES: Readonly<Record<string, string>> = {
  chest: 'Coat',
  gloves: 'Gloves',
  boots: 'Boots',
  head: 'Hat',
  necklace: 'Necklace',
  'off-hand': 'Off Hand',
};

export function gearName(classId: string, slot: string): string {
  if (slot === 'weapon' || slot === 'main-hand') return characterLook(classId).weaponName;
  return SLOT_NAMES[slot] ?? tidy(slot);
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
