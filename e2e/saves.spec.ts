import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { bringIntoView, crossInto, openGame, openStart, rightClickGround, ticksPass, watchErrors } from './game';

/** Saving is off on test pages unless the address asks for it (S3c decision 9). */
const SAVING = 'seed=1&save';
const SAVE_KEY = 'the-new-frontier.save';
const INTO_CAVE = { x: -16, z: 72 };

/** Everything a save should bring back, read from the page. */
interface Snapshot {
  tick: number;
  zoneId: string;
  marks: number;
  potions: number;
  characters: unknown;
  inventory: unknown;
  bodies: { id: number; x: number; z: number; health: number; mana: number; alive: boolean }[];
}

async function snapshot(page: Page): Promise<Snapshot> {
  return page.evaluate(() => {
    const { view } = window.__tnf;
    return {
      tick: view.tick,
      zoneId: view.zoneId,
      marks: view.family.marks,
      potions: view.family.potions,
      characters: view.family.characters.map(({ id, name, level, xp, items }) => ({ id, name, level, xp, items })),
      inventory: view.family.inventory,
      bodies: view.bodies.map(({ id, x, z, health, mana, alive }) => ({ id, x, z, health, mana, alive })),
    };
  });
}

/** Saves now, once no fight is on, and returns what was saved, read in the same moment. */
async function saveNow(page: Page): Promise<Snapshot> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const saved = await page.evaluate(async () => {
      const { view } = window.__tnf;
      const shot = {
        tick: view.tick,
        zoneId: view.zoneId,
        marks: view.family.marks,
        potions: view.family.potions,
        characters: view.family.characters.map(({ id, name, level, xp, items }) => ({ id, name, level, xp, items })),
        inventory: view.family.inventory,
        bodies: view.bodies.map(({ id, x, z, health, mana, alive }) => ({ id, x, z, health, mana, alive })),
      };
      const copy = JSON.parse(JSON.stringify(shot)) as typeof shot;
      return (await window.__tnf.saveNow()) ? copy : null;
    });
    if (saved) return saved;
    await page.waitForTimeout(200);
  }
  throw new Error('A fight never ended, so the game never saved.');
}

/** What a save's text holds, in the same shape as a snapshot. */
function fromText(text: string | null): Snapshot {
  const { game } = JSON.parse(text ?? 'null') as {
    game: {
      tick: number;
      zoneId: string;
      family: { marks: number; potions: number; characters: Record<string, unknown>[]; inventory: unknown };
      squad: { bodies: Snapshot['bodies'] };
    };
  };
  return {
    tick: game.tick,
    zoneId: game.zoneId,
    marks: game.family.marks,
    potions: game.family.potions,
    characters: game.family.characters.map(({ id, name, level, xp, items }) => ({ id, name, level, xp, items })),
    inventory: game.family.inventory,
    bodies: game.squad.bodies,
  };
}

const storedSave = (page: Page): Promise<string | null> => page.evaluate((key) => localStorage.getItem(key), SAVE_KEY);

/**
 * Reloads, and returns what the store holds on the start screen. Hiding the page as it
 * reloads saves once more (S3c decision 6), so that save, not an earlier one, is the game.
 */
async function reload(page: Page): Promise<Snapshot> {
  await page.reload();
  await page.waitForFunction(() => window.__tnf?.frames > 5);
  return fromText(await storedSave(page));
}

/** Reloads, and presses Continue on the start screen. Returns the save it continued. */
async function reloadAndContinue(page: Page): Promise<Snapshot> {
  const stored = await reload(page);
  await expect(page.locator('#continue')).toBeVisible();
  await expect(page.locator('#continueInfo')).toContainText('Levels: Aurelio');
  await expect(page.locator('#go')).toHaveText('New game');
  await page.locator('#continue').click();
  await expect(page.locator('#start')).toBeHidden();
  await page.waitForFunction(() => window.__tnf.mode === 'play');
  return stored;
}

/** The same game: every lasting value, and health and mana as they were, allowing for what happened since. */
async function expectSameGame(page: Page, saved: Snapshot): Promise<void> {
  const now = await snapshot(page);
  expect(now.zoneId).toBe(saved.zoneId);
  expect(now.marks).toBe(saved.marks);
  expect(now.potions).toBe(saved.potions);
  expect(now.characters).toEqual(saved.characters);
  expect(now.inventory).toEqual(saved.inventory);
  const heals = await page.evaluate(() => window.__tnf.events.filter(({ type }) => type === 'healed'));
  const elapsed = now.tick - saved.tick;
  expect(elapsed).toBeGreaterThanOrEqual(0);
  for (const [place, body] of now.bodies.entries()) {
    const before = saved.bodies[place];
    if (!before) throw new Error('A body is missing.');
    expect({ id: body.id, x: body.x, z: body.z, alive: body.alive }).toEqual({ id: before.id, x: before.x, z: before.z, alive: before.alive });
    // Nothing heals on load: health moves only by heals since, and mana only by its slow regeneration.
    const healed = heals.filter(({ unitId }) => unitId === body.id).reduce((sum, { amount }) => sum + (amount ?? 0), 0);
    expect(body.health).toBeGreaterThanOrEqual(before.health);
    expect(body.health).toBeLessThanOrEqual(before.health + healed);
    expect(body.mana).toBeGreaterThanOrEqual(before.mana);
    expect(body.mana).toBeLessThanOrEqual(before.mana + (elapsed * 10) / 30 + 1e-6);
  }
}

async function equipCap(page: Page): Promise<void> {
  await page.keyboard.press('Alt+KeyE');
  await expect(page.locator('#inventory')).toBeVisible();
  const capId = await page.evaluate(() => window.__tnf.view.family.inventory.find(({ typeId }) => typeId === 'cap')?.id);
  await page.locator(`#inventory .shared .itile[data-item="${String(capId)}"]`).click();
  await page.locator('#inventory .islot[data-unit="1"][data-slot="head"]').click();
  await expect(page.locator('#inventory .islot[data-unit="1"][data-slot="head"]')).toContainText('Leather Cap');
  await page.keyboard.press('Alt+KeyE');
  await expect(page.locator('#inventory')).toBeHidden();
}

/** Lasting values only: what the player earned or chose. */
function lasting({ zoneId, marks, potions, characters, inventory }: Snapshot): unknown {
  return { zoneId, marks, potions, characters, inventory };
}

test.describe('saves (S3c)', () => {
  let errors: string[] = [];
  test.beforeEach(({ page }) => {
    errors = watchErrors(page);
  });
  test.afterEach(() => {
    expect(errors).toEqual([]);
  });

  test('play, walk into the cave, reload and Continue: the same levels, XP, marks, gear, zone, positions, health and mana', async ({ page }) => {
    test.setTimeout(150_000);
    await openGame(page, `${SAVING}&speed=4`);
    expect(await page.evaluate(() => window.__tnf.saving)).toBe(true);
    await equipCap(page);

    // Auto-combat fights the nearest camp until it is cleared: XP, marks and some damage.
    await page.keyboard.press('Space');
    await page.waitForFunction(
      () => {
        const { view, events } = window.__tnf;
        return events.some(({ type }) => type === 'enemy-down') && !view.live.enemies.some((enemy) => enemy.alive && enemy.awake);
      },
      undefined,
      { timeout: 90_000, polling: 'raf' },
    );
    await page.keyboard.press('Space');

    // Into the cave: arriving through a gate saves at once.
    const saves = await page.evaluate(() => window.__tnf.saves);
    await bringIntoView(page, INTO_CAVE);
    await rightClickGround(page, [INTO_CAVE]);
    await crossInto(page, 'lande-cave');
    await expect.poll(() => page.evaluate(() => window.__tnf.saves)).toBeGreaterThan(saves);
    await expect(page.locator('#saved')).toContainText('Saved');
    await ticksPass(page, 30);

    const saved = await saveNow(page);
    expect(saved.zoneId).toBe('lande-cave');
    expect((saved.characters as { xp: number }[]).some(({ xp }) => xp > 0)).toBe(true);
    const stored = await reloadAndContinue(page);
    expect(lasting(stored)).toEqual(lasting(saved));
    await expectSameGame(page, stored);
    await expect(page.locator('#ban')).toContainText('A cave under the Lande');
  });

  test('a version 1 save with a spare in it loads, and shows the replacement item (S3e decision 12)', async ({ page }) => {
    const v1 = JSON.parse(await readFile('packages/core/test/saves/v1.json', 'utf8')) as { game: { family: { inventory: { typeId: string; upgrade: number }[] } } };
    const [first] = v1.game.family.inventory;
    if (!first) throw new Error('No item in the example save.');
    first.typeId = 'plain-cap';
    first.upgrade = 2;
    await openStart(page, SAVING);
    await page.evaluate(([key, text]) => localStorage.setItem(key as string, text as string), [SAVE_KEY, JSON.stringify(v1)]);
    await reloadAndContinue(page);
    expect(await page.evaluate(() => window.__tnf.view.family.inventory[0])).toMatchObject({ typeId: 'cap', upgrade: 2, broken: false });
    await page.keyboard.press('Alt+KeyE');
    await expect(page.locator('#inventory')).toContainText('Leather Cap +2');
  });

  test('export, start a new game, import: the exported game comes back', async ({ page }) => {
    await openGame(page, SAVING);
    await equipCap(page);
    const saved = await saveNow(page);
    const stored = await reload(page);
    expect(lasting(stored)).toEqual(lasting(saved));

    const downloading = page.waitForEvent('download');
    await page.locator('#exportSave').click();
    const download = await downloading;
    expect(download.suggestedFilename()).toMatch(/^the-new-frontier-save-\d{4}-\d{2}-\d{2}\.json$/);
    const file = await download.path();
    const exported = await readFile(file, 'utf8');
    expect(exported).toBe(await storedSave(page));

    // New game asks before it replaces the save.
    await page.locator('#go').click();
    await expect(page.locator('#startAsk')).toBeVisible();
    await expect(page.locator('#askText')).toContainText('replaces your saved game');
    await page.locator('#askYes').click();
    await expect(page.locator('#start')).toBeHidden();
    expect(await page.evaluate(() => window.__tnf.view.family.characters[0]?.items.head)).toBeNull();
    await expect.poll(() => storedSave(page)).not.toBe(exported);

    // Import asks too, then plays the exported game.
    await page.reload();
    await page.waitForFunction(() => window.__tnf?.frames > 5);
    await page.locator('#importFile').setInputFiles(file);
    await expect(page.locator('#startAsk')).toBeVisible();
    await expect(page.locator('#askText')).toContainText('Replace your saved game with this one?');
    await page.locator('#askYes').click();
    await expect(page.locator('#start')).toBeHidden();
    expect(await page.evaluate(() => window.__tnf.view.family.characters[0]?.items.head?.typeId)).toBe('cap');
    await expectSameGame(page, stored);
    // The imported game is now the saved one.
    expect(lasting(fromText(await storedSave(page)))).toEqual(lasting(fromText(exported)));
  });

  test('a save this build cannot read is refused, left untouched, offered for export, and the backup offered', async ({ page }) => {
    await openGame(page, SAVING);
    await saveNow(page);
    // Off the saving page first, so hiding it cannot save over the change.
    await openStart(page, 'seed=1');
    const newer = await page.evaluate((key) => {
      const save = JSON.parse(localStorage.getItem(key) ?? '{}') as { version: number };
      save.version = 99;
      const text = JSON.stringify(save);
      localStorage.setItem(key, text);
      return text;
    }, SAVE_KEY);
    await openStart(page, SAVING);
    await expect(page.locator('#saveNote')).toContainText('could not be loaded');
    await expect(page.locator('#saveNote')).toContainText('version 99');
    // The backup key holds the save before it, which Continue offers instead.
    await expect(page.locator('#saveNote')).toContainText('Continue picks up the save before it');
    await expect(page.locator('#continue')).toBeVisible();
    await expect(page.locator('#exportSave')).toBeEnabled();
    expect(await storedSave(page)).toBe(newer);
  });

  test('a ?bot=careful run leaves an existing save untouched', async ({ page }) => {
    test.setTimeout(90_000);
    await openGame(page, SAVING);
    await saveNow(page);

    await openStart(page, 'bot=careful&seed=2&save&speed=8');
    // Read once the saving page has gone, since hiding it saved once more.
    const before = await storedSave(page);
    expect(before).not.toBeNull();
    await expect(page.locator('#continue')).toBeHidden();
    await expect(page.locator('#saveTools')).toBeHidden();
    await page.locator('#go').click();
    await expect(page.locator('#start')).toBeHidden();
    await ticksPass(page, 900);
    expect(await page.evaluate(() => [window.__tnf.saving, window.__tnf.saves])).toEqual([false, 0]);
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(await storedSave(page)).toBe(before);
  });
});
