import { expect, test } from '@playwright/test';
import { bringIntoView, crossInto, openGame, rightClickGround, stepUntil, watchErrors } from './game';

/** Montclaire's gate out (S3d decision 5). */
const OUT_OF_TOWN = { x: -17, z: 55 };

test('a new game starts in Montclaire, and walks out of the gate onto the Lande (S3d)', async ({ page }) => {
  const errors = watchErrors(page);
  await openGame(page, 'town&seed=1&speed=4');
  expect(await page.evaluate(() => window.__tnf.view.zoneId)).toBe('montclaire');
  await expect(page.locator('#ban')).toContainText('Montclaire');
  await expect(page.locator('#obj')).toContainText('Head out to Lande de Montclaire');
  expect(await page.evaluate(() => window.__tnf.view.live.enemies.length)).toBe(0);

  // The camera starts south of the squad, behind the houses on the plaza's south side, which fade.
  await stepUntil(page, 'a building to fade', () => window.__tnf.world.fadedBuildings() > 0, null, 60);

  const from = await page.evaluate(() => window.__tnf.events.length);
  await bringIntoView(page, OUT_OF_TOWN);
  await rightClickGround(page, [OUT_OF_TOWN]);
  // So a failure says whether the click missed or the walk was slow.
  await stepUntil(
    page,
    'a move order from the right click on the gate',
    (count) => window.__tnf.events.slice(count).some(({ type, order }) => type === 'order-accepted' && order === 'move'),
    from,
    10,
  );
  // The walk back in is the core's to prove (`town.test`), so one crossing is enough here (S3k).
  await crossInto(page, 'lande');
  await expect(page.locator('#ban')).toContainText('Lande de Montclaire');
  const walked = await page.evaluate((count) => window.__tnf.events.slice(count).map(({ type }) => type), from);
  expect(walked).not.toContain('unit-gave-up');
  expect(errors).toEqual([]);
});

test('a test page without the town, and a bot run, still start on the Lande (S3d decision 6)', async ({ page }) => {
  await openGame(page, 'seed=1');
  expect(await page.evaluate(() => window.__tnf.view.zoneId)).toBe('lande');
  await openGame(page, 'seed=1&bot=careful');
  expect(await page.evaluate(() => window.__tnf.view.zoneId)).toBe('lande');
});
