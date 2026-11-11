import { expect, test, type Locator } from '@playwright/test';
import { openGame, openStart, step, stepUntil, stillCamera, ticksPass, watchErrors } from './game';

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

  // One of the two tests on the page's own frames: it proves the loop runs and draws (S3k decision 8).
  test('a run starts from the start screen, and nothing ticks before it', async ({ page }) => {
    await openStart(page, 'seed=1', true);
    await expect(page.locator('#start')).toBeVisible();
    await expect(page.locator('#keyList kbd').first()).toHaveText('Right click ground');
    await expect(page.locator('#keyList')).toContainText('Upgrade and repair gear');
    const frames = await page.evaluate(() => window.__tnf.frames);
    await page.waitForFunction((at) => window.__tnf.frames > at + 10, frames);
    expect(await page.evaluate(() => [window.__tnf.mode, window.__tnf.view.tick])).toEqual(['start', 0]);
    await expect(page.locator('#hud')).toBeHidden();

    await page.locator('#go').click();
    await expect(page.locator('#start')).toBeHidden();
    await expect(page.locator('#hud')).toBeVisible();
    await page.waitForFunction(() => window.__tnf.view.tick >= 5);
    expect(await page.evaluate(() => [window.__tnf.mode, window.__tnf.audio])).toEqual(['play', true]);
    await expect(page.locator('.card')).toHaveCount(3);
    await expect(page.locator('.card').first()).toContainText('F1 Aurelio');
    await expect(page.locator('.card').first()).toContainText('Fighter');
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
    expect(await page.evaluate(() => window.__tnf.view.bodies[0]?.spellTicks.cleave)).toBeGreaterThan(0);
    // The shade over the button shows the cooldown, and shrinks as it runs. The HUD redraws every few frames.
    await step(page, 4);
    const first = await shadeOf(button);
    expect(first).toBeGreaterThan(0.5);
    await ticksPass(page, 30);
    await step(page, 4);
    expect(await shadeOf(button)).toBeLessThan(first);
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
    await step(page, 4);
    const auto = page.locator('.card .auto');
    await expect(auto.nth(1)).toBeVisible();
    await expect(auto.nth(0)).toBeHidden();
    await expect(auto.nth(2)).toBeHidden();
    await expect(page.locator('#log')).toContainText('Auto-combat on');
  });

  test('selecting one character alone turns follow on, onto them (D-037)', async ({ page }) => {
    await openGame(page);
    await stillCamera(page);
    expect(await page.evaluate(() => window.__tnf.camera.follow)).toBe(false);
    // With follow off, selecting the Sniper alone turns it back on, onto the Sniper.
    await page.keyboard.press('F2');
    expect(await page.evaluate(() => window.__tnf.camera.follow)).toBe(true);
    // The Sniper stands about 5 units from the squad's middle, and may still be walking
    // into place, so the easing camera trails it a little. It must settle on the Sniper,
    // well clear of the middle the camera followed before.
    await stepUntil(
      page,
      'the camera to settle on the Sniper',
      () => {
        const units = window.__tnf.view.bodies;
        const sniper = units[1];
        const { x, z } = window.__tnf.camera;
        if (!sniper) return false;
        const middle = {
          x: units.reduce((sum, unit) => sum + unit.x, 0) / units.length,
          z: units.reduce((sum, unit) => sum + unit.z, 0) / units.length,
        };
        return Math.hypot(middle.x - x, middle.z - z) - Math.hypot(sniper.x - x, sniper.z - z) > 2.5;
      },
      null,
      300,
    );
  });
});
