import type { Replay } from '../../src/state';
import { SPELL_TOUR } from './spell-tour';
import { SQUAD_TOUR } from './squad-tour';

/** Named replays for tests and the dev viewer. The public page does not import them. */
export const REPLAYS: Readonly<Record<string, Replay>> = {
  'spell tour': SPELL_TOUR,
  'squad tour': SQUAD_TOUR,
};
