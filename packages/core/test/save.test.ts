import { describe, expect, it } from 'vitest';
import { ITEM_TYPES, SLOTS } from '../data/items';
import { ISLAND_SCENARIO } from '../data/scenarios';
import { zoneData } from '../src/world';
import { botCommands } from '../src/bots';
import { hitEnemy } from '../src/combat';
import { createGame, step } from '../src/game';
import { hashState } from '../src/hash';
import { createItem } from '../src/items';
import { SAVE_VERSION } from '../src/migrations';
import { fightOn } from '../src/reads';
import { fromSave, migrate, toSave } from '../src/save';
import type { GameState } from '../src/state';
import { enterZone, recordOf } from '../src/zones';
import { SNIPER, unitOf } from './helpers';
import V1 from './saves/v1.json' with { type: 'json' };
import V2 from './saves/v2.json' with { type: 'json' };

/** Frozen forever: every later build must load it (S3c decision 3). */
const V1_SAVE: unknown = V1;

/** A careful bot's run, stopped when no fight is on, as the app saves. */
function playedGame(seed: number, ticks: number): GameState {
  const state = createGame(seed, ISLAND_SCENARIO);
  while (!state.victory && (state.tick < ticks || fightOn(state) || state.squadDown)) step(state, botCommands(state, 'careful'));
  return state;
}

function load(data: unknown): GameState {
  const result = fromSave(data);
  if (!result.ok) throw new Error(`Refused: ${result.refusal}, ${result.detail}`);
  return result.state;
}

/** A plain copy of plain data. */
function copy<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T;
}

type Plain = Record<string, unknown>;

/** The value at a dotted path, such as `game.family.characters.0.classId`. */
function getAt(data: unknown, path: string): unknown {
  return path.split('.').filter(Boolean).reduce<unknown>((at, key) => (at as Plain)[key], data);
}

/** A copy of the version 1 save with one value changed, or removed if the value is `REMOVE`. */
const REMOVE = Symbol('remove');
function changed(path: string, value: unknown): unknown {
  const save = copy(V1_SAVE);
  const keys = path.split('.');
  const last = keys.pop() ?? '';
  const parent = getAt(save, keys.join('.')) as Plain;
  if (value === REMOVE) Reflect.deleteProperty(parent, last);
  else parent[last] = value;
  return save;
}

/**
 * The save of a loaded game, less the generator. Loading enters the zone afresh, and
 * building its packs draws from the generator, as any entry does.
 */
function lasting(save: { readonly format: string; readonly version: number; readonly game: object }): object {
  return { format: save.format, version: save.version, game: { ...save.game, rng: 'drawn on entry' } };
}

function refusal(data: unknown): string {
  const result = fromSave(data);
  return result.ok ? 'loaded' : result.refusal;
}

/** What a fresh entry into the zone does to a game: the live group rebuilt, and every body's orders and timers gone. */
function enterAfresh(original: GameState): GameState {
  const state = copy(original);
  state.nextId = Math.max(...state.family.characters.map(({ id }) => id)) + 1;
  state.nextItemId =
    Math.max(...state.family.inventory.map(({ id }) => id), ...state.family.characters.flatMap((c) => SLOTS.flatMap((slot) => c.items[slot]?.id ?? []))) + 1;
  Object.assign(state, { scatterCooldownTicks: 0, sharedTargetId: null, potionCooldownTicks: 0 });
  for (const body of state.bodies) {
    Object.assign(body, {
      dest: null,
      hold: false,
      attackMove: false,
      bestDistance: null,
      stuckTicks: 0,
      route: [],
      routeGoal: null,
      dashTicks: 0,
      dashX: 0,
      dashZ: 0,
      invulnerableTicks: 0,
      targetId: null,
      forced: false,
      attackTicks: 0,
      spellTicks: {},
      guardTicks: 0,
      rallyTicks: 0,
    });
  }
  enterZone(state, state.zoneId);
  return state;
}

describe('a save (S3c)', () => {
  it('turns into text and back with every lasting value the same, and no live value in it', () => {
    const state = playedGame(2, 2400);
    const save = toSave(state);
    const text = JSON.stringify(save);
    const back = load(JSON.parse(text));
    expect(lasting(toSave(back))).toEqual(lasting(save));
    expect(Object.keys(save.game).sort()).toEqual(['family', 'records', 'rng', 'squad', 'tick', 'zoneId']);
    expect(Object.keys(save.game.squad.bodies[0] ?? {}).sort()).toEqual(['alive', 'health', 'id', 'mana', 'x', 'z']);
    for (const live of ['"live"', 'enemies', 'drops', 'spellTicks', 'nextId', 'nextItemId', 'contents', 'Cooldown', 'targetId', 'route']) {
      expect(text).not.toContain(live);
    }
    // Levels, XP, gear, inventory, marks and potions all came through.
    expect(back.family).toEqual(state.family);
    expect(back.records.map(({ id, bossDead, returns }) => ({ id, bossDead, returns }))).toEqual(
      state.records.map(({ id, bossDead, returns }) => ({ id, bossDead, returns })),
    );
  });

  it('is far under 100 KB', () => {
    expect(JSON.stringify(toSave(playedGame(3, 6000))).length).toBeLessThan(100_000);
    expect(JSON.stringify(V1_SAVE).length).toBeLessThan(100_000);
  });

  it('loads into a game that plays on exactly as a fresh entry into its zone would, with the same generator', () => {
    const state = playedGame(4, 2400);
    const loaded = load(copy(toSave(state)));
    const fresh = enterAfresh(state);
    expect(hashState(loaded)).toBe(hashState(fresh));
    for (let tick = 0; tick < 1800; tick += 1) {
      const events = step(loaded, botCommands(loaded, 'careful'));
      expect(step(fresh, botCommands(fresh, 'careful'))).toEqual(events);
    }
    expect(hashState(loaded)).toBe(hashState(fresh));
  });

  it('leaves out the ID counters and works them out, so new enemies, drops and items get unused IDs', () => {
    const loaded = load(copy(toSave(playedGame(6, 1200))));
    const characterIds = loaded.family.characters.map(({ id }) => id);
    const worn = loaded.family.characters.flatMap((character) => SLOTS.flatMap((slot) => character.items[slot] ?? []));
    const itemIds = [...loaded.family.inventory, ...worn].map(({ id }) => id);
    expect(loaded.nextItemId).toBe(Math.max(...itemIds) + 1);
    const enemyIds = loaded.live.enemies.map(({ id }) => id);
    expect(enemyIds.length).toBeGreaterThan(0);
    for (const id of enemyIds) expect(characterIds).not.toContain(id);
    expect(new Set(enemyIds).size).toBe(enemyIds.length);
    expect(itemIds).not.toContain(createItem(loaded, 'cap').id);
    // Play on until something drops: its ID is no character's or enemy's.
    let dropId: number | null = null;
    for (let tick = 0; tick < 6000 && dropId === null; tick += 1) {
      step(loaded, botCommands(loaded, 'careful'));
      dropId = loaded.live.drops[0]?.id ?? null;
    }
    expect(dropId).not.toBeNull();
    expect(characterIds).not.toContain(dropId);
    expect(enemyIds).not.toContain(dropId);
  });
});

describe('the version 1 example save', () => {
  it('loads in this build, in the cave, with the levels, gear, health and mana it holds', () => {
    const result = fromSave(V1_SAVE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.version).toBe(1);
    expect(result.savedAt).toBe('2026-11-08T12:00:00.000Z');
    const { state } = result;
    expect(state.zoneId).toBe('lande-cave');
    // Montclaire came after this save was made, so it gets a fresh record (S3d decision 10).
    const town = { id: 'montclaire', bossDead: false, returns: [] };
    expect(lasting(toSave(state))).toEqual(lasting({ ...V2, game: { ...V2.game, records: [...V2.game.records, town] } }));
    // Health and mana as saved: a reload never heals the squad.
    expect(state.bodies.map(({ health, mana }) => ({ health, mana }))).toEqual(V1.game.squad.bodies.map(({ health, mana }) => ({ health, mana })));
    expect(state.bodies.some(({ health, maxHealth }) => health < maxHealth)).toBe(true);
  });

  it('puts each body where it stood', () => {
    const state = load(V1_SAVE);
    expect(state.bodies.map(({ id, x, z }) => ({ id, x, z }))).toEqual(V1.game.squad.bodies.map(({ id, x, z }) => ({ id, x, z })));
    expect(state.anchor).toEqual(V1.game.squad.anchor);
  });

  it('puts a squad at its starting places on the Lande, against the waystone, where it stood', () => {
    const state = createGame(1, ISLAND_SCENARIO);
    const loaded = load(copy(toSave(state)));
    expect(loaded.bodies.map(({ x, z }) => ({ x, z }))).toEqual(state.bodies.map(({ x, z }) => ({ x, z })));
  });

  it('falls back to the triangle at the zone camp if a position is no longer walkable', () => {
    // Inside the cave's L-shaped wall.
    const state = load(changed('game.squad.bodies.1', { ...V1.game.squad.bodies[1], x: -14, z: -10 }));
    const { camp } = zoneData('lande-cave');
    expect(state.anchor).toEqual({ x: camp.x, z: camp.z });
    expect(state.heading).toBe(camp.heading);
    for (const body of state.bodies) expect(Math.hypot(body.x - camp.x, body.z - camp.z)).toBeLessThan(6);
  });

  it('keeps a character down', () => {
    const state = load(changed('game.squad.bodies.0', { ...V1.game.squad.bodies[0], alive: false, health: 0 }));
    expect(state.bodies[0]?.alive).toBe(false);
    expect(state.bodies[0]?.health).toBe(0);
    expect(state.squadDown).toBe(false);
  });
});

describe('a cleared pack', () => {
  it('comes back at the same tick it would have without the save', () => {
    const state = createGame(5, ISLAND_SCENARIO);
    for (const enemy of state.live.enemies.filter((member) => member.packId === 0)) {
      hitEnemy(state, unitOf(state, SNIPER), enemy, 1e6, []);
    }
    const due = recordOf(state).returns.find(({ packId }) => packId === 0)?.tick;
    expect(due).toBeDefined();
    const loaded = load(copy(toSave(state)));
    expect(loaded.live.enemies.some((enemy) => enemy.packId === 0)).toBe(false);
    const backAt = (game: GameState): number => {
      while (!game.live.enemies.some((enemy) => enemy.packId === 0 && enemy.alive)) step(game, []);
      return game.tick;
    };
    expect(backAt(loaded)).toBe(backAt(state));
    expect(loaded.tick - 1).toBe(due);
  });
});

describe('migration (S3c decision 3)', () => {
  // Test-only steps, run on the version 2 example, which needs no real step to load.
  const atVersion = (version: number): unknown => ({ ...copy(V2), version });
  const addOne = (game: unknown): unknown => {
    const moved = copy(game) as { family: { marks: number } };
    moved.family.marks += 1;
    return moved;
  };
  const timesTen = (game: unknown): unknown => {
    const moved = copy(game) as { family: { marks: number } };
    moved.family.marks *= 10;
    return moved;
  };

  it('writes version 2, after one step', () => {
    expect(SAVE_VERSION).toBe(2);
    expect(toSave(createGame(1, ISLAND_SCENARIO)).version).toBe(2);
  });

  it('runs every step from the save version to the current one, in order', () => {
    const marks = V2.game.family.marks;
    const fromOne = fromSave(atVersion(1), [addOne, timesTen]);
    expect(fromOne.ok && fromOne.state.family.marks).toBe((marks + 1) * 10);
    const fromTwo = fromSave(atVersion(2), [addOne, timesTen]);
    expect(fromTwo.ok && fromTwo.state.family.marks).toBe(marks * 10);
    const fromThree = fromSave(atVersion(3), [addOne, timesTen]);
    expect(fromThree.ok && fromThree.state.family.marks).toBe(marks);
    expect(migrate({ n: 1 }, 1, [])).toEqual({ n: 1 });
  });

  it('never changes the data passed in, even if a step does', () => {
    const data = atVersion(1);
    const before = JSON.stringify(data);
    const careless = (game: unknown): unknown => {
      (game as { family: { marks: number } }).family.marks = 0;
      return game;
    };
    expect(fromSave(data, [careless]).ok).toBe(true);
    expect(JSON.stringify(data)).toBe(before);
  });

  it('refuses a save from a newer version, and leaves the stored text unchanged', () => {
    const text = JSON.stringify(changed('version', SAVE_VERSION + 1));
    const stored = text;
    const result = fromSave(JSON.parse(stored));
    expect(result.ok).toBe(false);
    expect(!result.ok && result.refusal).toBe('newer');
    expect(stored).toBe(text);
  });
});

describe('the check (S3c decision 4)', () => {
  const FIGHTER_ITEMS = 'game.family.characters.0.items';
  const SNIPER_ITEMS = 'game.family.characters.1.items';

  it('refuses what is not a save', () => {
    expect(refusal(null)).toBe('not-a-save');
    expect(refusal({ format: 'something-else', version: 1, game: {} })).toBe('not-a-save');
    expect(refusal(changed('format', REMOVE))).toBe('not-a-save');
  });

  it('refuses a save with a missing ID or field', () => {
    expect(refusal(changed('game.family.characters.0.id', REMOVE))).toBe('bad-shape');
    expect(refusal(changed('game.zoneId', REMOVE))).toBe('bad-shape');
    expect(refusal(changed(`${FIGHTER_ITEMS}.head`, REMOVE))).toBe('bad-shape');
    expect(refusal(changed('game.rng', -1))).toBe('bad-shape');
    expect(refusal(changed('game.family.active', [1, 2, 9]))).toBe('bad-shape');
    expect(refusal(changed('game.squad.bodies', V1.game.squad.bodies.slice(1)))).toBe('bad-shape');
    expect(refusal(changed('version', REMOVE))).toBe('bad-shape');
  });

  it('refuses a save with an unknown class, art, item type, zone or pack (rule 9)', () => {
    expect(refusal(changed('game.family.characters.0.classId', 'wizard'))).toBe('unknown-id');
    expect(refusal(changed('game.family.characters.0.arts', ['alchemy']))).toBe('unknown-id');
    expect(refusal(changed(`${FIGHTER_ITEMS}.main-hand.typeId`, 'laser'))).toBe('unknown-id');
    expect(refusal(changed('game.zoneId', 'the-moon'))).toBe('unknown-id');
    expect(refusal(changed('game.records.0.id', 'the-moon'))).toBe('unknown-id');
    expect(refusal(changed('game.records.0.returns.0.packId', 99))).toBe('unknown-id');
  });

  it('refuses an item in two places (rule 1)', () => {
    const sword = getAt(V1, `${FIGHTER_ITEMS}.main-hand`);
    expect(refusal(changed('game.family.inventory', [...V1.game.family.inventory, sword]))).toBe('item-rules');
    expect(refusal(changed(`${SNIPER_ITEMS}.chest.id`, getAt(V1, `${FIGHTER_ITEMS}.chest.id`)))).toBe('item-rules');
  });

  it('refuses an item in a slot its type does not fit, or a filled slot beside a two-handed weapon (rule 2)', () => {
    expect(refusal(changed(`${FIGHTER_ITEMS}.head`, { id: 999, typeId: 'sword', upgrade: 0 }))).toBe('item-rules');
    expect(getAt(V1, `${SNIPER_ITEMS}.main-hand.typeId`)).toBe('rifle');
    expect(ITEM_TYPES.rifle?.fills).toContain('off-hand');
    expect(refusal(changed(`${SNIPER_ITEMS}.off-hand`, { id: 999, typeId: 'buckler', upgrade: 0 }))).toBe('item-rules');
  });
});

describe('version 1 to 2 (S3e decision 12)', () => {
  const PLAIN: Readonly<Record<string, string>> = {
    'plain-sword': 'sword',
    'plain-rifle': 'rifle',
    'plain-staff': 'staff',
    'plain-chest': 'leather-chest',
    'plain-gloves': 'leather-gloves',
    'plain-boots': 'leather-boots',
    'plain-cap': 'cap',
    'plain-buckler': 'buckler',
    'plain-necklace': 'necklace',
  };

  /** The frozen version 1 save with every plain type in it, and upgrades on each. */
  function withSpares(): { save: typeof V1; plain: Map<number, { typeId: string; upgrade: number }> } {
    const save = copy(V1);
    const items = save.game.family.inventory as { id: number; typeId: string; upgrade: number }[];
    const plain = new Map<number, { typeId: string; upgrade: number }>();
    Object.keys(PLAIN).forEach((typeId, index) => {
      const item = { id: 1000 + index, typeId, upgrade: index };
      items.push(item);
      plain.set(item.id, { typeId, upgrade: item.upgrade });
    });
    return { save, plain };
  }

  it('turns every plain item into its replacement, with ID and upgrade kept, and no ID twice', () => {
    const { save, plain } = withSpares();
    const state = load(save);
    for (const [id, was] of plain) {
      expect(state.family.inventory.find((item) => item.id === id)).toEqual({ id, typeId: PLAIN[was.typeId], upgrade: was.upgrade, broken: false });
    }
    const ids = [...state.family.inventory, ...state.family.characters.flatMap((character) => SLOTS.flatMap((slot) => character.items[slot] ?? []))].map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('turns a worn plain item into its replacement', () => {
    const save = copy(V1);
    const chest = save.game.family.characters[0]?.items.chest;
    if (!chest) throw new Error('No chest.');
    chest.typeId = 'plain-chest';
    const worn = load(save).family.characters[0]?.items.chest;
    expect(worn).toEqual({ id: chest.id, typeId: 'leather-chest', upgrade: chest.upgrade, broken: false });
  });

  it('marks every item unbroken', () => {
    const state = load(V1_SAVE);
    const worn = state.family.characters.flatMap((character) => SLOTS.flatMap((slot) => character.items[slot] ?? []));
    expect([...worn, ...state.family.inventory].every(({ broken }) => !broken)).toBe(true);
  });

  it('refuses a plain type in a version 2 save (rule 9)', () => {
    const save = copy(V2);
    const [first] = save.game.family.inventory;
    if (!first) throw new Error('No item.');
    first.typeId = 'plain-sword';
    expect(refusal(save)).toBe('unknown-id');
  });

  it('refuses a broken item worn in a slot', () => {
    const save = copy(V2);
    const held = save.game.family.characters[0]?.items['main-hand'];
    if (!held) throw new Error('Nothing held.');
    held.broken = true;
    expect(refusal(save)).toBe('item-rules');
  });

  it('loads the frozen version 2 example, the same game as the version 1 example migrated', () => {
    expect(V2.version).toBe(SAVE_VERSION);
    expect(toSave(load(V2)).game.family).toEqual(toSave(load(V1_SAVE)).game.family);
  });
});
