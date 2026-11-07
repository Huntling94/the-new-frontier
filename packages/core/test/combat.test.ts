import { describe, expect, it } from 'vitest';
import { DUMMY } from '../data/enemies';
import { EMPTY_SCENARIO } from '../data/scenarios';
import {
  accuracyMultiplier,
  damageToEnemy,
  damageToUnit,
  defenceMultiplier,
  hitEnemy,
  hurtUnit,
  shareXp,
} from '../src/combat';
import { applyCommands } from '../src/orders';
import { createGame, step } from '../src/game';
import { hashState } from '../src/hash';
import { recalculate, xpToNextLevel } from '../src/stats';
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

/**
 * Worked by hand from the squad test's formula. A level 3 Fighter has attack
 * 62 × 1.14 = 70.68, and AR 4 against the dummy's DR 3 gives 1.25. Def 19 gives
 * 0.905. So 70.68 × 1.6 × 1.25 × 0.905 = 127.93.
 */
describe('damage to an enemy', () => {
  const setup = () => {
    const state = dummyGame();
    return { state, unit: unitOf(state, FIGHTER), enemy: dummyOf(state) };
  };

  it('carries the attack modifier, AR against DR, and Def', () => {
    const { unit, enemy } = setup();
    expect(damageToEnemy(unit, enemy, 1, false)).toBe(128);
  });

  it("carries the spell's multiplier", () => {
    const { unit, enemy } = setup();
    expect(damageToEnemy(unit, enemy, 2.3, false)).toBe(294);
  });

  it('doubles on a crit', () => {
    const { unit, enemy } = setup();
    expect(damageToEnemy(unit, enemy, 1, true)).toBe(256);
  });

  it('adds 30% under Rally', () => {
    const { unit, enemy } = setup();
    unit.rallyTicks = 1;
    expect(damageToEnemy(unit, enemy, 1, false)).toBe(166);
  });

  it('adds 50% against a staggered enemy', () => {
    const { unit, enemy } = setup();
    enemy.staggerTicks = 1;
    expect(damageToEnemy(unit, enemy, 1, false)).toBe(192);
  });

  it('multiplies every term together', () => {
    const { unit, enemy } = setup();
    unit.rallyTicks = 1;
    enemy.staggerTicks = 1;
    expect(damageToEnemy(unit, enemy, 2.3, true)).toBe(1148);
  });

  it('is at least 1', () => {
    const { unit, enemy } = setup();
    unit.attack = 0;
    expect(damageToEnemy(unit, enemy, 1, false)).toBe(1);
  });
});

/**
 * A Fighter has DR 5 and Def 86, so the dummy's AR 3 gives 0.8 and Def gives
 * 0.57. So 89 × 0.8 × 0.57 = 40.58.
 */
describe('damage to a unit', () => {
  it('carries AR against DR, and Def', () => {
    const unit = unitOf(dummyGame(), FIGHTER);
    expect(damageToUnit(unit, DUMMY.attack, DUMMY.ar)).toBe(41);
  });

  it('takes 70% off under Guard', () => {
    const unit = unitOf(dummyGame(), FIGHTER);
    unit.guardTicks = 1;
    expect(damageToUnit(unit, DUMMY.attack, DUMMY.ar)).toBe(12);
  });

  it('is at least 1', () => {
    const unit = unitOf(dummyGame(), FIGHTER);
    expect(damageToUnit(unit, 0, DUMMY.ar)).toBe(1);
  });

  it('skips a unit that is invulnerable, and leaves one briefly so after a hit', () => {
    const state = dummyGame();
    const unit = unitOf(state, FIGHTER);
    const enemy = dummyOf(state);
    const events: ReturnType<typeof run> = [];
    unit.invulnerableTicks = 1;
    hurtUnit(state, unit, 100, enemy, events);
    expect(unit.health).toBe(unit.maxHealth);
    unit.invulnerableTicks = 0;
    hurtUnit(state, unit, 100, enemy, events);
    expect(unit.health).toBeLessThan(unit.maxHealth);
    expect(unit.invulnerableTicks).toBe(6);
    expect(ofType(events, 'hit')).toHaveLength(1);
  });
});

describe('ge.c bugs that must not come back', () => {
  it('more accuracy never reduces damage', () => {
    for (let dr = 0; dr <= 30; dr += 1) {
      for (let ar = -30; ar < 60; ar += 1) {
        expect(accuracyMultiplier(ar + 1, dr)).toBeGreaterThanOrEqual(accuracyMultiplier(ar, dr));
      }
    }
  });

  it('very low accuracy never gives negative damage', () => {
    expect(accuracyMultiplier(-1000, 1000)).toBeGreaterThan(0);
    const state = dummyGame();
    const unit = unitOf(state, FIGHTER);
    unit.ar = -1000;
    expect(damageToEnemy(unit, dummyOf(state), 1, false)).toBeGreaterThan(0);
    expect(damageToUnit(unit, DUMMY.attack, -1000)).toBeGreaterThan(0);
  });
});

describe('the maths behind them', () => {
  it('AR against DR follows the squad test', () => {
    expect(accuracyMultiplier(5, 5)).toBe(1);
    expect(accuracyMultiplier(7, 5)).toBe(1.5);
    expect(accuracyMultiplier(50, 5)).toBe(3);
    expect(accuracyMultiplier(3, 5)).toBe(0.8);
    expect(accuracyMultiplier(0, 50)).toBe(0.1);
  });

  it('Def is capped', () => {
    expect(defenceMultiplier(0)).toBe(1);
    expect(defenceMultiplier(100)).toBe(0.5);
    expect(defenceMultiplier(100000)).toBe(0.25);
  });

  it('starting stats follow the squad test', () => {
    const state = dummyGame();
    const fighter = unitOf(state, FIGHTER);
    expect(fighter.level).toBe(3);
    expect(fighter.maxHealth).toBe(2040);
    expect(fighter.health).toBe(2040);
    expect(fighter.attack).toBeCloseTo(70.68, 8);
    expect(fighter.defence).toBe(86);
    expect(fighter.dr).toBe(5);
    expect(unitOf(state, SNIPER).maxHealth).toBe(1140);
    expect(unitOf(state, HEALER).mana).toBe(400);
    expect(state.marks).toBe(450);
    expect(state.potions).toBe(6);
  });

  it('has twelve gear slots, four per character', () => {
    const state = dummyGame();
    const slots = state.units.flatMap((unit) => Object.keys(unit.gear));
    expect(slots).toHaveLength(12);
  });

  it('rolls crits from the seeded generator', () => {
    const crits = (seed: number) => {
      const state = dummyGame(seed);
      const events: ReturnType<typeof run> = [];
      for (let hit = 0; hit < 200; hit += 1) {
        hitEnemy(state, unitOf(state, SNIPER), dummyOf(state), 1, events);
      }
      return ofType(events, 'hit').filter(({ crit }) => crit).length;
    };
    expect(crits(1)).toBe(crits(1));
    // The Sniper crits 12% of the time.
    expect(crits(1)).toBeGreaterThan(10);
    expect(crits(1)).toBeLessThan(45);
  });
});

describe('XP and levels (D-004)', () => {
  it('splits equally among the living', () => {
    const state = dummyGame();
    shareXp(state, 300, []);
    expect(state.units.map((unit) => unit.xp)).toEqual([100, 100, 100]);
  });

  it('gives nothing to the dead, and more to the rest', () => {
    const state = dummyGame();
    unitOf(state, SNIPER).alive = false;
    shareXp(state, 300, []);
    expect(state.units.map((unit) => unit.xp)).toEqual([150, 0, 150]);
  });

  it('a kill shares the dummy\'s XP', () => {
    const state = dummyGame();
    sendAway(state);
    const dummy = dummyOf(state);
    dummy.health = 1;
    const events: ReturnType<typeof run> = [];
    hitEnemy(state, unitOf(state, FIGHTER), dummy, 1, events);
    expect(ofType(events, 'enemy-down')).toHaveLength(1);
    expect(unitOf(state, HEALER).xp).toBe(Math.round(DUMMY.xp / 3));
  });

  it('levels up, restores health and raises stats', () => {
    const state = dummyGame();
    const unit = unitOf(state, FIGHTER);
    unit.health = 100;
    const { attack, maxHealth } = unit;
    const events: ReturnType<typeof run> = [];
    shareXp(state, xpToNextLevel(3) * 3, events);
    expect(unit.level).toBe(4);
    expect(unit.xp).toBe(0);
    expect(unit.health).toBe(unit.maxHealth);
    expect(unit.maxHealth).toBeGreaterThan(maxHealth);
    expect(unit.attack).toBeGreaterThan(attack);
    expect(unit.ar).toBe(5);
    expect(ofType(events, 'level-up')).toHaveLength(3);
  });

  it('can rise more than one level at once', () => {
    const state = dummyGame();
    shareXp(state, (xpToNextLevel(3) + xpToNextLevel(4)) * 3, []);
    expect(unitOf(state, FIGHTER).level).toBe(5);
  });

  it('keeps a wounded unit wounded by the same amount when its maximum changes', () => {
    const unit = unitOf(dummyGame(), FIGHTER);
    unit.health -= 500;
    unit.level = 4;
    recalculate(unit);
    expect(unit.maxHealth - unit.health).toBe(500);
  });
});

describe('the training dummy', () => {
  it('has no place in the empty scenario', () => {
    expect(createGame(1, EMPTY_SCENARIO).enemies).toEqual([]);
  });

  it('stands still, hostile from the start, away from camp', () => {
    const state = dummyGame();
    const dummy = dummyOf(state);
    expect(dummy.id).toBe(DUMMY_ID);
    const { x, z } = dummy;
    expect(Math.hypot(x - state.anchor.x, z - state.anchor.z)).toBeGreaterThan(30);
    run(state, 120);
    expect([dummy.x, dummy.z]).toEqual([x, z]);
  });

  it('strikes the nearest living unit in reach, on a timer', () => {
    const state = dummyGame();
    sendAway(state);
    const dummy = dummyOf(state);
    const fighter = unitOf(state, FIGHTER);
    const sniper = unitOf(state, SNIPER);
    place(fighter, dummy.x + 4, dummy.z);
    place(sniper, dummy.x + 2, dummy.z);
    const hits = ofType(run(state, 90), 'hit').filter(({ sourceId }) => sourceId === DUMMY_ID);
    expect(hits.map(({ targetId }) => targetId)).toEqual([SNIPER, SNIPER, SNIPER]);
    expect(hits.map(({ tick }) => tick)).toEqual([29, 59, 89]);
  });

  it('picks by distance, not by ID', () => {
    const state = dummyGame();
    sendAway(state);
    const dummy = dummyOf(state);
    place(unitOf(state, FIGHTER), dummy.x + 2, dummy.z);
    place(unitOf(state, SNIPER), dummy.x + 4, dummy.z);
    const hits = ofType(run(state, 30), 'hit').filter(({ sourceId }) => sourceId === DUMMY_ID);
    expect(hits.map(({ targetId }) => targetId)).toEqual([FIGHTER]);
  });

  it('leaves alone anyone out of reach', () => {
    const state = dummyGame();
    sendAway(state);
    const dummy = dummyOf(state);
    place(unitOf(state, SNIPER), dummy.x + DUMMY.reach + 1, dummy.z);
    run(state, 90);
    expect(unitOf(state, SNIPER).health).toBe(unitOf(state, SNIPER).maxHealth);
  });

  it('reaches a Fighter standing at the edge of melee range', () => {
    const state = dummyGame();
    step(state, [{ type: 'target', unitIds: [FIGHTER], enemyId: DUMMY_ID }]);
    const hits = ofType(run(state, 300), 'hit');
    expect(hits.some(({ targetId }) => targetId === FIGHTER)).toBe(true);
    expect(hits.some(({ sourceId }) => sourceId === FIGHTER)).toBe(true);
  });

  it('dies, respawns after its delay, and clears the shared target', () => {
    const state = dummyGame();
    sendAway(state);
    applyCommands(state, [{ type: 'target', unitIds: [FIGHTER], enemyId: DUMMY_ID }]);
    place(unitOf(state, FIGHTER), -60, 0);
    const dummy = dummyOf(state);
    dummy.health = 1;
    hitEnemy(state, unitOf(state, FIGHTER), dummy, 1, []);
    expect(dummy.alive).toBe(false);
    expect(state.sharedTargetId).toBeNull();
    run(state, DUMMY.respawnSeconds * 30 - 1);
    expect(dummy.alive).toBe(false);
    run(state, 1);
    expect(dummy.alive).toBe(true);
    expect(dummy.health).toBe(dummy.maxHealth);
  });
});

describe('going down', () => {
  it('raises unit-down, and a downed unit stops', () => {
    const state = dummyGame();
    const unit = unitOf(state, FIGHTER);
    const events: ReturnType<typeof run> = [];
    unit.health = 1;
    hurtUnit(state, unit, 1000, dummyOf(state), events);
    expect(unit.alive).toBe(false);
    expect(unit.health).toBe(0);
    expect(ofType(events, 'unit-down')).toEqual([{ type: 'unit-down', tick: 0, unitId: FIGHTER }]);
    expect(ofType(events, 'squad-down')).toEqual([]);
    const { x, z } = unit;
    run(state, 30);
    expect([unit.x, unit.z]).toEqual([x, z]);
  });

  it('all three down raises squad-down once, and only the clocks move until the return', () => {
    const state = dummyGame();
    sendAway(state);
    const dummy = dummyOf(state);
    for (const unit of state.units) {
      place(unit, dummy.x + 2, dummy.z);
      unit.health = 1;
    }
    // Keeps the Healer busy, so that it heals nobody out of this.
    unitOf(state, HEALER).attackTicks = 1000;
    const events = run(state, 150);
    expect(ofType(events, 'unit-down')).toHaveLength(3);
    expect(ofType(events, 'squad-down')).toHaveLength(1);
    expect(state.squadDown).toBe(true);

    state.wipeTicks = 1000;
    const before = state.tick;
    const hash = hashState({ ...state, tick: 0, wipeTicks: 0 });
    const after = [
      ...step(state, [{ type: 'regroup' }]),
      ...step(state, [{ type: 'potion' }]),
      ...step(state, [{ type: 'cast', unitId: HEALER, spell: 'revive' }]),
      ...run(state, 30),
    ];
    expect(state.tick).toBe(before + 33);
    expect(hashState({ ...state, tick: 0, wipeTicks: 0 })).toBe(hash);
    expect(ofType(after, 'order-refused').map(({ reason }) => reason)).toEqual([
      'no-living-units',
      'no-living-units',
      'no-living-units',
    ]);
    expect(after).toHaveLength(3);
  });
});

describe('potions', () => {
  it('heals 40% of maximum health, from a shared stock', () => {
    const state = dummyGame();
    const unit = unitOf(state, FIGHTER);
    unit.health = 100;
    const events = applyCommands(state, [{ type: 'potion', unitId: FIGHTER }]);
    expect(unit.health).toBe(100 + 2040 * 0.4);
    expect(state.potions).toBe(5);
    expect(ofType(events, 'healed')).toHaveLength(1);
  });

  it('finds whoever is lowest when no unit is named', () => {
    const state = dummyGame();
    unitOf(state, FIGHTER).health = 1000;
    unitOf(state, HEALER).health = 100;
    applyCommands(state, [{ type: 'potion' }]);
    expect(unitOf(state, HEALER).health).toBeGreaterThan(100);
    expect(unitOf(state, FIGHTER).health).toBe(1000);
  });

  it('never heals past the maximum', () => {
    const state = dummyGame();
    const unit = unitOf(state, FIGHTER);
    unit.health = unit.maxHealth - 1;
    applyCommands(state, [{ type: 'potion' }]);
    expect(unit.health).toBe(unit.maxHealth);
  });

  it('has a cooldown of 1.5 seconds', () => {
    const state = dummyGame();
    unitOf(state, FIGHTER).health = 100;
    const refused = applyCommands(state, [{ type: 'potion' }, { type: 'potion' }]);
    expect(ofType(refused, 'order-refused').map(({ reason }) => reason)).toEqual(['on-cooldown']);
    run(state, 44);
    const stillWaiting = applyCommands(state, [{ type: 'potion' }]);
    expect(ofType(stillWaiting, 'order-refused')).toHaveLength(1);
    run(state, 1);
    expect(ofType(applyCommands(state, [{ type: 'potion' }]), 'order-accepted')).toHaveLength(1);
  });

  it.each([
    ['no potions are left', 'no-potions', { potions: 0 }],
    ['nobody is hurt', 'nobody-hurt', {}],
  ] as const)('is refused when %s', (_name, reason, change) => {
    const state = Object.assign(dummyGame(), change);
    if ('potions' in change) unitOf(state, FIGHTER).health = 100;
    const events = applyCommands(state, [{ type: 'potion' }]);
    expect(ofType(events, 'order-refused').map((event) => event.reason)).toEqual([reason]);
  });

  it('is refused for a named unit that is down or unknown', () => {
    const state = dummyGame();
    unitOf(state, SNIPER).alive = false;
    const events = applyCommands(state, [
      { type: 'potion', unitId: SNIPER },
      { type: 'potion', unitId: 99 },
    ]);
    expect(ofType(events, 'order-refused').map(({ reason }) => reason)).toEqual([
      'no-living-units',
      'unknown-unit',
    ]);
    expect(state.potions).toBe(6);
  });
});
