import { describe, expect, it } from 'vitest';
import { SPELLS } from '../data/spells';
import { EMPTY_SCENARIO } from '../data/scenarios';
import { CLASSES } from '../data/squad';
import { createDummy } from '../src/enemies';
import { createGame } from '../src/game';
import { applyCommands } from '../src/orders';
import type { Command, Enemy, GameState, SpellId } from '../src/state';
import {
  DUMMY_ID,
  FIGHTER,
  HEALER,
  SNIPER,
  dummyGame,
  dummyOf,
  ofType,
  place,
  run,
  sendAway,
  unitOf,
} from './helpers';

function cast(unitId: number, spell: SpellId, extra: Partial<Command> = {}): Command {
  return { type: 'cast', unitId, spell, ...extra } as Command;
}

function refusal(state: GameState, command: Command): string | undefined {
  return ofType(applyCommands(state, [command]), 'order-refused')[0]?.reason;
}

function nearDummy(unitId: number, distance = 2): GameState {
  const state = dummyGame();
  sendAway(state);
  const dummy = dummyOf(state);
  place(unitOf(state, unitId), dummy.x + distance, dummy.z);
  return state;
}

describe('all nine spells', () => {
  it('are shared out three to a class, each with its own data', () => {
    const spells = Object.values(CLASSES).flatMap((data) => data.spells);
    expect(spells).toHaveLength(9);
    expect(new Set(spells).size).toBe(9);
    expect(Object.keys(SPELLS).sort()).toEqual([...spells].sort());
  });
});

describe('Taunt', () => {
  it('sets its timer on enemies in range only', () => {
    const state = nearDummy(FIGHTER);
    const dummy = dummyOf(state);
    const far = createDummy(state, { x: dummy.x + 40, z: dummy.z });
    state.enemies.push(far);
    applyCommands(state, [cast(FIGHTER, 'taunt')]);
    expect(dummy.tauntTicks).toBe(150);
    expect(far.tauntTicks).toBe(0);
  });
});

describe('Cleave', () => {
  it('hits around the Fighter at 2.3 times, and sets knockback away from it', () => {
    const state = nearDummy(FIGHTER);
    const dummy = dummyOf(state);
    const events = applyCommands(state, [cast(FIGHTER, 'cleave')]);
    const [hit] = ofType(events, 'hit');
    expect(hit?.amount).toBeGreaterThanOrEqual(294);
    expect(dummy.health).toBe(dummy.maxHealth - (hit?.amount ?? 0));
    expect(dummy.knockX).toBeCloseTo(-26, 6);
    expect(dummy.knockZ).toBeCloseTo(0, 6);
  });

  it('misses an enemy out of reach but still spends the cooldown', () => {
    const state = nearDummy(FIGHTER, 30);
    const events = applyCommands(state, [cast(FIGHTER, 'cleave')]);
    expect(ofType(events, 'hit')).toEqual([]);
    expect(unitOf(state, FIGHTER).spellTicks.cleave).toBe(150);
  });
});

describe('Guard', () => {
  it('sets its timer on the Fighter', () => {
    const state = dummyGame();
    applyCommands(state, [cast(FIGHTER, 'guard')]);
    expect(unitOf(state, FIGHTER).guardTicks).toBe(120);
  });
});

describe('Aimed Shot', () => {
  it('fires a homing shot at 4.2 times', () => {
    const state = nearDummy(SNIPER, 20);
    const dummy = dummyOf(state);
    applyCommands(state, [cast(SNIPER, 'aimed-shot', { enemyId: DUMMY_ID })]);
    expect(state.shots).toHaveLength(1);
    const [shot] = state.shots;
    expect(shot?.multiplier).toBe(4.2);
    expect(dummy.health).toBe(dummy.maxHealth);
    // Worked by hand: 76 × 1.14 × 1.6 × 4.2 × 1.5 × 0.905. Its auto-attack lands as well.
    const hits = ofType(run(state, 10), 'hit');
    expect(hits).toHaveLength(2);
    expect(Math.max(...hits.map(({ amount }) => amount))).toBeGreaterThanOrEqual(790);
    expect(state.shots).toEqual([]);
  });
});

describe('Crippling Shot', () => {
  it('sets the slow when it lands, not when it is fired', () => {
    const state = nearDummy(SNIPER, 20);
    const dummy = dummyOf(state);
    applyCommands(state, [cast(SNIPER, 'crippling-shot', { enemyId: DUMMY_ID })]);
    expect(dummy.slowTicks).toBe(0);
    run(state, 10);
    expect(dummy.slowTicks).toBeGreaterThan(110);
    expect(dummy.slowTicks).toBeLessThanOrEqual(120);
  });
});

describe('Volley', () => {
  it('schedules three strikes as records in state, and lands them on time', () => {
    const state = nearDummy(SNIPER, 20);
    const dummy = dummyOf(state);
    const point = { x: dummy.x, z: dummy.z };
    applyCommands(state, [cast(SNIPER, 'volley', { point })]);
    expect(state.scheduled.map(({ ticks }) => ticks)).toEqual([5, 14, 23]);
    expect(JSON.parse(JSON.stringify(state.scheduled))).toEqual(state.scheduled);
    const hits = ofType(run(state, 23), 'hit').filter(({ sourceId }) => sourceId === SNIPER);
    const volleyHits = hits.filter(({ tick }) => [4, 13, 22].includes(tick));
    expect(volleyHits).toHaveLength(3);
    expect(state.scheduled).toEqual([]);
  });

  it('lands on the caster with no point', () => {
    const state = dummyGame();
    const unit = unitOf(state, SNIPER);
    applyCommands(state, [cast(SNIPER, 'volley')]);
    expect(state.scheduled[0]).toMatchObject({ x: unit.x, z: unit.z });
  });

  it('strikes where it was aimed, even if the caster walks off', () => {
    const state = nearDummy(SNIPER, 20);
    const dummy = dummyOf(state);
    applyCommands(state, [cast(SNIPER, 'volley', { point: { x: dummy.x + 60, z: dummy.z } })]);
    expect(ofType(run(state, 30), 'hit').filter(({ tick }) => tick === 4)).toEqual([]);
  });
});

describe('aiming single-target shots', () => {
  const setup = () => {
    const state = nearDummy(SNIPER, 20);
    const add = (x: number, z: number): Enemy => {
      const enemy = createDummy(state, { x, z });
      state.enemies.push(enemy);
      return enemy;
    };
    return { state, nearest: dummyOf(state), add };
  };
  const aimedAt = (state: GameState): number | undefined => state.shots[0]?.enemyId;

  it('uses the enemy named first', () => {
    const { state, add } = setup();
    const named = add(40, 40);
    applyCommands(state, [
      cast(SNIPER, 'aimed-shot', { enemyId: named.id, point: { x: 0, z: 30 } }),
    ]);
    expect(aimedAt(state)).toBe(named.id);
  });

  it('then the nearest within 12 of the point', () => {
    const { state, add } = setup();
    const near = add(40, 40);
    state.sharedTargetId = DUMMY_ID;
    applyCommands(state, [cast(SNIPER, 'aimed-shot', { point: { x: 48, z: 40 } })]);
    expect(aimedAt(state)).toBe(near.id);
  });

  it('then the shared target, when nothing is near the point', () => {
    const { state, add } = setup();
    const shared = add(40, 40);
    state.sharedTargetId = shared.id;
    applyCommands(state, [cast(SNIPER, 'aimed-shot', { point: { x: -60, z: 40 } })]);
    expect(aimedAt(state)).toBe(shared.id);
  });

  it("then the unit's own target", () => {
    const { state, add } = setup();
    const own = add(40, 40);
    unitOf(state, SNIPER).targetId = own.id;
    applyCommands(state, [cast(SNIPER, 'aimed-shot')]);
    expect(aimedAt(state)).toBe(own.id);
  });

  it('then the nearest enemy in range', () => {
    const { state, nearest, add } = setup();
    add(-40, -40);
    applyCommands(state, [cast(SNIPER, 'aimed-shot')]);
    expect(aimedAt(state)).toBe(nearest.id);
  });

  it('falls past a named enemy that is down', () => {
    const { state, nearest, add } = setup();
    const gone = add(40, 40);
    gone.alive = false;
    applyCommands(state, [cast(SNIPER, 'aimed-shot', { enemyId: gone.id })]);
    expect(aimedAt(state)).toBe(nearest.id);
  });

  it('is refused with nothing in range', () => {
    const state = createGame(1, EMPTY_SCENARIO);
    expect(refusal(state, cast(SNIPER, 'aimed-shot'))).toBe('no-target');
    expect(unitOf(state, SNIPER).spellTicks['aimed-shot'] ?? 0).toBe(0);
  });
});

describe('Mend', () => {
  it('heals half of maximum health plus twice the attack', () => {
    const state = dummyGame();
    const fighter = unitOf(state, FIGHTER);
    fighter.health = 100;
    applyCommands(state, [cast(HEALER, 'mend')]);
    expect(fighter.health).toBeCloseTo(100 + 1020 + 34 * 1.14 * 2, 6);
    expect(unitOf(state, HEALER).mana).toBe(350);
  });

  it('uses the wounded ally nearest the point, then the lowest', () => {
    const state = dummyGame();
    const fighter = unitOf(state, FIGHTER);
    const sniper = unitOf(state, SNIPER);
    fighter.health = 1900;
    sniper.health = 100;
    applyCommands(state, [cast(HEALER, 'mend', { point: { x: fighter.x, z: fighter.z } })]);
    expect(fighter.health).toBe(fighter.maxHealth);
    expect(sniper.health).toBe(100);
    run(state, 106);
    applyCommands(state, [cast(HEALER, 'mend', { point: { x: -80, z: 0 } })]);
    expect(sniper.health).toBeGreaterThan(100);
  });

  it('is refused when nobody is hurt, with nothing spent', () => {
    const state = dummyGame();
    expect(refusal(state, cast(HEALER, 'mend'))).toBe('nobody-hurt');
    expect(unitOf(state, HEALER).mana).toBe(400);
    expect(unitOf(state, HEALER).spellTicks.mend ?? 0).toBe(0);
  });
});

describe('Rally', () => {
  it('sets its timer on the living only', () => {
    const state = dummyGame();
    unitOf(state, SNIPER).alive = false;
    applyCommands(state, [cast(HEALER, 'rally')]);
    expect(state.units.map((unit) => unit.rallyTicks)).toEqual([240, 0, 240]);
  });
});

describe('Revive', () => {
  it('raises the nearest fallen ally at half health, invulnerable, at any distance', () => {
    const state = dummyGame();
    const healer = unitOf(state, HEALER);
    const fighter = unitOf(state, FIGHTER);
    const sniper = unitOf(state, SNIPER);
    place(healer, 50, 0);
    place(fighter, 40, 0);
    place(sniper, -60, 0);
    fighter.alive = false;
    fighter.health = 0;
    sniper.alive = false;
    sniper.health = 0;
    const events = applyCommands(state, [cast(HEALER, 'revive')]);
    expect(fighter.alive).toBe(true);
    expect(fighter.health).toBe(fighter.maxHealth / 2);
    expect(fighter.invulnerableTicks).toBe(45);
    expect(sniper.alive).toBe(false);
    expect(ofType(events, 'unit-revived')).toEqual([
      { type: 'unit-revived', tick: 0, unitId: FIGHTER },
    ]);
    expect(healer.mana).toBe(300);
  });

  it('is refused with nobody down', () => {
    const state = dummyGame();
    expect(refusal(state, cast(HEALER, 'revive'))).toBe('no-target');
    expect(unitOf(state, HEALER).mana).toBe(400);
  });
});

describe('casting', () => {
  it('raises spell-cast before what the spell does', () => {
    const state = nearDummy(FIGHTER);
    const types = applyCommands(state, [cast(FIGHTER, 'cleave')]).map(({ type }) => type);
    expect(types.slice(0, 3)).toEqual(['order-accepted', 'spell-cast', 'hit']);
  });

  it('starts the cooldown, which runs out on time', () => {
    const state = dummyGame();
    applyCommands(state, [cast(FIGHTER, 'guard')]);
    expect(refusal(state, cast(FIGHTER, 'guard'))).toBe('on-cooldown');
    run(state, 389);
    expect(refusal(state, cast(FIGHTER, 'guard'))).toBe('on-cooldown');
    run(state, 1);
    expect(refusal(state, cast(FIGHTER, 'guard'))).toBeUndefined();
  });

  it('is refused without the mana', () => {
    const state = dummyGame();
    unitOf(state, HEALER).mana = 49;
    expect(refusal(state, cast(HEALER, 'rally'))).toBe('no-mana');
  });

  it('is refused when the caster is down', () => {
    const state = dummyGame();
    unitOf(state, FIGHTER).alive = false;
    expect(refusal(state, cast(FIGHTER, 'guard'))).toBe('caster-down');
  });

  it("is refused for another class's spell", () => {
    expect(refusal(dummyGame(), cast(FIGHTER, 'mend'))).toBe('not-your-spell');
  });

  it('is refused for an unknown unit or a broken point', () => {
    expect(refusal(dummyGame(), cast(99, 'guard'))).toBe('unknown-unit');
    const point = { x: Number.NaN, z: 0 };
    expect(refusal(dummyGame(), cast(SNIPER, 'volley', { point }))).toBe('bad-point');
  });

  it('mana comes back at 10 a second, up to the maximum', () => {
    const state = dummyGame();
    const healer = unitOf(state, HEALER);
    healer.mana = 100;
    run(state, 30);
    expect(healer.mana).toBeCloseTo(110, 6);
    healer.mana = 399.9;
    run(state, 30);
    expect(healer.mana).toBe(400);
  });

  it('Fighter and Sniper have no mana to spend', () => {
    const state = dummyGame();
    run(state, 30);
    expect(unitOf(state, FIGHTER).mana).toBe(0);
    expect(unitOf(state, SNIPER).mana).toBe(0);
  });
});
