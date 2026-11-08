import { describe, expect, it } from 'vitest';
import { ARTS } from '../data/items';
import { ISLAND_SCENARIO } from '../data/scenarios';
import { CLASSES } from '../data/squad';
import { ZONES } from '../data/zones';
import { characterOf } from '../src/family';
import { createGame } from '../src/game';
import { SPELLS } from '../data/spells';
import { cardOf, currentZone, spellInfo, spellsOf } from '../src/reads';
import { xpToNextLevel } from '../src/stats';
import { secondsToTicks } from '../src/time';

describe('reads for the screen', () => {
  it('gives the zone that runs, with its size, gates and baked obstacles', () => {
    const state = createGame(7, ISLAND_SCENARIO);
    const zone = currentZone(state);
    expect(zone.id).toBe('lande');
    expect(zone.kind).toBe('field');
    expect(zone.size).toBe(92);
    expect(zone.groundLevel).toBe(3);
    expect({ x: zone.x, z: zone.z }).toEqual({ x: 0, z: 0 });
    expect(zone.obstacles).toBe(ZONES[0]?.obstacles);
    expect(zone.obstacles.length).toBe(96);
    expect(zone.gates).toEqual([
      { id: 'lande-to-cave', x: -16, z: 72, radius: 3, to: 'lande-cave' },
      { id: 'lande-to-montclaire', x: 16, z: 72, radius: 3, to: 'montclaire' },
    ]);
    expect(zone.lots).toEqual([]);
  });

  it('gives each character its spells in data order, by ID', () => {
    const state = createGame(7, ISLAND_SCENARIO);
    for (const unit of state.bodies) {
      expect(spellsOf(state, unit.id)).toEqual(CLASSES[characterOf(state, unit.id).classId].arts.flatMap((art) => ARTS[art].spells));
    }
    expect(spellsOf(state, 999)).toEqual([]);
  });

  it('gives each card its maximum mana and the XP to the next level', () => {
    const state = createGame(7, ISLAND_SCENARIO);
    for (const unit of state.bodies) {
      const { name, classId, level, xp } = characterOf(state, unit.id);
      expect(cardOf(state, unit.id)).toEqual({ name, classId, level, xp, maxMana: CLASSES[classId].mana, xpToNext: xpToNextLevel(level) });
    }
    expect(cardOf(state, 999)).toBeNull();
  });

  it('gives a spell its cooldown in ticks and its mana cost', () => {
    expect(spellInfo('mend')).toEqual({ cooldownTicks: secondsToTicks(SPELLS.mend.cooldownSeconds), mana: SPELLS.mend.mana });
  });
});
