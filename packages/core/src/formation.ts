import { FORMATION } from '../data/squad';
import type { Body, GameState, Point } from './state';

export function livingUnits(state: GameState): Body[] {
  return state.bodies.filter((unit) => unit.alive);
}

/** The middle of a list of units, which must not be empty. */
export function centreOf(units: readonly Body[]): Point {
  const x = units.reduce((sum, unit) => sum + unit.x, 0);
  const z = units.reduce((sum, unit) => sum + unit.z, 0);
  return { x: x / units.length, z: z / units.length };
}

/** A place in the triangle, by place in the active three, turned to face `heading` (D-025). */
export function triangleSlot(place: number, centre: Point, heading: number): Point {
  const { forward, side } = FORMATION[place]?.slot ?? { forward: 0, side: 0 };
  const cos = Math.cos(heading);
  const sin = Math.sin(heading);
  return {
    x: centre.x + forward * cos - side * sin,
    z: centre.z + forward * sin + side * cos,
  };
}
