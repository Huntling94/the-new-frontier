import { characterOf, fightOn, fromSave, toSave, type GameView, type LoadResult } from '@new-frontier/core';

/**
 * Where a save is kept (D-032, S3c decision 5). It holds text and knows nothing of the
 * format. The methods are asynchronous, so a cloud store (D-033) fits later unchanged.
 */
export interface SaveStore {
  load(): Promise<string | null>;
  save(text: string): Promise<void>;
  delete(): Promise<void>;
}

/** The two keys in the browser's storage: the save, and the save before it. */
export const SAVE_KEYS = { main: 'the-new-frontier.save', backup: 'the-new-frontier.save.backup' } as const;

/**
 * The browser store, on `localStorage` under one key. Before each write it copies the
 * save already there to a second key, so one bad write or bad migration never loses the run.
 */
export class BrowserSaveStore implements SaveStore {
  private readonly storage: Storage;

  constructor(storage: Storage) {
    this.storage = storage;
  }

  load(): Promise<string | null> {
    return Promise.resolve(this.storage.getItem(SAVE_KEYS.main));
  }

  /** The save before the last one, kept in case the last cannot be loaded. */
  loadBackup(): Promise<string | null> {
    return Promise.resolve(this.storage.getItem(SAVE_KEYS.backup));
  }

  save(text: string): Promise<void> {
    try {
      const last = this.storage.getItem(SAVE_KEYS.main);
      if (last !== null && last !== text) this.storage.setItem(SAVE_KEYS.backup, last);
      this.storage.setItem(SAVE_KEYS.main, text);
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
  }

  delete(): Promise<void> {
    this.storage.removeItem(SAVE_KEYS.main);
    this.storage.removeItem(SAVE_KEYS.backup);
    return Promise.resolve();
  }
}

/**
 * Test and bot runs never save (S3c decision 9): not with `?bot=`, and not with `?seed=`
 * or `?test` unless the address also asks for saves with `?save`, as the browser tests do.
 */
export function savingAllowed(params: URLSearchParams): boolean {
  if (params.has('bot')) return false;
  return params.has('save') || !(params.has('seed') || params.has('test'));
}

/** The game saves at most this often while no fight is on (S3c decision 6). */
export const AUTOSAVE_SECONDS = 15;

/** No fight is on and the squad is not down: the only time an automatic save happens (D-024). */
export function quiet(view: GameView): boolean {
  return !fightOn(view) && !view.squadDown;
}

/** The save as text, with the time it was saved (S3c decision 2). */
export function saveText(view: GameView, savedAt: Date): string {
  return JSON.stringify({ ...toSave(view), savedAt: savedAt.toISOString() });
}

/** Reads a save's text: migrated and checked, or refused with a reason. */
export function readSave(text: string): LoadResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, refusal: 'not-a-save', detail: 'The file is not a save: it is not JSON.' };
  }
  return fromSave(data);
}

/** What Continue shows: each character's level, and when the game was saved (S3c decision 7). */
export function describeSave(view: GameView, savedAt: string | null): string {
  const levels = view.family.active.map((id) => {
    const character = characterOf(view, id);
    return `${character.name} ${character.level}`;
  });
  const when = savedAt ? `, saved ${savedTime(new Date(savedAt))}` : '';
  return `Levels: ${levels.join(', ')}${when}`;
}

/** A time a player reads at a glance: today's as a clock time, older ones with the date. */
export function savedTime(at: Date, now = new Date()): string {
  const time = at.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
  if (at.toDateString() === now.toDateString()) return time;
  return `${at.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}, ${time}`;
}

/** The file name an exported save downloads as. */
export function exportName(at: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `the-new-frontier-save-${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}.json`;
}

/** Downloads text as a `.json` file (S3c decision 8). */
export function download(text: string, name: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Saves the game when no fight is on, at most once every 15 seconds, and at once when
 * asked: on arriving through a gate, on hiding the page, and after every smith result
 * (S3c decision 6).
 */
export class AutoSaver {
  private readonly store: SaveStore;
  private readonly onSaved: (at: Date) => void;
  private readonly onFailed: (error: Error) => void;
  /** The page clock, in milliseconds, of the last save started. */
  private last = Number.NEGATIVE_INFINITY;
  count = 0;

  constructor(store: SaveStore, onSaved: (at: Date) => void, onFailed: (error: Error) => void) {
    this.store = store;
    this.onSaved = onSaved;
    this.onFailed = onFailed;
  }

  /** Called every frame while playing. */
  consider(view: GameView, now: number): void {
    if (quiet(view) && now - this.last >= AUTOSAVE_SECONDS * 1000) void this.saveNow(view, now);
  }

  /** Saves at once if no fight is on, or whatever is on if `always`. Resolves to whether it saved. */
  async saveNow(view: GameView, now: number, always = false): Promise<boolean> {
    if (!always && !quiet(view)) return false;
    this.last = now;
    const at = new Date();
    try {
      await this.store.save(saveText(view, at));
      this.count += 1;
      this.onSaved(at);
      return true;
    } catch (error) {
      this.onFailed(error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }
}
