import { describe, expect, it } from 'vitest';
import { AUTO_HEAL } from '../data/combat';
import { step } from '../src/game';
import { hashState } from '../src/hash';
import { applyCommands } from '../src/orders';
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

function hitsBy(events: Parameters<typeof ofType>[0], unitId: number) {
  return ofType(events, 'hit').filter(({ sourceId }) => sourceId === unitId);
}

describe('auto-attacks', () => {
  it('the Fighter hits an enemy in melee range, on its timer, with no shot', () => {
    const state = dummyGame();
    sendAway(state);
    const dummy = dummyOf(state);
    place(unitOf(state, FIGHTER), dummy.x + 3, dummy.z);
    const events = run(state, 60);
    expect(hitsBy(events, FIGHTER).map(({ tick }) => tick)).toEqual([0, 26, 52]);
    expect(state.live.shots).toEqual([]);
    expect(dummy.knockX).toBeLessThan(0);
  });

  it('the Sniper fires homing shots that travel', () => {
    const state = dummyGame();
    sendAway(state);
    const dummy = dummyOf(state);
    place(unitOf(state, SNIPER), dummy.x + 20, dummy.z);
    const first = run(state, 1);
    expect(hitsBy(first, SNIPER)).toEqual([]);
    expect(state.live.shots).toHaveLength(1);
    const [shot] = state.live.shots;
    expect(shot?.x).toBeCloseTo(dummy.x + 17, 6);
    expect(hitsBy(run(state, 6), SNIPER)).toHaveLength(1);
  });

  it('a shot whose target has gone disappears', () => {
    const state = dummyGame();
    sendAway(state);
    const dummy = dummyOf(state);
    place(unitOf(state, SNIPER), dummy.x + 20, dummy.z);
    run(state, 1);
    dummy.alive = false;
    dummy.respawnTicks = 100;
    const events = run(state, 3);
    expect(hitsBy(events, SNIPER)).toEqual([]);
    expect(state.live.shots).toEqual([]);
  });

  it('a shot runs out of time rather than flying for ever', () => {
    const state = dummyGame();
    sendAway(state);
    const sniper = unitOf(state, SNIPER);
    const dummy = dummyOf(state);
    state.live.shots.push({
      x: dummy.x + 500,
      z: dummy.z,
      unitId: sniper.id,
      enemyId: dummy.id,
      multiplier: 1,
      crippling: false,
      ticks: 36,
    });
    run(state, 35);
    expect(state.live.shots).toHaveLength(1);
    run(state, 1);
    expect(state.live.shots).toEqual([]);
  });

  it('a unit attacks nothing beyond its aggro range', () => {
    const state = dummyGame();
    sendAway(state);
    const dummy = dummyOf(state);
    place(unitOf(state, FIGHTER), dummy.x + 18, dummy.z);
    expect(hitsBy(run(state, 60), FIGHTER)).toEqual([]);
  });

  it('a unit sent alone on attack-move closes on the enemy it finds', () => {
    const state = dummyGame();
    sendAway(state);
    const dummy = dummyOf(state);
    const fighter = unitOf(state, FIGHTER);
    place(fighter, dummy.x, dummy.z + 20);
    step(state, [{ type: 'move', unitIds: [FIGHTER], x: dummy.x, z: dummy.z, attack: true }]);
    expect(fighter.hold).toBe(true);
    expect(hitsBy(run(state, 120), FIGHTER).length).toBeGreaterThan(0);
  });

  it('a unit stops attacking once its enemy is down', () => {
    const state = dummyGame();
    sendAway(state);
    const dummy = dummyOf(state);
    place(unitOf(state, FIGHTER), dummy.x + 3, dummy.z);
    dummy.health = 1;
    run(state, 2);
    expect(dummy.alive).toBe(false);
    expect(hitsBy(run(state, 60), FIGHTER)).toEqual([]);
  });
});

describe('the Healer (D-008)', () => {
  it('heals whoever is lowest, one at a time, on a timer, for mana', () => {
    const state = dummyGame();
    sendAway(state);
    const healer = unitOf(state, HEALER);
    const fighter = unitOf(state, FIGHTER);
    const sniper = unitOf(state, SNIPER);
    place(healer, -40, 0);
    place(fighter, -50, 0);
    place(sniper, -30, 0);
    fighter.health = 1000;
    sniper.health = 200;
    const events = run(state, 34);
    const heals = ofType(events, 'healed');
    expect(heals.map(({ unitId }) => unitId)).toEqual([SNIPER, SNIPER]);
    expect(heals.map(({ tick }) => tick)).toEqual([0, 33]);
    expect(heals[0]?.amount).toBeCloseTo(1140 * 0.09 + 34 * 1.14 * 2, 6);
    expect(healer.mana).toBeCloseTo(400 - AUTO_HEAL.manaCost * 2 + 33 / 3, 6);
  });

  it('leaves alone anyone above 85% or out of range', () => {
    const state = dummyGame();
    sendAway(state);
    place(unitOf(state, HEALER), -40, 0);
    const fighter = unitOf(state, FIGHTER);
    const sniper = unitOf(state, SNIPER);
    place(fighter, -50, 0);
    place(sniper, 0, 0);
    fighter.health = fighter.maxHealth * 0.86;
    sniper.health = 100;
    expect(ofType(run(state, 30), 'healed')).toEqual([]);
  });

  it('stops when out of mana', () => {
    const state = dummyGame();
    sendAway(state);
    const healer = unitOf(state, HEALER);
    healer.mana = 13;
    place(healer, -60, 8);
    unitOf(state, FIGHTER).health = 100;
    expect(ofType(step(state, []), 'healed')).toEqual([]);
  });

  it('does no damage', () => {
    const state = dummyGame();
    sendAway(state);
    const dummy = dummyOf(state);
    place(unitOf(state, HEALER), dummy.x + 3, dummy.z);
    step(state, [{ type: 'target', unitIds: [HEALER], enemyId: DUMMY_ID }]);
    expect(hitsBy(run(state, 120), HEALER)).toEqual([]);
    expect(state.live.shots).toEqual([]);
  });

  it('walks back towards the others when an enemy is about', () => {
    const state = dummyGame();
    sendAway(state);
    const dummy = dummyOf(state);
    const healer = unitOf(state, HEALER);
    const fighter = unitOf(state, FIGHTER);
    const sniper = unitOf(state, SNIPER);
    place(fighter, dummy.x + 3, dummy.z);
    place(sniper, dummy.x - 3, dummy.z);
    place(healer, dummy.x, dummy.z + 20);
    healer.hold = false;
    const before = Math.hypot(healer.x - dummy.x, healer.z - dummy.z);
    run(state, 15);
    expect(Math.hypot(healer.x - dummy.x, healer.z - dummy.z)).toBeLessThan(before);
  });

  it('stays put when it is the last one standing, near an enemy', () => {
    const state = dummyGame();
    sendAway(state);
    const dummy = dummyOf(state);
    const healer = unitOf(state, HEALER);
    place(healer, dummy.x + 15, dummy.z);
    healer.hold = false;
    unitOf(state, FIGHTER).alive = false;
    unitOf(state, SNIPER).alive = false;
    run(state, 30);
    expect(Number.isFinite(healer.x)).toBe(true);
    expect(healer.x).toBeCloseTo(dummy.x + 15, 6);
    expect(() => hashState(state)).not.toThrow();
  });
});

describe('attack-move', () => {
  it('stops to fight what it meets, while a plain move walks on', () => {
    const attackMove = (attack: boolean) => {
      const state = dummyGame();
      sendAway(state);
      const dummy = dummyOf(state);
      const fighter = unitOf(state, FIGHTER);
      place(fighter, dummy.x + 30, dummy.z);
      place(unitOf(state, SNIPER), dummy.x + 34, dummy.z - 4);
      place(unitOf(state, HEALER), dummy.x + 34, dummy.z + 4);
      const unitIds = [FIGHTER, SNIPER, HEALER];
      const order = { type: 'move', unitIds, x: dummy.x - 30, z: dummy.z, attack } as const;
      const events = [...step(state, [order]), ...run(state, 180)];
      return { fighter, dummy, hits: hitsBy(events, FIGHTER) };
    };

    const fought = attackMove(true);
    expect(fought.hits.length).toBeGreaterThan(0);
    expect(fought.fighter.x).toBeGreaterThan(fought.dummy.x);

    const walked = attackMove(false);
    expect(walked.hits).toEqual([]);
    expect(walked.fighter.x).toBeLessThan(walked.dummy.x - 15);
  });
});

describe('targeting', () => {
  it('sends units after an enemy and sets the shared target', () => {
    const state = dummyGame();
    sendAway(state);
    const dummy = dummyOf(state);
    const fighter = unitOf(state, FIGHTER);
    place(fighter, dummy.x + 40, dummy.z);
    const events = [
      ...step(state, [{ type: 'target', unitIds: [FIGHTER], enemyId: DUMMY_ID }]),
      ...run(state, 120),
    ];
    expect(state.sharedTargetId).toBe(DUMMY_ID);
    expect(fighter.targetId).toBe(DUMMY_ID);
    expect(hitsBy(events, FIGHTER).length).toBeGreaterThan(0);
  });

  it('a holding unit waits for what comes to it, unless ordered', () => {
    const state = dummyGame();
    sendAway(state);
    const dummy = dummyOf(state);
    const fighter = unitOf(state, FIGHTER);
    place(fighter, dummy.x + 10, dummy.z);
    run(state, 30);
    expect(fighter.x).toBeCloseTo(dummy.x + 10, 6);
    step(state, [{ type: 'target', unitIds: [FIGHTER], enemyId: DUMMY_ID }]);
    run(state, 30);
    expect(fighter.x).toBeLessThan(dummy.x + 5);
  });

  it('an idle unit with an enemy near does not walk back to its slot', () => {
    const state = dummyGame();
    sendAway(state);
    const dummy = dummyOf(state);
    const sniper = unitOf(state, SNIPER);
    place(sniper, dummy.x + 20, dummy.z);
    sniper.hold = false;
    run(state, 60);
    expect(sniper.x).toBeCloseTo(dummy.x + 20, 6);
  });

  it.each([
    ['move', { type: 'move', unitIds: [FIGHTER], x: 0, z: 60, attack: false }],
    ['regroup', { type: 'regroup' }],
    ['scatter', { type: 'scatter' }],
  ] as const)('%s clears the target', (_name, command) => {
    const state = dummyGame();
    const fighter = unitOf(state, FIGHTER);
    applyCommands(state, [{ type: 'target', unitIds: [FIGHTER], enemyId: DUMMY_ID }]);
    expect(fighter.targetId).toBe(DUMMY_ID);
    applyCommands(state, [command]);
    expect(fighter.targetId).toBeNull();
  });

  it('is refused for an enemy that is unknown or down, or for no living unit', () => {
    const state = dummyGame();
    const reason = (enemyId: number, unitIds = [FIGHTER]) =>
      ofType(applyCommands(state, [{ type: 'target', unitIds, enemyId }]), 'order-refused')[0]
        ?.reason;
    expect(reason(99)).toBe('no-target');
    expect(reason(DUMMY_ID, [99])).toBe('unknown-unit');
    unitOf(state, FIGHTER).alive = false;
    expect(reason(DUMMY_ID)).toBe('no-living-units');
    dummyOf(state).alive = false;
    expect(reason(DUMMY_ID, [SNIPER])).toBe('no-target');
  });
});

describe('scatter', () => {
  it('makes a unit invulnerable, so a strike in that window does nothing', () => {
    const state = dummyGame();
    sendAway(state);
    const dummy = dummyOf(state);
    const fighter = unitOf(state, FIGHTER);
    place(fighter, dummy.x + 2, dummy.z);
    dummy.strikeTicks = 2;
    step(state, [{ type: 'scatter' }]);
    const events = run(state, 3);
    expect(ofType(events, 'hit').filter(({ targetId }) => targetId === FIGHTER)).toEqual([]);
    expect(fighter.health).toBe(fighter.maxHealth);
  });
});
