import { expect, test, type Page } from '@playwright/test';
import { openGame, watchErrors } from './game';

/** The Lande's gate into the cave, the cave's way out, and points the cave's L-shaped wall hides. */
const INTO_CAVE = { x: -16, z: 72 };
const OUT_OF_CAVE = { x: -36, z: 22 };
const BEHIND_WALL = [
  { x: -6, z: -18 },
  { x: -2, z: -14 },
  { x: -8, z: -8 },
  { x: 2, z: -22 },
];

/** Where a ground point shows on the page, if it shows on the game itself and not under the HUD. */
async function onScreen(page: Page, point: { x: number; z: number }): Promise<{ x: number; y: number } | null> {
  return page.evaluate(({ x, z }) => {
    const { world } = window.__tnf;
    const at = world.screenOf({ x, y: world.heightAt(x, z), z });
    const under = document.elementFromPoint(at.x, at.y);
    return at.visible && (under?.id === 'game' || under?.id === 'overlay') ? { x: at.x, y: at.y } : null;
  }, point);
}

/** Zooms all the way out, so the whole of a small zone fits on screen. */
async function zoomOut(page: Page): Promise<void> {
  await page.mouse.move(640, 300);
  for (let turn = 0; turn < 8; turn += 1) await page.mouse.wheel(0, 400);
  await expect.poll(() => page.evaluate(() => Math.abs(window.__tnf.camera.zoom - window.__tnf.camera.zoomTarget))).toBeLessThan(0.01);
}

async function rightClickGround(page: Page, points: readonly { x: number; z: number }[]): Promise<{ x: number; z: number }> {
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
async function bringIntoView(page: Page, point: { x: number; z: number }): Promise<void> {
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

async function crossInto(page: Page, zoneId: string): Promise<void> {
  await page.waitForFunction(() => window.__tnf.fading, undefined, { timeout: 20_000, polling: 'raf' });
  await page.waitForFunction((id) => window.__tnf.view.zoneId === id && !window.__tnf.fading, zoneId, { timeout: 10_000 });
}

test('the squad walks into the cave, round its wall with one right click, and back out (S3a)', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = watchErrors(page);
  await openGame(page, 'seed=1&speed=4');

  await rightClickGround(page, [INTO_CAVE]);
  await crossInto(page, 'lande-cave');
  await expect(page.locator('#ban')).toContainText('A cave under the Lande');

  await zoomOut(page);
  const from = await page.evaluate(() => window.__tnf.events.length);
  const target = await rightClickGround(page, BEHIND_WALL);
  // The order lands on the next tick, and then everyone walks until they arrive.
  await page.waitForFunction((count) => window.__tnf.events.slice(count).some(({ order }) => order === 'move'), from);
  await page.waitForFunction(() => window.__tnf.view.units.every((unit) => unit.dest === null), undefined, { timeout: 30_000 });
  const since = await page.evaluate((count) => window.__tnf.events.slice(count).map(({ type }) => type), from);
  expect(since).not.toContain('unit-gave-up');
  expect(since.filter((type) => type === 'unit-arrived')).toHaveLength(3);
  const fighter = await page.evaluate(() => window.__tnf.view.units[0]);
  expect(Math.hypot((fighter?.x ?? 0) - target.x, (fighter?.z ?? 0) - target.z)).toBeLessThan(6);

  await zoomOut(page);
  await bringIntoView(page, OUT_OF_CAVE);
  await rightClickGround(page, [OUT_OF_CAVE]);
  await crossInto(page, 'lande');
  expect(errors).toEqual([]);
});
