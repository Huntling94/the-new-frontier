import type { Scenario, ZoneContents } from '../src/state';
import { MONTCLAIRE_START } from './montclaire';
import { START_ZONE, TOWN_ZONE } from './zones';

const NOTHING: ZoneContents = { dummy: null, packs: [], boss: null };

/** The real game: the squad at camp on Lande de Montclaire, with its packs and boss. */
export const ISLAND_SCENARIO: Scenario = {
  name: 'island',
  zone: START_ZONE,
  squadStart: { x: 0, z: 62 },
  squadHeading: -Math.PI / 2,
};

/** A player's new game: the squad in Montclaire's plaza, facing the fountain (S3d decision 6). */
export const TOWN_SCENARIO: Scenario = {
  name: 'town',
  zone: TOWN_ZONE,
  squadStart: { x: MONTCLAIRE_START.x, z: MONTCLAIRE_START.z },
  squadHeading: MONTCLAIRE_START.heading,
};

/** The squad at camp, with nothing else in the zone. */
export const EMPTY_SCENARIO: Scenario = {
  ...ISLAND_SCENARIO,
  name: 'empty',
  contents: NOTHING,
};

/** The squad at camp, with a training dummy in the clearing to the north. */
export const DUMMY_SCENARIO: Scenario = {
  ...ISLAND_SCENARIO,
  name: 'dummy',
  contents: { ...NOTHING, dummy: { x: 0, z: 30 } },
};
