import type { Replay } from '../../src/state';
import { SQUAD_TOUR } from './squad-tour';

/** Named replays for tests and the dev viewer. The public page does not import them. */
export const REPLAYS: Readonly<Record<string, Replay>> = {
  'squad tour': SQUAD_TOUR,
};
