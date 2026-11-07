import { describe, expect, it } from 'vitest';
import { fitViewport } from '../src/viewport';

describe('fitViewport', () => {
  it('keeps an ordinary window as it is', () => {
    expect(fitViewport(1280, 720, 1)).toEqual({ width: 1280, height: 720, pixelRatio: 1 });
  });

  it('caps the pixel ratio on very sharp screens', () => {
    expect(fitViewport(1280, 720, 3).pixelRatio).toBe(1.75);
  });

  it('never returns a size that would divide by zero', () => {
    expect(fitViewport(0, 0, 0)).toEqual({ width: 1, height: 1, pixelRatio: 1 });
  });

  it('rounds part-pixels down', () => {
    expect(fitViewport(1280.6, 720.4, 1)).toMatchObject({ width: 1280, height: 720 });
  });
});
