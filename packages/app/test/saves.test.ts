import { applyCommands, createGame, ISLAND_SCENARIO, step, type GameState } from '@new-frontier/core';
import { describe, expect, it } from 'vitest';
import {
  AUTOSAVE_SECONDS,
  AutoSaver,
  BrowserSaveStore,
  describeSave,
  exportName,
  quiet,
  readSave,
  SAVE_KEYS,
  saveText,
  savingAllowed,
  type SaveStore,
} from '../src/saves';

/** `localStorage` in a map, which can be told to refuse writes as a full store does. */
class FakeStorage implements Storage {
  readonly items = new Map<string, string>();
  full = false;
  get length(): number {
    return this.items.size;
  }
  clear(): void {
    this.items.clear();
  }
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.items.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.items.delete(key);
  }
  setItem(key: string, value: string): void {
    if (this.full) throw new Error('QuotaExceededError');
    this.items.set(key, value);
  }
}

/** A store that keeps what it is given. */
class MemoryStore implements SaveStore {
  texts: string[] = [];
  load(): Promise<string | null> {
    return Promise.resolve(this.texts.at(-1) ?? null);
  }
  save(text: string): Promise<void> {
    this.texts.push(text);
    return Promise.resolve();
  }
  delete(): Promise<void> {
    this.texts = [];
    return Promise.resolve();
  }
}

/** A game with the nearest pack awake, which counts as a fight. */
function fighting(): GameState {
  const state = createGame(1, ISLAND_SCENARIO);
  const enemy = state.live.enemies[0];
  if (!enemy) throw new Error('No enemies.');
  enemy.awake = true;
  return state;
}

describe('the browser store (S3c decision 5)', () => {
  it('holds one save under one key, and copies the last one to a second key before each write', async () => {
    const storage = new FakeStorage();
    const store = new BrowserSaveStore(storage);
    expect(await store.load()).toBeNull();
    await store.save('first');
    expect(await store.load()).toBe('first');
    expect(storage.getItem(SAVE_KEYS.backup)).toBeNull();
    await store.save('second');
    expect(await store.load()).toBe('second');
    expect(await store.loadBackup()).toBe('first');
    await store.delete();
    expect(await store.load()).toBeNull();
    expect(await store.loadBackup()).toBeNull();
  });

  it('rejects a write the browser refuses, and keeps the save it had', async () => {
    const storage = new FakeStorage();
    const store = new BrowserSaveStore(storage);
    await store.save('good');
    storage.full = true;
    await expect(store.save('new')).rejects.toThrow('Quota');
    expect(await store.load()).toBe('good');
  });
});

describe('when saving is on (S3c decision 9)', () => {
  it('is off for bot, seed and test runs, unless a test asks for saves', () => {
    const allowed = (query: string): boolean => savingAllowed(new URLSearchParams(query));
    expect(allowed('')).toBe(true);
    expect(allowed('?speed=2')).toBe(true);
    expect(allowed('?bot=careful')).toBe(false);
    expect(allowed('?seed=4')).toBe(false);
    expect(allowed('?test')).toBe(false);
    expect(allowed('?test&seed=1&save')).toBe(true);
    // A bot never saves, even if asked.
    expect(allowed('?bot=careful&test&save')).toBe(false);
  });
});

describe('automatic saving (S3c decision 6)', () => {
  it('saves when no fight is on, at most once every 15 seconds', async () => {
    const store = new MemoryStore();
    const saver = new AutoSaver(store, () => undefined, () => undefined);
    const state = createGame(1, ISLAND_SCENARIO);
    expect(quiet(state)).toBe(true);
    saver.consider(state, 1000);
    await Promise.resolve();
    expect(store.texts).toHaveLength(1);
    saver.consider(state, 1000 + AUTOSAVE_SECONDS * 1000 - 1);
    await Promise.resolve();
    expect(store.texts).toHaveLength(1);
    saver.consider(state, 1000 + AUTOSAVE_SECONDS * 1000);
    await Promise.resolve();
    expect(store.texts).toHaveLength(2);
  });

  it('never saves by itself in a fight or with the squad down, but always after the anvil', async () => {
    const store = new MemoryStore();
    const saver = new AutoSaver(store, () => undefined, () => undefined);
    const fight = fighting();
    expect(quiet(fight)).toBe(false);
    saver.consider(fight, 0);
    expect(await saver.saveNow(fight, 0)).toBe(false);
    const down = createGame(1, ISLAND_SCENARIO);
    down.squadDown = true;
    expect(await saver.saveNow(down, 0)).toBe(false);
    expect(store.texts).toHaveLength(0);
    expect(await saver.saveNow(fight, 0, true)).toBe(true);
    expect(store.texts).toHaveLength(1);
  });

  it('reports a failed save', async () => {
    const storage = new FakeStorage();
    storage.full = true;
    const failures: Error[] = [];
    const saver = new AutoSaver(new BrowserSaveStore(storage), () => undefined, (error) => failures.push(error));
    expect(await saver.saveNow(createGame(1, ISLAND_SCENARIO), 0)).toBe(false);
    expect(failures).toHaveLength(1);
  });
});

describe('save text', () => {
  it('carries the time it was saved, and reads back into the same family', () => {
    const state = createGame(1, ISLAND_SCENARIO);
    applyCommands(state, [{ type: 'regroup' }]);
    for (let tick = 0; tick < 30; tick += 1) step(state, []);
    const text = saveText(state, new Date('2026-11-08T03:04:05.000Z'));
    const result = readSave(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.savedAt).toBe('2026-11-08T03:04:05.000Z');
    expect(result.state.family).toEqual(state.family);
    expect(describeSave(result.state, null)).toBe('Levels: Aurelio 3, Inês 3, Mireille 3');
  });

  it('refuses text that is not JSON, or not a save', () => {
    expect(readSave('{not json')).toMatchObject({ ok: false, refusal: 'not-a-save' });
    expect(readSave('{"format":"other"}')).toMatchObject({ ok: false, refusal: 'not-a-save' });
  });

  it('downloads under a dated name', () => {
    expect(exportName(new Date(2026, 10, 8, 14, 30))).toBe('the-new-frontier-save-2026-11-08.json');
  });
});
