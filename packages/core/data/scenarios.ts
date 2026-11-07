import type { Scenario } from '../src/state';
import { PACKS } from './enemies';

/** The squad at camp on an empty island. */
export const EMPTY_SCENARIO: Scenario = {
  name: 'empty',
  squadStart: { x: 0, z: 62 },
  squadHeading: -Math.PI / 2,
  dummy: null,
  packs: [],
  boss: null,
};

/** The squad at camp, with a training dummy in the clearing to the north. */
export const DUMMY_SCENARIO: Scenario = {
  ...EMPTY_SCENARIO,
  name: 'dummy',
  dummy: { x: 0, z: 30 },
};

/** The real game: the squad at camp, the seven packs, and the boss by the beacon. */
export const ISLAND_SCENARIO: Scenario = {
  ...EMPTY_SCENARIO,
  name: 'island',
  packs: PACKS,
  boss: { x: 0, z: 16 },
};
