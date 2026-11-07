/** Sharper than this costs a lot of drawing for little visible gain. */
const MAX_PIXEL_RATIO = 1.75;

export interface Viewport {
  readonly width: number;
  readonly height: number;
  readonly pixelRatio: number;
}

/** Turns a browser's measurements into a size that is always safe to draw at. */
export function fitViewport(width: number, height: number, devicePixelRatio: number): Viewport {
  return {
    width: Math.max(Math.floor(width), 1),
    height: Math.max(Math.floor(height), 1),
    pixelRatio: Math.min(devicePixelRatio || 1, MAX_PIXEL_RATIO),
  };
}
