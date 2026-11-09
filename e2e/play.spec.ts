import { expect, test, type Page } from '@playwright/test';
import { framesPass, openGame, stillCamera, ticksPass, watchErrors } from './game';

const CENTRE = { x: 640, y: 360 };

async function rightClick(page: Page, x: number, y: number): Promise<void> {
  await page.mouse.move(x, y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.up({ button: 'right' });
}

async function acceptedMoves(page: Page): Promise<number> {
  return page.evaluate(
    () => window.__tnf.events.filter((event) => event.type === 'order-accepted' && event.order === 'move').length,
  );
}

async function unitsAt(page: Page): Promise<{ id: number; x: number; z: number }[]> {
  return page.evaluate(() => window.__tnf.view.bodies.map(({ id, x, z }) => ({ id, x, z })));
}

async function camera(page: Page): Promise<Window['__tnf']['camera']> {
  return page.evaluate(() => ({ ...window.__tnf.camera }));
}

async function allArrived(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__tnf.view.bodies.every((unit) => unit.dest === null));
}

test.describe('commanding the squad', () => {
  let errors: string[] = [];
  test.beforeEach(async ({ page }) => {
    errors = watchErrors(page);
    await openGame(page);
  });
  test.afterEach(() => {
    expect(errors).toEqual([]);
  });

  test('a right click moves the squad to the point under the cursor, at four rotations', async ({ page }) => {
    test.setTimeout(90_000);
    await stillCamera(page);
    const yaws: number[] = [];
    const offsets = [
      { x: 90, y: 40 },
      { x: -80, y: 60 },
      { x: 60, y: -50 },
      { x: -70, y: -40 },
    ];
    for (const offset of offsets) {
      const before = await camera(page);
      yaws.push(before.yaw);
      const x = CENTRE.x + offset.x;
      const y = CENTRE.y + offset.y;
      const under = await page.evaluate(([px, py]) => window.__tnf.world.groundAt(px, py), [x, y] as const);
      await rightClick(page, x, y);
      await ticksPass(page, 2);
      const anchor = await page.evaluate(() => window.__tnf.view.anchor);
      // A click on open ground lands exactly. One beside a stone moves to the
      // nearest walkable cell (S3a decision 7), which is never more than a stone's margin away.
      const moved = Math.hypot(anchor.x - (under?.x ?? NaN), anchor.z - (under?.z ?? NaN));
      expect(moved).toBeLessThan(3.5);

      // The anchor check above is the precise one. The bodies only settle round the
      // point: the slots sit 0.93 behind it, each body stops within 0.9 of its slot,
      // and bodies push apart or give up when blocked.
      await allArrived(page);
      const units = await unitsAt(page);
      const centre = {
        x: units.reduce((sum, unit) => sum + unit.x, 0) / units.length,
        z: units.reduce((sum, unit) => sum + unit.z, 0) / units.length,
      };
      expect(Math.hypot(centre.x - anchor.x, centre.z - anchor.z)).toBeLessThan(3);

      // An order turns follow back on, so the camera goes with the squad (D-034).
      expect((await camera(page)).follow).toBe(true);
      await stillCamera(page);

      // Turn for the next round, with a rotation key.
      await page.keyboard.down('Period');
      await page.waitForFunction((from) => Math.abs(window.__tnf.camera.yaw - from) >= 0.7, before.yaw);
      await page.keyboard.up('Period');
      await framesPass(page);
    }
    expect(new Set(yaws.map((yaw) => yaw.toFixed(2))).size).toBe(4);
  });

  test('a right drag turns the camera and never orders a move', async ({ page }) => {
    const before = await camera(page);
    const moves = await acceptedMoves(page);
    await page.mouse.move(CENTRE.x, CENTRE.y);
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(CENTRE.x + 40, CENTRE.y + 10, { steps: 4 });
    await page.mouse.move(CENTRE.x + 160, CENTRE.y + 60, { steps: 8 });
    await page.mouse.up({ button: 'right' });
    await ticksPass(page, 3);
    expect(await acceptedMoves(page)).toBe(moves);
    const after = await camera(page);
    expect(after.yaw).toBeLessThan(before.yaw - 0.4);
    expect(after.tiltAdjust).toBeGreaterThan(0.1);
  });

  test('Ctrl and a left click attack-moves, and the order brings follow back', async ({ page }) => {
    await stillCamera(page);
    await page.keyboard.down('Control');
    await page.mouse.click(CENTRE.x + 80, CENTRE.y - 40);
    await page.keyboard.up('Control');
    await ticksPass(page, 2);
    const attacking = await page.evaluate(() => window.__tnf.view.bodies.map((unit) => (unit as { attackMove?: boolean }).attackMove));
    expect(attacking).toEqual([true, true, true]);
    expect((await camera(page)).follow).toBe(true);
  });

  test('F1 selects one character, and only that one moves', async ({ page }) => {
    await stillCamera(page);
    await page.keyboard.press('F1');
    expect(await page.evaluate(() => window.__tnf.selected)).toEqual([1]);
    const before = await unitsAt(page);
    await rightClick(page, CENTRE.x + 100, CENTRE.y + 30);
    await ticksPass(page, 20);
    const after = await unitsAt(page);
    const moved = after.filter((unit, index) => {
      const was = before[index];
      return was !== undefined && Math.hypot(unit.x - was.x, unit.z - was.z) > 0.5;
    });
    expect(moved.map(({ id }) => id)).toEqual([1]);
  });

  test('a left drag box-selects two characters', async ({ page }) => {
    await stillCamera(page);
    const screens = await page.evaluate(() => window.__tnf.world.pickables().units);
    const two = screens.filter(({ id }) => id !== 1).map(({ screen }) => screen);
    const xs = two.map(({ x }) => x);
    const ys = two.map(({ y }) => y);
    await page.mouse.move(Math.min(...xs) - 12, Math.min(...ys) - 6);
    await page.mouse.down();
    await page.mouse.move(Math.max(...xs) + 12, Math.max(...ys) + 12, { steps: 6 });
    await page.mouse.up();
    expect((await page.evaluate(() => window.__tnf.selected)).sort()).toEqual([2, 3]);
  });

  test('G regroups everyone into the triangle', async ({ page }) => {
    await stillCamera(page);
    await page.keyboard.press('F2');
    await rightClick(page, CENTRE.x - 120, CENTRE.y + 40);
    await page.waitForFunction(() => window.__tnf.view.bodies[1]?.hold === true);
    await ticksPass(page, 30);
    await page.keyboard.press('KeyG');
    await ticksPass(page, 2);
    expect((await page.evaluate(() => window.__tnf.selected)).sort()).toEqual([1, 2, 3]);
    expect(await page.evaluate(() => window.__tnf.view.bodies.map(({ hold }) => hold))).toEqual([false, false, false]);
    await allArrived(page);
  });

  test('a spell key casts for the character in that row', async ({ page }) => {
    await page.keyboard.press('KeyQ');
    await page.mouse.move(CENTRE.x, CENTRE.y - 60);
    await page.keyboard.press('KeyD');
    await ticksPass(page, 2);
    const casts = await page.evaluate(() =>
      window.__tnf.events
        .filter((event) => event.type === 'spell-cast')
        .map(({ unitId, spell }) => ({ unitId, spell })),
    );
    expect(casts).toEqual([
      { unitId: 1, spell: 'taunt' },
      { unitId: 2, spell: 'volley' },
    ]);
    expect(await page.evaluate(() => window.__tnf.view.bodies[0]?.spellTicks.taunt)).toBeGreaterThan(0);
  });

  test('the camera grips, rotates, tilts and zooms', async ({ page }) => {
    const start = await camera(page);
    await page.mouse.move(CENTRE.x, CENTRE.y);
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(CENTRE.x + 100, CENTRE.y + 50, { steps: 5 });
    await page.mouse.up({ button: 'right' });
    const orbited = await camera(page);
    // The first 6 pixels only decide it is a drag, so they do not turn the camera.
    expect(orbited.yaw).toBeLessThan(start.yaw - 0.4);
    expect(orbited.yaw).toBeGreaterThan(start.yaw - 100 * 0.006 - 1e-9);
    expect(orbited.tiltAdjust).toBeGreaterThan(0.1);

    // Holding the key keeps turning the camera. Frames are slow and clamped on CI, so wait
    // for the turn rather than for a fixed time.
    await page.keyboard.down('Comma');
    await expect.poll(() => page.evaluate(() => window.__tnf.camera.yaw)).toBeLessThan(orbited.yaw - 0.2);
    await page.keyboard.up('Comma');
    await page.keyboard.press('Backspace');
    expect(await page.evaluate(() => [window.__tnf.camera.yaw, window.__tnf.camera.tiltAdjust])).toEqual([0, 0]);

    await page.mouse.wheel(0, 100);
    await page.mouse.wheel(0, 100);
    await expect.poll(() => page.evaluate(() => window.__tnf.camera.zoomTarget)).toBeCloseTo(start.zoomTarget + 0.16, 6);

    await page.mouse.move(CENTRE.x, CENTRE.y);
    await page.mouse.down({ button: 'middle' });
    await page.mouse.move(CENTRE.x - 150, CENTRE.y, { steps: 6 });
    // The grip is applied when a frame is drawn, so the button stays down until one has.
    await page.waitForFunction(({ x, z }) => Math.hypot(window.__tnf.camera.x - x, window.__tnf.camera.z - z) > 5, { x: start.x, z: start.z });
    await page.mouse.up({ button: 'middle' });
    const gripped = await camera(page);
    expect(gripped.follow).toBe(false);
    expect(Math.hypot(gripped.x - start.x, gripped.z - start.z)).toBeGreaterThan(5);

    await page.keyboard.press('Home');
    expect(await page.evaluate(() => window.__tnf.camera.follow)).toBe(true);
  });

  test('the zone scene drops and rebuilds without errors or leaks', async ({ page }) => {
    const settle = async (): Promise<void> => {
      const at = await page.evaluate(() => window.__tnf.frames + 5);
      await page.waitForFunction((until) => window.__tnf.frames > until, at);
    };
    await page.evaluate(() => window.__tnf.world.rebuildZone());
    await settle();
    const first = await page.evaluate(() => window.__tnf.world.memory());
    for (let round = 0; round < 5; round += 1) {
      await page.evaluate(() => window.__tnf.world.rebuildZone());
      await settle();
    }
    expect(await page.evaluate(() => window.__tnf.world.memory())).toEqual(first);
  });
});

test('a bot clears every pack in the real page, the game carries on, and the console stays clean', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = watchErrors(page);
  await openGame(page, 'seed=1&bot=careful&speed=32');
  // A pack that has been cleared is on the Lande's record until it comes back, so
  // each is counted as it appears there.
  await page.waitForFunction(
    () => {
      const store = window as unknown as { cleared?: Set<number> };
      store.cleared ??= new Set();
      for (const { packId } of window.__tnf.view.records.find(({ id }) => id === 'lande')?.returns ?? []) store.cleared.add(packId);
      return store.cleared.size === 7;
    },
    undefined,
    { timeout: 170_000, polling: 250 },
  );
  // Nothing to win: no end screen, and the clock runs on.
  const tick = await page.evaluate(() => window.__tnf.view.tick);
  await page.waitForFunction((was) => window.__tnf.view.tick > was + 60, tick, { timeout: 30_000 });
  await expect(page.locator('#end')).toHaveCount(0);
  expect(errors).toEqual([]);
});
