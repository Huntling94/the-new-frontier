import { CLASSES } from '../data/squad';
import type { ClassId, GameState, Point, Unit } from './state';

export function livingUnits(state: GameState): Unit[] {
  return state.units.filter((unit) => unit.alive);
}

/** The middle of a list of units, which must not be empty. */
export function centreOf(units: readonly Unit[]): Point {
  const x = units.reduce((sum, unit) => sum + unit.x, 0);
  const z = units.reduce((sum, unit) => sum + unit.z, 0);
  return { x: x / units.length, z: z / units.length };
}

/** A class's place in the triangle, turned to face `heading`. */
export function triangleSlot(classId: ClassId, centre: Point, heading: number): Point {
  const { forward, side } = CLASSES[classId].slot;
  const cos = Math.cos(heading);
  const sin = Math.sin(heading);
  return {
    x: centre.x + forward * cos - side * sin,
    z: centre.z + forward * sin + side * cos,
  };
}
