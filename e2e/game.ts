import { expect, type Page } from '@playwright/test';

/** What the page's test hook gives (decision 16). Kept loose: it is read in the page. */
export interface Hook {
  frames: number;
  seed: number;
  /** Saving is on for this page (S3c). */
  saving: boolean;
  saves: number;
  saveNow(): Promise<boolean>;
  view: {
    tick: number;
    anchor: { x: number; z: number };
    family: {
      marks: number;
      potions: number;
      active: number[];
      characters: { id: number; name: string; classId: string; level: number; xp: number; items: Record<string, { id: number; typeId: string; upgrade: number; broken: boolean } | null> }[];
      inventory: { id: number; typeId: string; upgrade: number; broken: boolean }[];
    };
    bodies: {
      id: number;
      x: number;
      z: number;
      health: number;
      mana: number;
      alive: boolean;
      hold: boolean;
      dest: unknown;
      spellTicks: Record<string, number>;
    }[];
    zoneId: string;
    records: { id: string; returns: { packId: number; tick: number }[] }[];
    live: { enemies: { id: number; kind: string; alive: boolean; awake: boolean }[] };
  };
  selected: number[];
  mode: 'start' | 'play' | 'won';
  paused: boolean;
  muted: boolean;
  volume: number;
  audio: boolean;
  /** A gate crossing is fading out or in. */
  fading: boolean;
  camera: { x: number; z: number; zoom: number; zoomTarget: number; yaw: number; tiltAdjust: number; follow: boolean };
  events: { type: string; tick: number; order?: string; unitId?: number; spell?: string; amount?: number }[];
  world: {
    groundAt(x: number, y: number): { x: number; z: number } | null;
    screenOf(point: { x: number; y: number; z: number }): { x: number; y: number; visible: boolean };
    heightAt(x: number, z: number): number;
    pickables(): { units: { id: number; screen: { x: number; y: number } }[]; enemies: unknown[]; npcs: { id: number; screen: { x: number; y: number } }[] };
    npcHighlighted(): number | null;
    rebuildZone(): void;
    memory(): { geometries: number; textures: number; programs: number };
    floating(): number;
    fadedBuildings(): number;
  };
}

declare global {
  interface Window {
    __tnf: Hook;
  }
}

/** Collects console errors and page errors for the whole test. */
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

/** Opens the page on the start screen, without starting a run. */
export async function openStart(page: Page, query = 'seed=1'): Promise<void> {
  await page.goto(`./?test&${query}`);
  await expect(page.locator('#fatal')).toBeHidden();
  await page.waitForFunction(() => window.__tnf?.frames > 5);
}

/** Opens the page and presses Start, as a player would. */
export async function openGame(page: Page, query = 'seed=1'): Promise<void> {
  await openStart(page, query);
  await page.locator('#go').click();
  await expect(page.locator('#start')).toBeHidden();
  await page.waitForFunction(() => window.__tnf.mode === 'play' && window.__tnf.view.tick > 2);
}

export async function ticksPass(page: Page, ticks: number): Promise<void> {
  const from = await page.evaluate(() => window.__tnf.view.tick);
  await page.waitForFunction((until) => window.__tnf.view.tick >= until, from + ticks);
}

/** Taps an arrow key, which pans a little and turns follow off, so the camera holds still. */
export async function stillCamera(page: Page): Promise<void> {
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(250);
  await page.keyboard.up('ArrowUp');
  await expect.poll(() => page.evaluate(() => window.__tnf.camera.follow)).toBe(false);
  await page.waitForTimeout(300);
}

/** Where a ground point shows on the page, if it shows on the game itself and not under the HUD. */
export async function onScreen(page: Page, point: { x: number; z: number }): Promise<{ x: number; y: number } | null> {
  return page.evaluate(({ x, z }) => {
    const { world } = window.__tnf;
    const at = world.screenOf({ x, y: world.heightAt(x, z), z });
    const under = document.elementFromPoint(at.x, at.y);
    return at.visible && (under?.id === 'game' || under?.id === 'overlay') ? { x: at.x, y: at.y } : null;
  }, point);
}

export async function rightClickGround(page: Page, points: readonly { x: number; z: number }[]): Promise<{ x: number; z: number }> {
  for (const point of points) {
    const at = await onScreen(page, point);
    if (at) {
      await page.mouse.move(at.x, at.y);
      await page.mouse.down({ button: 'right' });
      await page.mouse.up({ button: 'right' });
      return point;
    }
  }
  throw new Error('None of the points is on screen.');
}

/** Pans with the arrow keys until a ground point shows, as a player would look for it. */
export async function bringIntoView(page: Page, point: { x: number; z: number }): Promise<void> {
  for (let step = 0; step < 20 && !(await onScreen(page, point)); step += 1) {
    const at = await page.evaluate(({ x, z }) => window.__tnf.world.screenOf({ x, y: window.__tnf.world.heightAt(x, z), z }), point);
    const keys = [
      ...(at.x < 320 ? ['ArrowLeft'] : at.x > 960 ? ['ArrowRight'] : []),
      ...(at.y < 180 ? ['ArrowUp'] : at.y > 540 ? ['ArrowDown'] : []),
    ];
    for (const key of keys) await page.keyboard.down(key);
    await page.waitForTimeout(200);
    for (const key of keys) await page.keyboard.up(key);
  }
}

/** Waits out a gate crossing. `walkMs` is how long the walk to the gate may take. */
export async function crossInto(page: Page, zoneId: string, walkMs = 20_000): Promise<void> {
  await page.waitForFunction(() => window.__tnf.fading, undefined, { timeout: walkMs, polling: 'raf' });
  await page.waitForFunction((id) => window.__tnf.view.zoneId === id && !window.__tnf.fading, zoneId, { timeout: 10_000 });
}
