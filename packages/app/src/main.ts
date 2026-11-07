import { TEST_ISLAND } from '@new-frontier/core';
import { createIslandView, type IslandView } from '@new-frontier/render';
import { fitViewport } from './viewport';

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) {
    throw new Error(`The page has no #${id} element.`);
  }
  return found as T;
}

const canvas = element<HTMLCanvasElement>('game');

function fit(view: IslandView): void {
  const { width, height, pixelRatio } = fitViewport(
    canvas.clientWidth,
    canvas.clientHeight,
    window.devicePixelRatio,
  );
  view.resize(width, height, pixelRatio);
}

try {
  const view = createIslandView(canvas, TEST_ISLAND);
  fit(view);
  window.addEventListener('resize', () => {
    fit(view);
  });
} catch {
  canvas.hidden = true;
  element('fatal').hidden = false;
}
