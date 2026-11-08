import { describe, expect, it } from 'vitest';
import { ARTS } from '../data/items';
import { BOSS } from '../data/enemies';
import { EMPTY_SCENARIO, ISLAND_SCENARIO } from '../data/scenarios';
import { FORMATION, STARTING_FAMILY } from '../data/squad';
import { botCommands } from '../src/bots';
import { characterOf, placeOf } from '../src/family';
import { triangleSlot } from '../src/formation';
import { createGame, step } from '../src/game';
import { nextRandom } from '../src/random';
import { spellsOf } from '../src/reads';
import type { CharacterStart, GameState, Scenario } from '../src/state';
import { ofType, place, run } from './helpers';

const FIGHTER: CharacterStart = { classId: 'fighter', name: 'Test Fighter' };
const HEALER: CharacterStart = { classId: 'healer', name: 'Test Healer' };

function withFamily(family: readonly CharacterStart[], scenario: Scenario = EMPTY_SCENARIO): GameState {
  return createGame(1, { ...scenario, family });
}

describe('the family (S3b decisions 1 to 3)', () => {
  it('starts as one of each class, in order, with a name each, at camp on the Lande', () => {
    const state = createGame(1, ISLAND_SCENARIO);
    expect(state.family.characters.map(({ classId }) => classId)).toEqual(['fighter', 'sniper', 'healer']);
    expect(state.family.characters.map(({ name }) => name)).toEqual(STARTING_FAMILY.map(({ name }) => name));
    expect(state.family.characters.every(({ name }) => name.length > 0)).toBe(true);
    expect(state.family.active).toEqual([1, 2, 3]);
    expect(state.bodies.map(({ id }) => id)).toEqual(state.family.active);
    expect(state.zoneId).toBe('lande');
  });

  it('keeps what lasts on the character and what is live on the body', () => {
    const state = createGame(1, ISLAND_SCENARIO);
    const [character] = state.family.characters;
    const [body] = state.bodies;
    expect(Object.keys(character ?? {}).sort()).toEqual(['arts', 'classId', 'id', 'items', 'level', 'name', 'xp']);
    expect(body).not.toHaveProperty('classId');
    expect(body).not.toHaveProperty('level');
    expect(body).toHaveProperty('health');
    expect(body).toHaveProperty('route');
  });
});

describe('a family of three Fighters (D-025)', () => {
  const state = withFamily([FIGHTER, FIGHTER, FIGHTER]);

  it('stands in three places, set by place in the three and not by class', () => {
    expect(state.bodies.map(({ id }) => placeOf(state, id))).toEqual([0, 1, 2]);
    state.bodies.forEach((body, index) => {
      const offset = FORMATION[index]?.startOffset;
      expect({ x: body.x, z: body.z }).toEqual({
        x: EMPTY_SCENARIO.squadStart.x + (offset?.x ?? NaN),
        z: EMPTY_SCENARIO.squadStart.z + (offset?.z ?? NaN),
      });
    });
    const slots = state.bodies.map(({ id }) => triangleSlot(placeOf(state, id), state.anchor, state.heading));
    expect(new Set(slots.map(({ x, z }) => `${String(x)},${String(z)}`)).size).toBe(3);
  });

  it('gives each its own row of spells, on its own cooldowns', () => {
    for (const { id } of state.bodies) {
      expect(spellsOf(state, id)).toEqual(ARTS.swordplay.spells);
    }
    const game = withFamily([FIGHTER, FIGHTER, FIGHTER]);
    const [first, second] = game.bodies;
    if (!first || !second) throw new Error('No Fighters.');
    const events = step(game, [{ type: 'cast', unitId: first.id, spell: 'guard' }]);
    expect(ofType(events, 'spell-cast')).toHaveLength(1);
    expect(first.spellTicks.guard).toBeGreaterThan(0);
    expect(second.spellTicks.guard ?? 0).toBe(0);
    const again = step(game, [{ type: 'cast', unitId: second.id, spell: 'guard' }]);
    expect(ofType(again, 'spell-cast')).toHaveLength(1);
  });

  it('walks back into the triangle after an order', () => {
    const game = withFamily([FIGHTER, FIGHTER, FIGHTER]);
    step(game, [{ type: 'move', unitIds: game.family.active, x: 0, z: 40, attack: false }]);
    run(game, 150);
    for (const body of game.bodies) {
      const slot = triangleSlot(placeOf(game, body.id), game.anchor, game.heading);
      expect(Math.hypot(body.x - slot.x, body.z - slot.z)).toBeLessThan(1);
    }
  });
});

describe('class checks as data (decision 5)', () => {
  it('lets the boss turn on whoever auto-heals, wherever it stands in the three', () => {
    // The Healer stands second here, where the starting family keeps its Sniper.
    const state = createGame(1, {
      ...EMPTY_SCENARIO,
      family: [FIGHTER, HEALER, FIGHTER],
      contents: { dummy: null, boss: { x: 0, z: 16 }, packs: [], obstacles: [] },
    });
    const boss = state.live.enemies.find((enemy) => enemy.boss);
    if (!boss?.boss) throw new Error('No boss.');
    boss.awake = true;
    for (const body of state.bodies) {
      body.attackTicks = 100000;
      body.mana = 0;
    }
    const [fighter, healer, other] = state.bodies;
    if (!healer || !fighter || !other) throw new Error('No squad.');
    place(fighter, boss.x + 9, boss.z);
    place(other, boss.x - 9, boss.z);
    place(healer, boss.x, boss.z + 20);
    // Picks the generator so the next move is a summon, then a charge.
    const pick = (wanted: number): void => {
      for (let rng = 0; rng < 1000; rng += 1) {
        if (Math.floor(nextRandom({ rng }) * 4) === wanted) {
          state.rng = rng;
          return;
        }
      }
    };
    boss.boss.phase = 'free';
    boss.strikeTicks = 1;
    pick(3);
    step(state, []);
    const minions = state.live.enemies.filter(({ minion }) => minion);
    expect(minions).toHaveLength(BOSS.summon.calmCount);
    expect(minions.every(({ preferId }) => preferId === healer.id)).toBe(true);
  });

  it('has the bots cast by the spells a character knows, not by its class', () => {
    const state = withFamily([HEALER, FIGHTER, FIGHTER], ISLAND_SCENARIO);
    const [healer, fighter] = state.bodies;
    if (!healer || !fighter) throw new Error('No squad.');
    fighter.alive = false;
    fighter.health = 0;
    state.tick = 0;
    const commands = botCommands(state, 'careful');
    expect(commands).toContainEqual({ type: 'cast', unitId: healer.id, spell: 'revive' });
    expect(characterOf(state, healer.id).classId).toBe('healer');
  });
});
