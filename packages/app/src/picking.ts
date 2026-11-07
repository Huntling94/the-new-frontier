import type { Box, Pickable } from '@new-frontier/render';

/** The nearest on screen within `radius` pixels of the pointer, as the squad test picks. */
export function pickNearest(list: readonly Pickable[], x: number, y: number, radius: number): number | null {
  let best: number | null = null;
  let bestDistance = radius;
  for (const { id, screen } of list) {
    if (!screen.visible) continue;
    const distance = Math.hypot(screen.x - x, screen.y - y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = id;
    }
  }
  return best;
}

/** Everyone whose body is inside the box, with a margin round it. */
export function pickInBox(list: readonly Pickable[], box: Box, margin: number): number[] {
  const left = Math.min(box.x0, box.x1) - margin;
  const right = Math.max(box.x0, box.x1) + margin;
  const top = Math.min(box.y0, box.y1) - margin;
  const bottom = Math.max(box.y0, box.y1) + margin;
  return list
    .filter(({ screen }) => screen.visible && screen.x >= left && screen.x <= right && screen.y >= top && screen.y <= bottom)
    .map(({ id }) => id);
}
