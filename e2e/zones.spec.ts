import { expect, test, type Page } from '@playwright/test';
import { bringIntoView, crossInto, openGame, rightClickGround, watchErrors } from './game';

/** The Lande's gate into the cave, the cave's way out, and points the cave's L-shaped wall hides. */
const INTO_CAVE = { x: -16, z: 72 };
const OUT_OF_CAVE = { x: -36, z: 22 };
const BEHIND_WALL = [
  { x: -6, z: -18 },
  { x: -2, z: -14 },
  { x: -8, z: -8 },
  { x: 2, z: -22 },
];

/** Zooms all the way out, so the whole of a small zone fits on screen. */
async function zoomOut(page: Page): Promise<void> {
  await page.mouse.move(640, 300);
  for (let turn = 0; turn < 8; turn += 1) await page.mouse.wheel(0, 400);
  await expect.poll(() => page.evaluate(() => Math.abs(window.__tnf.camera.zoom - window.__tnf.camera.zoomTarget))).toBeLessThan(0.01);
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
  await page.waitForFunction(() => window.__tnf.view.bodies.every((unit) => unit.dest === null), undefined, { timeout: 30_000 });
  const since = await page.evaluate((count) => window.__tnf.events.slice(count).map(({ type }) => type), from);
  expect(since).not.toContain('unit-gave-up');
  expect(since.filter((type) => type === 'unit-arrived')).toHaveLength(3);
  const fighter = await page.evaluate(() => window.__tnf.view.bodies[0]);
  expect(Math.hypot((fighter?.x ?? 0) - target.x, (fighter?.z ?? 0) - target.z)).toBeLessThan(6);

  await zoomOut(page);
  await bringIntoView(page, OUT_OF_CAVE);
  await rightClickGround(page, [OUT_OF_CAVE]);
  await crossInto(page, 'lande');
  expect(errors).toEqual([]);
});

/** The Lande's gate to Carrefour du Colosse, a point on the road west of the arrival but short of the first pack, so no fight decides the test, and the way back. */
const INTO_COLOSSE = { x: -68, z: 54 };
const WEST_ON_ROAD = { x: 88, z: 6 };
const COLOSSE_WAY_OUT = { x: 112, z: 13 };

/** Looks straight at a ground point, with follow off. */
async function lookAt(page: Page, point: { x: number; z: number }): Promise<void> {
  await page.evaluate(({ x, z }) => {
    const { camera } = window.__tnf;
    camera.follow = false;
    camera.x = x;
    camera.z = z;
  }, point);
  await page.waitForTimeout(250);
}

test('the squad crosses from the Lande to Carrefour du Colosse, walks west, and crosses back (M1)', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  await openGame(page, 'seed=1&speed=4');

  await lookAt(page, INTO_COLOSSE);
  await rightClickGround(page, [INTO_COLOSSE]);
  await crossInto(page, 'carrefour-du-colosse', 40_000);
  await expect(page.locator('#ban')).toContainText('Carrefour du Colosse');
  const atArrival = await page.evaluate(() => window.__tnf.view.bodies[0]?.x ?? 0);

  await lookAt(page, WEST_ON_ROAD);
  const from = await page.evaluate(() => window.__tnf.events.length);
  await rightClickGround(page, [WEST_ON_ROAD]);
  // The order lands on the next tick, and then everyone walks until they arrive.
  await page.waitForFunction((count) => window.__tnf.events.slice(count).some(({ order }) => order === 'move'), from);
  await page.waitForFunction(() => window.__tnf.view.bodies.every((unit) => unit.dest === null), undefined, { timeout: 30_000 });
  const since = await page.evaluate((count) => window.__tnf.events.slice(count).map(({ type }) => type), from);
  expect(since).not.toContain('unit-gave-up');
  expect(await page.evaluate(() => window.__tnf.view.bodies[0]?.x ?? 0)).toBeLessThan(atArrival - 6);

  await lookAt(page, COLOSSE_WAY_OUT);
  await rightClickGround(page, [COLOSSE_WAY_OUT]);
  await crossInto(page, 'lande', 30_000);
  expect(errors).toEqual([]);
});
