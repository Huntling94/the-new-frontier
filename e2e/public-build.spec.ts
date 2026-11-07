import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { REPLAYS } from '@new-frontier/core';
import { expect, test } from '@playwright/test';

const dist = fileURLToPath(new URL('../packages/app/dist/', import.meta.url));
const files = readdirSync(dist, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => `${entry.parentPath}/${entry.name}`);

test('the build is really there to check', () => {
  expect(files.some((file) => file.endsWith('index.html'))).toBe(true);
  expect(files.some((file) => file.endsWith('.js'))).toBe(true);
});

test('the public build has no viewer page', () => {
  expect(files.filter((file) => file.endsWith('viewer.html'))).toEqual([]);
});

test('the public build holds no replay', () => {
  const hashes = Object.values(REPLAYS).map((replay) => replay.expectedHash);
  expect(hashes.length).toBeGreaterThan(0);
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const hash of hashes) {
      expect(text.includes(hash), `${file} holds replay hash ${hash}`).toBe(false);
    }
  }
});
