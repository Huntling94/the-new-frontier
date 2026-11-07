import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { bakeLayout, layoutFile } from '../src/bake';

const committed = fileURLToPath(new URL('../../core/data/lande-layout.ts', import.meta.url));

describe('the baked layout (D-022)', () => {
  const obstacles = bakeLayout();

  it('matches the committed data file exactly, so a change to the recipe shows in a diff', () => {
    expect(readFileSync(committed, 'utf8').replace(/\r\n/g, '\n')).toBe(layoutFile(obstacles));
  });

  it('places 60 standing stones, where the squad test had trees, and 34 rocks', () => {
    expect(obstacles.filter(({ kind }) => kind === 'stone')).toHaveLength(60);
    expect(obstacles.filter(({ kind }) => kind === 'rock')).toHaveLength(34);
  });

  it('keeps every number whole through the file', () => {
    const [first] = obstacles;
    expect(layoutFile(obstacles)).toContain(`x: ${String(first?.x)},`);
    expect(Number(String(first?.x))).toBe(first?.x);
  });
});
