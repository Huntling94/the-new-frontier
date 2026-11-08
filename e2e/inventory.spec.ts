import { expect, test } from '@playwright/test';
import { openGame, ticksPass, watchErrors } from './game';

test.describe('the inventory (S3b)', () => {
  let errors: string[] = [];
  test.beforeEach(({ page }) => {
    errors = watchErrors(page);
  });
  test.afterEach(() => {
    expect(errors).toEqual([]);
  });

  test('opens on Alt + E, equips the cap on the Fighter, shows the change, closes and resumes', async ({ page }) => {
    await openGame(page);
    await page.keyboard.press('Alt+KeyE');
    await expect(page.locator('#inventory')).toBeVisible();
    expect(await page.evaluate(() => window.__tnf.paused)).toBe(true);
    // Holding Alt keeps E from casting the Fighter's third spell (D-040).
    expect(await page.evaluate(() => window.__tnf.events.some((event) => event.type === 'spell-cast'))).toBe(false);
    const tick = await page.evaluate(() => window.__tnf.view.tick);

    // The inventory holds the cap, buckler and necklace, and each of the three shows seven slots.
    await expect(page.locator('#inventory .shared .itile')).toHaveCount(3);
    await expect(page.locator('#inventory .icols > div')).toHaveCount(3);
    await expect(page.locator('#inventory .icols > div').first().locator('.islot')).toHaveCount(7);
    await expect(page.locator('#inventory .icols > div').first()).toContainText('Aurelio');
    // The Sniper's rifle fills both hands.
    await expect(page.locator('#inventory .islot[data-unit="2"][data-slot="off-hand"]')).toContainText('Held by Rifle');

    const capId = await page.evaluate(() => window.__tnf.view.family.inventory.find(({ typeId }) => typeId === 'cap')?.id);
    await page.locator(`#inventory .shared .itile[data-item="${String(capId)}"]`).click();
    const head = page.locator('#inventory .islot[data-unit="1"][data-slot="head"]');
    await head.hover();
    await expect(page.locator('#inventoryPreview')).toContainText('Def');
    await expect(page.locator('#inventoryPreview .up')).toContainText('→');
    await head.click();
    await expect(head).toContainText('Leather Cap');
    await expect(page.locator('#inventory .shared .itile')).toHaveCount(2);
    expect(await page.evaluate(() => window.__tnf.view.family.characters[0]?.items.head?.typeId)).toBe('cap');
    expect(await page.evaluate(() => window.__tnf.view.tick)).toBe(tick);

    await page.keyboard.press('Alt+KeyE');
    await expect(page.locator('#inventory')).toBeHidden();
    await ticksPass(page, 5);
    expect(await page.evaluate(() => window.__tnf.paused)).toBe(false);
  });

  test('says why an equip is refused, and Esc closes it', async ({ page }) => {
    await openGame(page);
    await page.keyboard.press('Alt+KeyE');
    await expect(page.locator('#inventory')).toBeVisible();
    const bucklerId = await page.evaluate(() => window.__tnf.view.family.inventory.find(({ typeId }) => typeId === 'buckler')?.id);
    await page.locator(`#inventory .shared .itile[data-item="${String(bucklerId)}"]`).click();
    await page.locator('#inventory .islot[data-unit="3"][data-slot="off-hand"]').click();
    await expect(page.locator('#inventoryMessage')).toContainText('has no art for a shield');
    await page.keyboard.press('Escape');
    await expect(page.locator('#inventory')).toBeHidden();
  });
});
