import { expect, test, type Locator } from '@playwright/test';
import { openGame, openStart, ticksPass, watchErrors } from './game';

/** The share of the button the cooldown shade covers, from 0 to 1. */
const shadeOf = (button: Locator): Promise<number> =>
  button.locator('i').evaluate((shade) => Number(/scaleY\(([\d.]+)\)/.exec((shade as HTMLElement).style.transform)?.[1] ?? 0));

test.describe('the interface (S2.3b)', () => {
  let errors: string[] = [];
  test.beforeEach(({ page }) => {
    errors = watchErrors(page);
  });
  test.afterEach(() => {
    expect(errors).toEqual([]);
  });

  test('a run starts from the start screen, and nothing ticks before it', async ({ page }) => {
    await openStart(page);
    await expect(page.locator('#start')).toBeVisible();
    await expect(page.locator('#keyList kbd').first()).toHaveText('Right click ground');
    await expect(page.locator('#keyList')).toContainText('Use the anvil');
    const frames = await page.evaluate(() => window.__tnf.frames);
    await page.waitForFunction((at) => window.__tnf.frames > at + 10, frames);
    expect(await page.evaluate(() => [window.__tnf.mode, window.__tnf.view.tick])).toEqual(['start', 0]);
    await expect(page.locator('#hud')).toBeHidden();

    await page.locator('#go').click();
    await expect(page.locator('#start')).toBeHidden();
    await expect(page.locator('#hud')).toBeVisible();
    await ticksPass(page, 5);
    expect(await page.evaluate(() => [window.__tnf.mode, window.__tnf.audio])).toEqual(['play', true]);
    await expect(page.locator('.card')).toHaveCount(3);
    await expect(page.locator('.card').first()).toContainText('F1 Fighter');
    await expect(page.locator('#log')).toContainText('Squad ready');
  });

  test('a spell button casts, and its cooldown begins', async ({ page }) => {
    await openGame(page);
    const button = page.locator('.card').nth(0).locator('.sp').nth(1);
    await expect(button).toContainText('W');
    await expect(button).toContainText('Cleave');
    await button.click();
    await ticksPass(page, 2);
    const casts = await page.evaluate(() =>
      window.__tnf.events.filter((event) => event.type === 'spell-cast').map(({ unitId, spell }) => ({ unitId, spell })),
    );
    expect(casts).toEqual([{ unitId: 1, spell: 'cleave' }]);
    expect(await page.evaluate(() => window.__tnf.view.units[0]?.spellTicks.cleave)).toBeGreaterThan(0);
    // The shade over the button shows the cooldown, and shrinks as it runs.
    await expect.poll(() => shadeOf(button)).toBeGreaterThan(0.5);
    const first = await shadeOf(button);
    await ticksPass(page, 30);
    await expect.poll(() => shadeOf(button)).toBeLessThan(first);
  });

  test('the anvil opens on Y, pauses the game, buys an upgrade, and resumes', async ({ page }) => {
    await openGame(page);
    await page.keyboard.press('KeyY');
    await expect(page.locator('#forge')).toBeVisible();
    expect(await page.evaluate(() => window.__tnf.paused)).toBe(true);
    const tick = await page.evaluate(() => window.__tnf.view.tick);
    const marks = await page.evaluate(() => window.__tnf.view.marks);
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => window.__tnf.view.tick)).toBe(tick);

    // Every slot the gear holds gets a row: four for each of the three today.
    await expect(page.locator('#forge .ucols > div')).toHaveCount(3);
    await expect(page.locator('#forge .urow')).toHaveCount(12);
    await page.locator('#forge .urow[data-unit="1"][data-slot="weapon"]').click();
    await expect(page.locator('#forge .resbox')).toContainText("Fighter's Sword is now +1.");
    expect(await page.evaluate(() => window.__tnf.view.units[0]?.gear.weapon?.upgrade)).toBe(1);
    expect(await page.evaluate(() => window.__tnf.view.marks)).toBeLessThan(marks);
    // Still paused after buying: the command landed with no tick.
    expect(await page.evaluate(() => window.__tnf.view.tick)).toBe(tick);
    expect(await page.evaluate(() => window.__tnf.events.some((event) => event.type === 'upgraded'))).toBe(true);

    await page.keyboard.press('Escape');
    await expect(page.locator('#forge')).toBeHidden();
    await ticksPass(page, 5);

    await page.keyboard.press('KeyY');
    await expect(page.locator('#forge')).toBeVisible();
    await page.keyboard.press('KeyY');
    await expect(page.locator('#forge')).toBeHidden();
    expect(await page.evaluate(() => window.__tnf.paused)).toBe(false);
  });

  test('N mutes and unmutes the sound, and H hides and shows help', async ({ page }) => {
    await openGame(page);
    expect(await page.evaluate(() => [window.__tnf.muted, window.__tnf.volume])).toEqual([false, 0.5]);
    await page.keyboard.press('KeyN');
    expect(await page.evaluate(() => [window.__tnf.muted, window.__tnf.volume])).toEqual([true, 0]);
    await page.keyboard.press('KeyN');
    expect(await page.evaluate(() => [window.__tnf.muted, window.__tnf.volume])).toEqual([false, 0.5]);

    await expect(page.locator('#hint')).toBeVisible();
    await page.keyboard.press('KeyH');
    await expect(page.locator('#hint')).toBeHidden();
    await page.keyboard.press('KeyH');
    await expect(page.locator('#hint')).toBeVisible();
  });

  test('cards show who is in auto-combat (D-035)', async ({ page }) => {
    await openGame(page);
    await page.keyboard.press('F2');
    await page.keyboard.press('Space');
    const auto = page.locator('.card .auto');
    await expect(auto.nth(1)).toBeVisible();
    await expect(auto.nth(0)).toBeHidden();
    await expect(auto.nth(2)).toBeHidden();
    await expect(page.locator('#log')).toContainText('Auto-combat on');
  });

  test('selecting one character alone turns follow on, onto them (D-037)', async ({ page }) => {
    await openGame(page);
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(250);
    await page.keyboard.up('ArrowUp');
    expect(await page.evaluate(() => window.__tnf.camera.follow)).toBe(false);
    // With follow off, selecting the Sniper alone turns it back on, onto the Sniper.
    await page.keyboard.press('F2');
    expect(await page.evaluate(() => window.__tnf.camera.follow)).toBe(true);
    // The Sniper stands about 5 units from the squad's middle, and may still be walking
    // into place, so the easing camera trails it a little. It must settle on the Sniper,
    // well clear of the middle the camera followed before.
    const offCentre = (): Promise<number> =>
      page.evaluate(() => {
        const { units } = window.__tnf.view;
        const sniper = units[1];
        const { x, z } = window.__tnf.camera;
        if (!sniper) return -Infinity;
        const middle = {
          x: units.reduce((sum, unit) => sum + unit.x, 0) / units.length,
          z: units.reduce((sum, unit) => sum + unit.z, 0) / units.length,
        };
        return Math.hypot(middle.x - x, middle.z - z) - Math.hypot(sniper.x - x, sniper.z - z);
      });
    await expect.poll(offCentre, { timeout: 10_000 }).toBeGreaterThan(2.5);
  });
});
