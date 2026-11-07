import { describe, expect, it } from 'vitest';
import { ISLAND_SCENARIO } from '../data/scenarios';
import { CLASSES } from '../data/squad';
import { createGame } from '../src/game';
import { SPELLS } from '../data/spells';
import { cardOf, currentZone, spellInfo, spellsOf } from '../src/reads';
import { xpToNextLevel } from '../src/stats';
import { secondsToTicks } from '../src/time';

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

  it('gives each card its maximum mana and the XP to the next level', () => {
    const state = createGame(7, ISLAND_SCENARIO);
    for (const unit of state.units) {
      expect(cardOf(state, unit.id)).toEqual({ maxMana: CLASSES[unit.classId].mana, xpToNext: xpToNextLevel(unit.level) });
    }
    expect(cardOf(state, 999)).toBeNull();
  });

  it('gives a spell its cooldown in ticks and its mana cost', () => {
    expect(spellInfo('mend')).toEqual({ cooldownTicks: secondsToTicks(SPELLS.mend.cooldownSeconds), mana: SPELLS.mend.mana });
  });
});
