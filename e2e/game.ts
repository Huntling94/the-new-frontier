import { expect, type Page } from '@playwright/test';

/** What the page's test hook gives (decision 16). Kept loose: it is read in the page. */
export interface Hook {
  frames: number;
  seed: number;
  view: {
    tick: number;
    anchor: { x: number; z: number };
    victory: boolean;
    units: { id: number; x: number; z: number; alive: boolean; hold: boolean; dest: unknown; spellTicks: Record<string, number> }[];
    enemies: { id: number; kind: string; alive: boolean; awake: boolean }[];
  };
  selected: number[];
  camera: { x: number; z: number; zoom: number; zoomTarget: number; yaw: number; tiltAdjust: number; follow: boolean };
  events: { type: string; tick: number; order?: string; unitId?: number; spell?: string }[];
  world: {
    groundAt(x: number, y: number): { x: number; z: number } | null;
    screenOf(point: { x: number; y: number; z: number }): { x: number; y: number; visible: boolean };
    heightAt(x: number, z: number): number;
    pickables(): { units: { id: number; screen: { x: number; y: number } }[]; enemies: unknown[] };
    rebuildZone(): void;
    memory(): { geometries: number; textures: number; programs: number };
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

export async function openGame(page: Page, query = 'seed=1'): Promise<void> {
  await page.goto(`./?test&${query}`);
  await expect(page.locator('#fatal')).toBeHidden();
  await page.waitForFunction(() => window.__tnf?.frames > 5);
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
