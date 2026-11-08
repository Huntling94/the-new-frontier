import { CLASSES } from '../data/squad';
import type { Character, ClassData, GameState, GameView } from './state';

type CharacterView = GameView['family']['characters'][number];

/** The character with that ID. Every body points at one (decision 1). */
export function characterOf(state: GameState, id: number): Character;
export function characterOf(state: GameView, id: number): CharacterView;
export function characterOf(state: GameView, id: number): CharacterView {
  const character = state.family.characters.find((candidate) => candidate.id === id);
  if (!character) {
    throw new Error(`No character ${String(id)}.`);
  }
  return character;
}

/** The class of the character with that ID. */
export function classOf(state: GameView, id: number): ClassData {
  return CLASSES[characterOf(state, id).classId];
}

/** A character's place in the active three, which sets its place in the triangle (D-025). */
export function placeOf(state: GameView, id: number): number {
  return state.family.active.indexOf(id);
}
