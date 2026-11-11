import { expect, test } from '@playwright/test';
import { bringIntoView, crossInto, openGame, rightClickGround, watchErrors } from './game';

/** The Lande's gate into the cave, and the cave's way out. */
const INTO_CAVE = { x: -16, z: 72 };
const OUT_OF_CAVE = { x: -36, z: 22 };

// Walking round the cave's wall is the core's to prove (`zones.test`), so the page only crosses (S3k).
test('the squad walks into the cave and back out (S3a)', async ({ page }) => {
  const errors = watchErrors(page);
  await openGame(page, 'seed=1&speed=4');

  await rightClickGround(page, [INTO_CAVE]);
  await crossInto(page, 'lande-cave');
  await expect(page.locator('#ban')).toContainText('A cave under the Lande');

  await bringIntoView(page, OUT_OF_CAVE);
  await rightClickGround(page, [OUT_OF_CAVE]);
  await crossInto(page, 'lande');
  expect(errors).toEqual([]);
});

/** Garganta da Cidadela's south gate, and Carrefour du Colosse's west door (M2). */
const GARGANTA_SOUTH_GATE = { x: 6, z: 101 };
const COLOSSE_WEST_DOOR = { x: -112, z: 21 };

test('the squad crosses between Garganta da Cidadela and Carrefour du Colosse both ways (M2)', async ({ page }) => {
  const errors = watchErrors(page);
  // The test page starts in Garganta with its packs out, so no fight decides the walk.
  await openGame(page, 'seed=1&speed=4&garganta=quiet');

  await bringIntoView(page, GARGANTA_SOUTH_GATE);
  await rightClickGround(page, [GARGANTA_SOUTH_GATE]);
  await crossInto(page, 'carrefour-du-colosse');
  await expect(page.locator('#ban')).toContainText('Carrefour du Colosse');

  await bringIntoView(page, COLOSSE_WEST_DOOR);
  await rightClickGround(page, [COLOSSE_WEST_DOOR]);
  await crossInto(page, 'garganta-da-cidadela');
  await expect(page.locator('#ban')).toContainText('Garganta da Cidadela');
  expect(errors).toEqual([]);
});
