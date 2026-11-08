import { ARTS, ITEM_TYPES, SLOTS } from '../data/items';
import { SAVE_FORMAT } from '../data/save';
import { CLASSES, FORMATION } from '../data/squad';
import { ZONES } from '../data/zones';
import { characterOf } from './family';
import { createBody } from './game';
import { MIGRATIONS, SAVE_VERSION, type MigrationStep } from './migrations';
import type {
  ArtId,
  Body,
  Character,
  ClassId,
  GameState,
  GameView,
  GearSlot,
  Item,
  Point,
  ZoneRecord,
} from './state';
import { TICKS } from './time';
import { MOVEMENT } from '../data/movement';
import { isOpen, nearestOpen } from './grid';
import { gridOf, pushOutOfObstacles, zoneData } from './world';
import { emptyLive, enterZone, standInTriangle } from './zones';

/** One item, as a save holds it. */
export interface SavedItem {
  readonly id: number;
  readonly typeId: string;
  readonly upgrade: number;
  readonly broken: boolean;
}

export interface SavedCharacter {
  readonly id: number;
  readonly name: string;
  readonly classId: ClassId;
  readonly level: number;
  readonly xp: number;
  readonly arts: readonly ArtId[];
  readonly items: Readonly<Record<GearSlot, SavedItem | null>>;
}

/** What lasts of a body: where it stands, its health and mana, and whether it is down (S3c decision 1). */
export interface SavedBody {
  readonly id: number;
  readonly x: number;
  readonly z: number;
  readonly health: number;
  readonly mana: number;
  readonly alive: boolean;
}

export interface SavedRecord {
  readonly id: string;
  readonly bossDead: boolean;
  readonly returns: readonly { readonly packId: number; readonly tick: number }[];
}

/** The game data in a save: every fact the player earned or chose, and nothing that can be worked out again. */
export interface SaveGame {
  readonly tick: number;
  readonly rng: number;
  readonly family: {
    readonly characters: readonly SavedCharacter[];
    readonly active: readonly number[];
    readonly inventory: readonly SavedItem[];
    readonly marks: number;
    readonly potions: number;
  };
  readonly zoneId: string;
  readonly records: readonly SavedRecord[];
  readonly squad: {
    readonly anchor: Point;
    readonly heading: number;
    readonly bodies: readonly SavedBody[];
  };
}

/** A whole save: a small envelope, and the game data (S3c decision 2). The app adds `savedAt`. */
export interface SaveFile {
  readonly format: string;
  readonly version: number;
  readonly savedAt?: string;
  readonly game: SaveGame;
}

/** Why a save was refused. Each comes with a line saying what was wrong. */
export type SaveRefusal = 'not-a-save' | 'newer' | 'bad-shape' | 'unknown-id' | 'item-rules';

export type LoadResult =
  | {
      readonly ok: true;
      readonly state: GameState;
      /** The version the save was written in, before migration. */
      readonly version: number;
      readonly savedAt: string | null;
    }
  | { readonly ok: false; readonly refusal: SaveRefusal; readonly detail: string };

function copyItem(item: GameView['family']['inventory'][number]): SavedItem {
  return { id: item.id, typeId: item.typeId, upgrade: item.upgrade, broken: item.broken };
}

/**
 * The lasting part of a game, as plain data (S3c decision 1). It reads the game and
 * changes nothing. The live group, cooldowns, orders, ID counters and a test zone's
 * contents are left out.
 */
export function toSave(view: GameView): SaveFile {
  const { family } = view;
  const game: SaveGame = {
    tick: view.tick,
    rng: view.rng,
    family: {
      characters: family.characters.map((character) => ({
        id: character.id,
        name: character.name,
        classId: character.classId,
        level: character.level,
        xp: character.xp,
        arts: [...character.arts],
        items: Object.fromEntries(
          SLOTS.map((slot) => {
            const held = character.items[slot];
            return [slot, held ? copyItem(held) : null];
          }),
        ) as Record<GearSlot, SavedItem | null>,
      })),
      active: [...family.active],
      inventory: family.inventory.map(copyItem),
      marks: family.marks,
      potions: family.potions,
    },
    zoneId: view.zoneId,
    records: view.records.map((record) => ({
      id: record.id,
      bossDead: record.bossDead,
      returns: record.returns.map(({ packId, tick }) => ({ packId, tick })),
    })),
    squad: {
      anchor: { x: view.anchor.x, z: view.anchor.z },
      heading: view.heading,
      bodies: view.bodies.map((body) => ({
        id: body.id,
        x: body.x,
        z: body.z,
        health: body.health,
        mana: body.mana,
        alive: body.alive,
      })),
    },
  };
  return { format: SAVE_FORMAT, version: SAVE_VERSION, game };
}

/** A save that fails the check. Caught in `fromSave`, never let out. */
class Refused extends Error {
  readonly refusal: SaveRefusal;
  readonly detail: string;

  constructor(refusal: SaveRefusal, detail: string) {
    super(detail);
    this.refusal = refusal;
    this.detail = detail;
  }
}

type Fields = Readonly<Record<string, unknown>>;

function fields(value: unknown, where: string): Fields {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Refused('bad-shape', `${where} is not an object.`);
  }
  return value as Fields;
}

function list(value: unknown, where: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new Refused('bad-shape', `${where} is not a list.`);
  }
  return value;
}

function finite(value: unknown, where: string, least: number | null = null): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || (least !== null && value < least)) {
    throw new Refused('bad-shape', `${where} is not a number${least === null ? '' : ` of at least ${String(least)}`}.`);
  }
  return value;
}

function whole(value: unknown, where: string, least: number): number {
  const number = finite(value, where, least);
  if (!Number.isInteger(number)) {
    throw new Refused('bad-shape', `${where} is not a whole number.`);
  }
  return number;
}

function text(value: unknown, where: string): string {
  if (typeof value !== 'string') {
    throw new Refused('bad-shape', `${where} is not text.`);
  }
  return value;
}

function flag(value: unknown, where: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Refused('bad-shape', `${where} is not true or false.`);
  }
  return value;
}

/** Content IDs must exist in this build's data (rule 9). */
function known<T extends string>(id: string, table: Readonly<Record<string, unknown>>, what: string): T {
  if (!Object.hasOwn(table, id)) {
    throw new Refused('unknown-id', `No ${what} is called "${id}" in this build.`);
  }
  return id as T;
}

function knownZone(id: string): string {
  if (!ZONES.some((zone) => zone.id === id)) {
    throw new Refused('unknown-id', `No zone is called "${id}" in this build.`);
  }
  return id;
}

function readItem(value: unknown, where: string): Item {
  const item = fields(value, where);
  return {
    id: whole(item.id, `${where}'s ID`, 1),
    typeId: known(text(item.typeId, `${where}'s type`), ITEM_TYPES, 'item type'),
    upgrade: whole(item.upgrade, `${where}'s upgrade`, 0),
    broken: flag(item.broken, `${where}'s broken flag`),
  };
}

function readCharacter(value: unknown, index: number): Character {
  const where = `Character ${String(index + 1)}`;
  const saved = fields(value, where);
  const slots = fields(saved.items, `${where}'s slots`);
  const extra = Object.keys(slots).find((key) => !(SLOTS as readonly string[]).includes(key));
  if (extra !== undefined) {
    throw new Refused('bad-shape', `${where} has a slot called "${extra}", which this build does not have.`);
  }
  const items = Object.fromEntries(
    SLOTS.map((slot) => {
      if (!(slot in slots)) {
        throw new Refused('bad-shape', `${where} has no ${slot} slot.`);
      }
      const held = slots[slot];
      return [slot, held === null ? null : readItem(held, `${where}'s ${slot}`)];
    }),
  ) as Record<GearSlot, Item | null>;
  return {
    id: whole(saved.id, `${where}'s ID`, 1),
    name: text(saved.name, `${where}'s name`),
    classId: known(text(saved.classId, `${where}'s class`), CLASSES, 'class'),
    level: whole(saved.level, `${where}'s level`, 1),
    xp: finite(saved.xp, `${where}'s XP`, 0),
    arts: list(saved.arts, `${where}'s arts`).map((art) => known<ArtId>(text(art, `${where}'s art`), ARTS, 'art')),
    items,
  };
}

function readRecord(value: unknown, index: number): ZoneRecord {
  const where = `Zone record ${String(index + 1)}`;
  const saved = fields(value, where);
  const id = knownZone(text(saved.id, `${where}'s zone`));
  const packs = zoneData(id).contents.packs.length;
  const returns = list(saved.returns, `${where}'s returns`).map((entry, place) => {
    const away = fields(entry, `${where}'s return ${String(place + 1)}`);
    const packId = whole(away.packId, `${where}'s pack`, 0);
    if (packId >= packs) {
      throw new Refused('unknown-id', `The zone "${id}" has no pack ${String(packId)} in this build.`);
    }
    return { packId, tick: whole(away.tick, `${where}'s return tick`, 0) };
  });
  return { id, bossDead: flag(saved.bossDead, `${where}'s boss`), returns, contents: null };
}

function readBody(value: unknown, index: number): SavedBody {
  const where = `Body ${String(index + 1)}`;
  const saved = fields(value, where);
  const body = {
    id: whole(saved.id, `${where}'s ID`, 1),
    x: finite(saved.x, `${where}'s x`),
    z: finite(saved.z, `${where}'s z`),
    health: finite(saved.health, `${where}'s health`, 0),
    mana: finite(saved.mana, `${where}'s mana`, 0),
    alive: flag(saved.alive, `${where}'s alive`),
  };
  if (body.alive && body.health <= 0) {
    throw new Refused('bad-shape', `${where} is alive with no health.`);
  }
  return body;
}

/**
 * S3b's item rules (S3c decision 4): no item ID twice across the inventory and every
 * slot (rule 1), each item in a slot its type fits, and the slots a two-handed weapon
 * fills empty (rule 2).
 */
function checkItems(characters: readonly Character[], inventory: readonly Item[]): void {
  const seen = new Set<number>();
  const note = (item: Item): void => {
    if (seen.has(item.id)) {
      throw new Refused('item-rules', `Item ${String(item.id)} is in two places (rule 1).`);
    }
    seen.add(item.id);
  };
  inventory.forEach(note);
  for (const character of characters) {
    for (const slot of SLOTS) {
      const held = character.items[slot];
      if (!held) continue;
      note(held);
      if (held.broken) {
        throw new Refused('item-rules', `${character.name}'s ${slot} holds a broken ${held.typeId} (D-042).`);
      }
      const type = ITEM_TYPES[held.typeId];
      if (!type?.fits.includes(slot)) {
        throw new Refused('item-rules', `${character.name}'s ${slot} holds a ${held.typeId}, which does not fit there.`);
      }
      const blocked = type.fills.find((filled) => filled !== slot && character.items[filled] !== null);
      if (blocked) {
        throw new Refused('item-rules', `${character.name}'s ${held.typeId} fills the ${blocked}, which is not empty (rule 2).`);
      }
    }
  }
}

/** The ID counters are worked out, never saved (S3c decision 1). */
function nextIds(characters: readonly Character[], inventory: readonly Item[]): { nextId: number; nextItemId: number } {
  const worn = characters.flatMap((character) => SLOTS.flatMap((slot) => character.items[slot] ?? []));
  const itemIds = [...inventory, ...worn].map(({ id }) => id);
  return {
    nextId: Math.max(0, ...characters.map(({ id }) => id)) + 1,
    nextItemId: Math.max(0, ...itemIds) + 1,
  };
}

/** Checks the game data, and builds a game from it with a fresh live group (S3c decisions 1 and 4). */
function build(value: unknown): GameState {
  const game = fields(value, 'The game');
  const family = fields(game.family, 'The family');
  const squad = fields(game.squad, 'The squad');
  const tick = whole(game.tick, 'The tick', 0);
  const rng = whole(game.rng, 'The generator', 0);
  if (rng >>> 0 !== rng) {
    throw new Refused('bad-shape', 'The generator is out of range.');
  }

  const characters = list(family.characters, 'The characters').map(readCharacter);
  const ids = characters.map(({ id }) => id);
  if (new Set(ids).size !== ids.length) {
    throw new Refused('bad-shape', 'Two characters share an ID.');
  }
  const inventory = list(family.inventory, 'The inventory').map((item, index) => readItem(item, `Inventory item ${String(index + 1)}`));
  checkItems(characters, inventory);

  const active = list(family.active, 'The active three').map((id) => whole(id, 'An active character', 1));
  if (active.length === 0 || active.length > FORMATION.length || new Set(active).size !== active.length) {
    throw new Refused('bad-shape', `The active three must be one to ${String(FORMATION.length)} different characters.`);
  }
  const stranger = active.find((id) => !ids.includes(id));
  if (stranger !== undefined) {
    throw new Refused('bad-shape', `Active character ${String(stranger)} is not in the family.`);
  }

  const zoneId = knownZone(text(game.zoneId, 'The zone'));
  const saved = list(game.records, 'The zone records').map(readRecord);
  if (new Set(saved.map(({ id }) => id)).size !== saved.length) {
    throw new Refused('bad-shape', 'Two zone records are for the same zone.');
  }
  // A zone added since the save starts with a fresh record.
  const records = ZONES.map(({ id }) => saved.find((record) => record.id === id) ?? { id, bossDead: false, returns: [], contents: null });

  const anchorFields = fields(squad.anchor, "The triangle's centre");
  const anchor = { x: finite(anchorFields.x, "The triangle's x"), z: finite(anchorFields.z, "The triangle's z") };
  const heading = finite(squad.heading, "The triangle's heading");
  const bodies = list(squad.bodies, 'The bodies').map(readBody);
  if (bodies.length !== active.length || bodies.some((body, place) => body.id !== active[place])) {
    throw new Refused('bad-shape', 'The bodies do not match the active three.');
  }

  const marks = finite(family.marks, 'The marks', 0);
  const potions = whole(family.potions, 'The potions', 0);
  const state: GameState = {
    tick,
    rng,
    ...nextIds(characters, inventory),
    family: { characters, active, inventory, marks, potions },
    bodies: [],
    zoneId,
    records,
    live: emptyLive(),
    anchor,
    heading,
    scatterCooldownTicks: 0,
    sharedTargetId: null,
    potionCooldownTicks: 0,
    squadDown: false,
    wipeTicks: 0,
    // Whether the run is won follows from the boss's record.
  };
  state.bodies = bodies.map((saved) => standBody(state, saved));
  placeSquad(state, bodies);
  enterZone(state, zoneId);
  if (state.bodies.every(({ alive }) => !alive)) {
    state.squadDown = true;
    state.wipeTicks = TICKS.wipe;
  }
  return state;
}

/** A body rebuilt from its character, with its saved health and mana. Down stays down. */
function standBody(state: GameState, saved: SavedBody): Body {
  const character = characterOf(state, saved.id);
  const body = createBody(character, saved);
  body.alive = saved.alive;
  body.health = saved.alive ? Math.min(saved.health, body.maxHealth) : 0;
  body.mana = Math.min(saved.mana, CLASSES[character.classId].mana);
  return body;
}

/**
 * Whether a body may still stand at a saved point in this build. Bodies stand on the
 * edge of the walkable grid, against stones and walls, so a point counts if it touches
 * an open cell and sits less than a body's width inside any obstacle, which the next
 * tick pushes it out of.
 */
function standable(state: GameState, point: Point): boolean {
  const grid = gridOf(state);
  const pushed = { x: point.x, z: point.z };
  pushOutOfObstacles(state, pushed, MOVEMENT.unitRadius);
  if (Math.hypot(pushed.x - point.x, pushed.z - point.z) >= MOVEMENT.unitRadius) {
    return false;
  }
  const open = nearestOpen(grid, point);
  return isOpen(grid, point.x, point.z) || Math.hypot(open.x - point.x, open.z - point.z) <= grid.cell * Math.SQRT2;
}

/** A position no longer walkable in this build puts the squad in its triangle at the zone's camp. */
function placeSquad(state: GameState, saved: readonly SavedBody[]): void {
  if (saved.every((point) => standable(state, point))) {
    return;
  }
  const { camp } = zoneData(state.zoneId);
  state.anchor = { x: camp.x, z: camp.z };
  state.heading = camp.heading;
  for (const body of state.bodies) {
    const { x, z } = standInTriangle(state, body, camp, camp.heading);
    body.x = x;
    body.z = z;
  }
}

/** Runs every step from the save's version to the current one, in order (S3c decision 3). */
export function migrate(game: unknown, from: number, steps: readonly MigrationStep[] = MIGRATIONS): unknown {
  return steps.slice(from - 1).reduce((moved, next) => next(moved), game);
}

/**
 * A game from a save, or a refusal with a reason (S3c decisions 1 to 4). The save is
 * migrated, then checked, and the data passed in is never changed. `steps` is for tests.
 */
export function fromSave(data: unknown, steps: readonly MigrationStep[] = MIGRATIONS): LoadResult {
  try {
    const save = typeof data === 'object' && data !== null ? (data as Fields) : null;
    if (save?.format !== SAVE_FORMAT) {
      throw new Refused('not-a-save', 'This is not a save from The New Frontier.');
    }
    const version = whole(save.version, 'The version', 1);
    const current = steps.length + 1;
    if (version > current) {
      throw new Refused('newer', `This save is version ${String(version)}, and this build reads up to version ${String(current)}.`);
    }
    const savedAt = save.savedAt === undefined ? null : text(save.savedAt, 'The time saved');
    const state = build(migrate(structuredCopy(save.game), version, steps));
    return { ok: true, state, version, savedAt };
  } catch (error) {
    if (error instanceof Refused) {
      return { ok: false, refusal: error.refusal, detail: error.detail };
    }
    throw error;
  }
}

/** A deep copy of plain data, so migration steps never touch what was passed in. */
function structuredCopy(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(structuredCopy);
  }
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, field]) => [key, structuredCopy(field)]));
  }
  return value;
}
