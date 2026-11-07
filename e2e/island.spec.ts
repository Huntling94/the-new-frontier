import { expect, test } from '@playwright/test';

/** Counts the distinct colours in a PNG, using the browser to decode it. */
async function countColours(png: string): Promise<number> {
  const bytes = Uint8Array.from(atob(png), (char) => char.charCodeAt(0));
  const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No 2D context.');
  context.drawImage(bitmap, 0, 0);
  const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height);

  // Rounds each channel, so that tiny blends do not count as new colours.
  const bucket = (value: number | undefined): number => Math.floor((value ?? 0) / 16);
  const colours = new Set<string>();
  for (let index = 0; index < data.length; index += 4) {
    colours.add(`${bucket(data[index])},${bucket(data[index + 1])},${bucket(data[index + 2])}`);
  }
  return colours.size;
}

test('the island renders with a clean console', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('./');
  await expect(page).toHaveTitle('The New Frontier');
  const canvas = page.locator('#game');
  await expect(canvas).toBeVisible();
  await expect(page.locator('#fatal')).toBeHidden();

  // The first frames can be blank while WebGL starts.
  await expect
    .poll(async () => {
      const png = (await canvas.screenshot()).toString('base64');
      return page.evaluate(countColours, png);
    })
    .toBeGreaterThanOrEqual(4);

  expect(errors).toEqual([]);
});
