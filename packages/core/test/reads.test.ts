import { describe, expect, it } from 'vitest';
import { ISLAND_SCENARIO } from '../data/scenarios';
import { CLASSES } from '../data/squad';
import { createGame } from '../src/game';
import { currentZone, spellsOf } from '../src/reads';

describe('reads for the screen', () => {
  it('gives the zone holding the squad, with its size and the obstacles the seed placed', () => {
    const state = createGame(7, ISLAND_SCENARIO);
    const zone = currentZone(state);
    expect(zone.id).toBe('isle');
    expect(zone.size).toBe(92);
    expect({ x: zone.x, z: zone.z }).toEqual({ x: 0, z: 0 });
    expect(zone.obstacles).toBe(state.zones[0]?.obstacles);
    expect(zone.obstacles.length).toBeGreaterThan(50);
  });

  it('gives each character its spells in data order, by ID', () => {
    const state = createGame(7, ISLAND_SCENARIO);
    for (const unit of state.units) {
      expect(spellsOf(state, unit.id)).toEqual(CLASSES[unit.classId].spells);
    }
    expect(spellsOf(state, 999)).toEqual([]);
  });
});
