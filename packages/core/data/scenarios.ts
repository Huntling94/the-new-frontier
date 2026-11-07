import type { Scenario } from '../src/state';

/** The squad at camp on an empty island. */
export const EMPTY_SCENARIO: Scenario = {
  name: 'empty',
  squadStart: { x: 0, z: 62 },
  squadHeading: -Math.PI / 2,
  dummy: null,
};

/** The squad at camp, with a training dummy in the clearing to the north. */
export const DUMMY_SCENARIO: Scenario = {
  ...EMPTY_SCENARIO,
  name: 'dummy',
  dummy: { x: 0, z: 30 },
};
