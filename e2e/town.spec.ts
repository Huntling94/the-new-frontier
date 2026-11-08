import { expect, test } from '@playwright/test';
import { bringIntoView, crossInto, openGame, rightClickGround, watchErrors } from './game';

/** Montclaire's gate out, and the Lande's gate back in (S3d decision 5). */
const OUT_OF_TOWN = { x: -17, z: 55 };
const INTO_TOWN = { x: 16, z: 72 };

test('a new game starts in Montclaire, walks out of the gate onto the Lande, and back in (S3d)', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  await openGame(page, 'town&seed=1&speed=4');
  expect(await page.evaluate(() => window.__tnf.view.zoneId)).toBe('montclaire');
  await expect(page.locator('#ban')).toContainText('Montclaire');
  await expect(page.locator('#obj')).toContainText('Head out to Lande de Montclaire');
  expect(await page.evaluate(() => window.__tnf.view.live.enemies.length)).toBe(0);

  // The camera starts south of the squad, behind the houses on the plaza's south side, which fade.
  await expect.poll(() => page.evaluate(() => window.__tnf.world.fadedBuildings())).toBeGreaterThan(0);

  const from = await page.evaluate(() => window.__tnf.events.length);
  await bringIntoView(page, OUT_OF_TOWN);
  await rightClickGround(page, [OUT_OF_TOWN]);
  // So a failure says whether the click missed or the walk was slow.
  await expect
    .poll(() => page.evaluate((count) => window.__tnf.events.slice(count).some(({ type, order }) => type === 'order-accepted' && order === 'move'), from), {
      message: 'The right click on the gate gave no move order.',
    })
    .toBe(true);
  // The plaza to the gate is the longest walk in the tests, and CI renders in software.
  await crossInto(page, 'lande', 60_000);
  await expect(page.locator('#ban')).toContainText('Lande de Montclaire');
  const walked = await page.evaluate((count) => window.__tnf.events.slice(count).map(({ type }) => type), from);
  expect(walked).not.toContain('unit-gave-up');

  await bringIntoView(page, INTO_TOWN);
  await rightClickGround(page, [INTO_TOWN]);
  await crossInto(page, 'montclaire');
  await expect(page.locator('#ban')).toContainText('Montclaire');
  expect(errors).toEqual([]);
});

test('a test page without the town, and a bot run, still start on the Lande (S3d decision 6)', async ({ page }) => {
  await openGame(page, 'seed=1');
  expect(await page.evaluate(() => window.__tnf.view.zoneId)).toBe('lande');
  await openGame(page, 'seed=1&bot=careful');
  expect(await page.evaluate(() => window.__tnf.view.zoneId)).toBe('lande');
});
