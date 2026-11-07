import type { Scenario } from '../src/state';

/** The squad at camp on an empty island. */
export const EMPTY_SCENARIO: Scenario = {
  name: 'empty',
  squadStart: { x: 0, z: 62 },
  squadHeading: -Math.PI / 2,
};
