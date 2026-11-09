import { expect, test, type Page } from '@playwright/test';
import { bringIntoView, framesPass, openGame, watchErrors } from './game';

const SMITH = { x: -40.6, z: -4 };
const RICH = 100000;
/** The fifth roll on these seeds: on seed 4 the step from +4 to +5 hits, and on seed 1 it misses. */
const HIT = 'town&seed=4&save&speed=2';
const MISS = 'town&seed=1&save&speed=2';

/** Where the smith is drawn now. */
async function smithAt(page: Page): Promise<{ x: number; y: number }> {
  await bringIntoView(page, SMITH);
  return page.evaluate(() => {
    const npc = window.__tnf.world.pickables().npcs[0];
    if (!npc) throw new Error('No NPC is drawn.');
    return { x: npc.screen.x, y: npc.screen.y };
  });
}

/** Hovers over the smith, sees it lit, and right-clicks to talk. */
async function talkToSmith(page: Page): Promise<void> {
  const at = await smithAt(page);
  await page.mouse.move(at.x, at.y);
  await expect.poll(() => page.evaluate(() => window.__tnf.world.npcHighlighted())).toBe(0);
  await expect(page.locator('#game')).toHaveCSS('cursor', 'pointer');
  await page.mouse.down({ button: 'right' });
  await page.mouse.up({ button: 'right' });
  await expect(page.locator('#forge')).toBeVisible({ timeout: 30_000 });
}

async function capId(page: Page): Promise<number> {
  return page.evaluate(() => {
    const cap = window.__tnf.view.family.inventory.find(({ typeId }) => typeId === 'cap');
    if (!cap) throw new Error('No cap.');
    return cap.id;
  });
}

const capState = (page: Page): Promise<{ upgrade: number; broken: boolean } | undefined> =>
  page.evaluate(() => {
    const cap = window.__tnf.view.family.inventory.find(({ typeId }) => typeId === 'cap');
    return cap ? { upgrade: cap.upgrade, broken: cap.broken } : undefined;
  });

/** Takes the cap to +4, which is guaranteed, and asks for the step that can fail. */
async function askForTheRiskyStep(page: Page): Promise<number> {
  const id = await capId(page);
  const row = page.locator(`#forge .urow[data-item="${id}"]`);
  for (let level = 1; level <= 4; level += 1) {
    await row.click();
    await expect(page.locator('#forge .resbox')).toContainText(`is now +${level}`);
  }
  await expect(page.locator('#smithAsk')).toHaveCount(0);
  await row.click();
  await expect(page.locator('#smithAsk')).toContainText('50% chance');
  await expect(page.locator('#smithAsk')).toContainText('A miss breaks the item');
  return id;
}

test('hover over the smith, talk, upgrade an inventory item to +5, and reload: it stands', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  await openGame(page, HIT);
  await page.evaluate((marks) => {
    window.__tnf.view.family.marks = marks;
  }, RICH);
  await talkToSmith(page);
  // The smith's screen does not pause the game (S3e decision 4).
  expect(await page.evaluate(() => window.__tnf.paused)).toBe(false);
  const tick = await page.evaluate(() => window.__tnf.view.tick);
  await expect.poll(() => page.evaluate(() => window.__tnf.view.tick)).toBeGreaterThan(tick);

  await askForTheRiskyStep(page);
  await page.locator('#smithAsk [data-confirm]').click();
  await expect(page.locator('#forge .resbox')).toContainText('is now +5');
  expect(await capState(page)).toEqual({ upgrade: 5, broken: false });

  await page.reload();
  await page.waitForFunction(() => window.__tnf?.frames > 5);
  await page.locator('#continue').click();
  await page.waitForFunction(() => window.__tnf.mode === 'play');
  expect(await capState(page)).toEqual({ upgrade: 5, broken: false });
  expect(errors).toEqual([]);
});

test('on a miss the item is broken, cannot be equipped, says why, and is repaired to +4', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  await openGame(page, MISS);
  await page.evaluate((marks) => {
    window.__tnf.view.family.marks = marks;
  }, RICH);
  await talkToSmith(page);
  const id = await askForTheRiskyStep(page);
  await page.locator('#smithAsk [data-confirm]').click();
  await expect(page.locator('#forge .resbox')).toContainText('breaks');
  expect(await capState(page)).toEqual({ upgrade: 4, broken: true });
  await expect(page.locator(`#forge .urow[data-item="${id}"]`)).toContainText('Broken at +4');
  await page.keyboard.press('Escape');
  await expect(page.locator('#forge')).toBeHidden();

  await page.keyboard.press('Alt+KeyE');
  await expect(page.locator('#inventory')).toBeVisible();
  const tile = page.locator(`#inventory [data-act="shared"][data-item="${id}"]`);
  await expect(tile).toContainText('Broken');
  await tile.click();
  await page.locator('#inventory .islot[data-unit="1"][data-slot="head"]').click();
  await expect(page.locator('#inventoryMessage')).toContainText('It is broken');
  await page.keyboard.press('Escape');
  await expect(page.locator('#inventory')).toBeHidden();

  await talkToSmith(page);
  await page.locator(`#forge .urow[data-item="${id}"]`).click();
  await expect(page.locator('#forge .resbox')).toContainText('repaired to +4');
  expect(await capState(page)).toEqual({ upgrade: 4, broken: false });
  expect(errors).toEqual([]);
});

test('a left click on the smith does not talk, a drag from it is a box-select, and Y does nothing', async ({ page }) => {
  await openGame(page, 'town&seed=1');
  await page.keyboard.press('KeyY');
  await framesPass(page);
  await expect(page.locator('#forge')).toBeHidden();
  const at = await smithAt(page);
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.up();
  await framesPass(page);
  await expect(page.locator('#forge')).toBeHidden();
  expect(await page.evaluate(() => window.__tnf.view.bodies.every(({ dest }) => dest === null))).toBe(true);
  await page.mouse.down();
  await page.mouse.move(at.x + 60, at.y + 60);
  await page.mouse.up();
  await framesPass(page);
  await expect(page.locator('#forge')).toBeHidden();
});
