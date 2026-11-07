import type { ClassData, ClassId } from '../src/state';

/** Unit order, which sets IDs. */
export const SQUAD: readonly ClassId[] = ['fighter', 'shooter', 'healer'];

/** The squad test's speeds, starting spots and triangle. */
export const CLASSES: Readonly<Record<ClassId, ClassData>> = {
  fighter: { speed: 11, startOffset: { x: 0, z: 0 }, slot: { forward: 2.4, side: 0 } },
  shooter: { speed: 11.5, startOffset: { x: -4.4, z: 4.2 }, slot: { forward: -2.6, side: -4.6 } },
  healer: { speed: 11.5, startOffset: { x: 4.4, z: 4.2 }, slot: { forward: -2.6, side: 4.6 } },
};
