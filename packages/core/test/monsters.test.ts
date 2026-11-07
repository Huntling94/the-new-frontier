import { describe, expect, it } from 'vitest';
import { LOOT, MONSTERS, MONSTER_RULES, SLAMMER, SPITTER } from '../data/enemies';
import { EMPTY_SCENARIO, ISLAND_SCENARIO } from '../data/scenarios';
import { damageToEnemy, hitEnemy, hurtUnit } from '../src/combat';
import { createGame, step } from '../src/game';
import { dropLoot } from '../src/loot';
import type { Enemy, GameState, MonsterKind, PackData } from '../src/state';
import { FIGHTER, HEALER, SNIPER, ofType, place, run, sendAway, unitOf } from './helpers';

const POINT = { x: 0, z: 30 };

function packGame(mobs: PackData['mobs'], level = 3): GameState {
  const packs = [{ ...POINT, level, mobs }];
  const state = createGame(1, { ...EMPTY_SCENARIO, contents: { dummy: null, boss: null, packs, obstacles: [] } });
  sendAway(state);
  return state;
}

function monster(state: GameState, index = 0): Enemy {
  const enemy = state.live.enemies[index];
  if (!enemy) throw new Error('No monster.');
  return enemy;
}

function oneOf(kind: MonsterKind): { state: GameState; enemy: Enemy } {
  const state = packGame([{ kind, count: 1 }]);
  const enemy = monster(state);
  enemy.x = POINT.x;
  enemy.z = POINT.z;
  return { state, enemy };
}

describe('the island', () => {
  it('holds the seven packs and the boss, and no dummy', () => {
    const state = createGame(1, ISLAND_SCENARIO);
    const packs = new Set(state.live.enemies.map(({ packId }) => packId));
    expect(state.live.enemies.filter(({ kind }) => kind === 'boss')).toHaveLength(1);
    expect(state.live.enemies.filter(({ kind }) => kind === 'dummy')).toHaveLength(0);
    expect(packs.size).toBe(8);
    expect(state.live.enemies).toHaveLength(35);
  });

  it('gives each monster the stats of its level and type', () => {
    const { enemy } = oneOf('runner');
    expect(enemy.maxHealth).toBe(540);
    expect(enemy.attack).toBe(67);
    expect(enemy.ar).toBe(2);
    expect(enemy.dr).toBe(2);
    expect(enemy.defence).toBe(17);
    const brute = monster(packGame([{ kind: 'brute', count: 1 }], 6));
    expect(brute.maxHealth).toBeCloseTo((300 + 372 + 216) * 2.8, 6);
    expect(brute.size).toBeGreaterThan(MONSTERS.brute.size * MONSTER_RULES.leastScale - 1e-9);
  });
});

describe('damage to monsters', () => {
  it('uses the stats of the monster that is hit', () => {
    const low = packGame([{ kind: 'runner', count: 1 }], 1);
    const high = packGame([{ kind: 'runner', count: 1 }], 20);
    const unit = unitOf(low, SNIPER);
    const easy = damageToEnemy(unit, monster(low), 1, false);
    expect(damageToEnemy(unit, monster(high), 1, false)).toBeLessThan(easy);
  });
});

describe('aggro', () => {
  it('sleeps until a unit comes close, and then the whole pack wakes', () => {
    const state = packGame([{ kind: 'runner', count: 3 }]);
    run(state, 30);
    expect(state.live.enemies.every(({ awake }) => !awake)).toBe(true);
    const enemy = monster(state);
    place(unitOf(state, FIGHTER), enemy.x + MONSTER_RULES.wakeRange - 1, enemy.z);
    run(state, 1);
    expect(state.live.enemies.every(({ awake }) => awake)).toBe(true);
  });

  it('wakes when hit, from any distance, and does not wake another pack', () => {
    const packs: readonly PackData[] = [
      { x: 0, z: 30, level: 3, mobs: [{ kind: 'runner', count: 2 }] },
      { x: 40, z: 30, level: 3, mobs: [{ kind: 'runner', count: 1 }] },
    ];
    const scenario = { ...EMPTY_SCENARIO, contents: { dummy: null, boss: null, packs } };
    const state = createGame(1, scenario);
    sendAway(state);
    hitEnemy(state, unitOf(state, SNIPER), monster(state), 1, []);
    expect(state.live.enemies.map(({ awake }) => awake)).toEqual([true, true, false]);
  });

  it('leaves idle units alone with a sleeping monster, until it wakes', () => {
    const { state, enemy } = oneOf('runner');
    const sniper = unitOf(state, SNIPER);
    place(sniper, enemy.x + MONSTER_RULES.wakeRange + 2, enemy.z);
    run(state, 40);
    expect(state.live.shots).toEqual([]);
    enemy.awake = true;
    run(state, 40);
    expect(ofType(run(state, 40), 'hit').length).toBeGreaterThan(0);
  });

  it('lets attack-move start a fight with a sleeping pack', () => {
    const { state, enemy } = oneOf('runner');
    const sniper = unitOf(state, SNIPER);
    place(sniper, enemy.x + MONSTER_RULES.wakeRange + 2, enemy.z);
    step(state, [{ type: 'move', unitIds: [SNIPER], x: enemy.x, z: enemy.z, attack: true }]);
    expect(enemy.awake).toBe(false);
    expect(sniper.targetId).toBe(enemy.id);
    const events = run(state, 90);
    expect(enemy.awake).toBe(true);
    expect(ofType(events, 'hit').some(({ targetId }) => targetId === enemy.id)).toBe(true);
  });
});

describe('monster behaviour', () => {
  it('walks in and strikes, once its wind-up is over', () => {
    const { state, enemy } = oneOf('runner');
    const fighter = unitOf(state, FIGHTER);
    place(fighter, enemy.x + 10, enemy.z);
    fighter.attackTicks = 100000;
    const events = run(state, 120);
    expect(enemy.x).toBeGreaterThan(POINT.x + 5);
    expect(ofType(events, 'hit').filter(({ targetId }) => targetId === FIGHTER).length).toBeGreaterThan(0);
  });

  it('misses a unit that has left before the wind-up ends', () => {
    const { state, enemy } = oneOf('brute');
    enemy.awake = true;
    enemy.strikeTicks = 0;
    const unit = unitOf(state, FIGHTER);
    place(unit, enemy.x + 4, enemy.z);
    unit.attackTicks = 100000;
    run(state, 2);
    expect(state.live.scheduled.some(({ kind }) => kind === 'slam')).toBe(true);
    place(unit, enemy.x + SLAMMER.hitRadius + 3, enemy.z);
    const events = run(state, 30);
    expect(ofType(events, 'hit')).toEqual([]);
  });

  it('lands a slam on everyone inside it', () => {
    const { state, enemy } = oneOf('brute');
    enemy.awake = true;
    enemy.strikeTicks = 0;
    for (const unit of state.units) {
      place(unit, enemy.x + 4, enemy.z + unit.id - 2);
      unit.attackTicks = 100000;
    }
    const events = run(state, 32);
    const hit = new Set(ofType(events, 'hit').map(({ targetId }) => targetId));
    expect(hit).toEqual(new Set([FIGHTER, SNIPER, HEALER]));
  });

  it('drops a slam if the monster dies first', () => {
    const { state, enemy } = oneOf('brute');
    enemy.awake = true;
    enemy.strikeTicks = 0;
    const unit = unitOf(state, FIGHTER);
    place(unit, enemy.x + 4, enemy.z);
    unit.attackTicks = 100000;
    run(state, 2);
    enemy.health = 1;
    hitEnemy(state, unit, enemy, 1, []);
    expect(ofType(run(state, 40), 'hit')).toEqual([]);
  });

  it('keeps a spitter at its distance', () => {
    const near = oneOf('spitter');
    near.enemy.awake = true;
    near.enemy.strikeTicks = 100000;
    place(unitOf(near.state, FIGHTER), near.enemy.x + SPITTER.retreatWithin - 3, near.enemy.z);
    unitOf(near.state, FIGHTER).attackTicks = 100000;
    run(near.state, 30);
    expect(near.enemy.x).toBeLessThan(POINT.x);

    const far = oneOf('spitter');
    far.enemy.awake = true;
    far.enemy.strikeTicks = 100000;
    place(unitOf(far.state, FIGHTER), far.enemy.x + SPITTER.approachBeyond + 10, far.enemy.z);
    run(far.state, 30);
    expect(far.enemy.x).toBeGreaterThan(POINT.x);
  });

  it('fires a straight shot that hits the first unit in its way', () => {
    const { state, enemy } = oneOf('spitter');
    enemy.awake = true;
    enemy.strikeTicks = 0;
    const unit = unitOf(state, SNIPER);
    place(unit, enemy.x + 12, enemy.z);
    unit.attackTicks = 100000;
    run(state, 16);
    const [shot] = state.live.enemyShots;
    expect(shot?.speedX).toBeCloseTo(SPITTER.shotSpeed, 6);
    enemy.strikeTicks = 100000;
    const health = unit.health;
    const events = run(state, 60);
    expect(unit.health).toBeLessThan(health);
    expect(ofType(events, 'hit').some(({ targetId }) => targetId === SNIPER)).toBe(true);
    expect(state.live.enemyShots).toEqual([]);
  });

  it('lets a shot miss a unit that steps aside, and then it runs out', () => {
    const { state, enemy } = oneOf('spitter');
    enemy.awake = true;
    enemy.strikeTicks = 0;
    const unit = unitOf(state, SNIPER);
    place(unit, enemy.x + 12, enemy.z);
    unit.attackTicks = 100000;
    run(state, 16);
    enemy.strikeTicks = 100000;
    unit.z += 10;
    const events = run(state, 90);
    expect(ofType(events, 'hit').filter(({ targetId }) => targetId === SNIPER)).toEqual([]);
    expect(state.live.enemyShots).toEqual([]);
  });

  it('stays on the land, however hard it is pushed', () => {
    const { state, enemy } = oneOf('runner');
    enemy.x = 0;
    enemy.z = 70;
    enemy.knockZ = 2000;
    run(state, 60);
    expect(enemy.z).toBeLessThan(92);
  });
});

describe('minions', () => {
  it('go for the unit they prefer, past a nearer one', () => {
    const { state, enemy } = oneOf('swarm');
    enemy.awake = true;
    enemy.strikeTicks = 100000;
    enemy.preferId = HEALER;
    place(unitOf(state, FIGHTER), enemy.x + 6, enemy.z);
    place(unitOf(state, HEALER), enemy.x - 30, enemy.z);
    unitOf(state, FIGHTER).attackTicks = 100000;
    run(state, 30);
    expect(enemy.x).toBeLessThan(POINT.x);
  });
});

describe('what spells do to monsters', () => {
  it('Taunt draws a monster to the Fighter, past a nearer unit', () => {
    const { state, enemy } = oneOf('runner');
    enemy.awake = true;
    const fighter = unitOf(state, FIGHTER);
    const sniper = unitOf(state, SNIPER);
    place(fighter, enemy.x + 12, enemy.z);
    place(sniper, enemy.x - 6, enemy.z);
    step(state, [{ type: 'cast', unitId: FIGHTER, spell: 'taunt' }]);
    expect(enemy.tauntTicks).toBeGreaterThan(0);
    const start = enemy.x;
    run(state, 30);
    expect(enemy.x).toBeGreaterThan(start);
  });

  it('a taunted monster goes back to the nearest if the Fighter falls', () => {
    const { state, enemy } = oneOf('runner');
    enemy.awake = true;
    const fighter = unitOf(state, FIGHTER);
    const sniper = unitOf(state, SNIPER);
    place(fighter, enemy.x + 12, enemy.z);
    place(sniper, enemy.x - 6, enemy.z);
    step(state, [{ type: 'cast', unitId: FIGHTER, spell: 'taunt' }]);
    fighter.health = 1;
    hurtUnit(state, fighter, 1000, enemy, []);
    const start = enemy.x;
    run(state, 30);
    expect(enemy.x).toBeLessThan(start);
  });

  it('Taunt wakes the pack', () => {
    const state = packGame([{ kind: 'runner', count: 2 }]);
    const enemy = monster(state);
    place(unitOf(state, FIGHTER), enemy.x + MONSTER_RULES.wakeRange - 0.5, enemy.z);
    step(state, [{ type: 'cast', unitId: FIGHTER, spell: 'taunt' }]);
    expect(state.live.enemies.every(({ awake }) => awake)).toBe(true);
  });

  it('the slow cuts a monster to its share of speed', () => {
    const walked = (slowed: boolean): number => {
      const { state, enemy } = oneOf('runner');
      enemy.awake = true;
      enemy.strikeTicks = 100000;
      place(unitOf(state, FIGHTER), enemy.x + 60, enemy.z);
      unitOf(state, FIGHTER).attackTicks = 100000;
      enemy.slowTicks = slowed ? 1000 : 0;
      run(state, 20);
      const start = enemy.x;
      run(state, 30);
      return enemy.x - start;
    };
    expect(walked(true) / walked(false)).toBeCloseTo(MONSTER_RULES.slowShare, 2);
  });

  it('knockback moves a monster, and a brute by its share', () => {
    const endsAt = (kind: MonsterKind, knockback: number): number => {
      const { state, enemy } = oneOf(kind);
      hitEnemy(state, unitOf(state, FIGHTER), enemy, 1, [], knockback, 0);
      run(state, 30);
      return enemy.x;
    };
    const pushed = (kind: MonsterKind): number => endsAt(kind, 26) - endsAt(kind, 0);
    expect(pushed('runner')).toBeGreaterThan(1);
    expect(pushed('brute') / pushed('runner')).toBeCloseTo(MONSTERS.brute.knockbackShare, 2);
  });
});

describe('kills and loot', () => {
  function kill(state: GameState, enemy: Enemy): void {
    enemy.health = 1;
    hitEnemy(state, unitOf(state, SNIPER), enemy, 1, []);
  }

  it('splits XP among the living, and a monster does not respawn', () => {
    const { state, enemy } = oneOf('runner');
    unitOf(state, HEALER).alive = false;
    kill(state, enemy);
    expect(unitOf(state, FIGHTER).xp).toBe(Math.round(enemy.xp / 2));
    expect(unitOf(state, HEALER).xp).toBe(0);
    run(state, 2000);
    expect(state.live.enemies).toEqual([]);
  });

  it('leaves coins worth its level', () => {
    const { state, enemy } = oneOf('brute');
    kill(state, enemy);
    const coins = state.live.drops.filter(({ kind }) => kind === 'marks');
    expect(coins).toHaveLength(4);
    expect(coins[0]?.value).toBe(LOOT.coinBase + 3 * LOOT.coinPerLevel);
  });

  it('collects a drop once it lands, and only from nearby', () => {
    const { state, enemy } = oneOf('runner');
    const before = state.marks;
    kill(state, enemy);
    run(state, 60);
    expect(state.marks).toBe(before);
    const drops = state.live.drops.length;
    expect(drops).toBeGreaterThan(0);

    place(unitOf(state, SNIPER), POINT.x + 8, POINT.z);
    const events = run(state, 60);
    expect(state.live.drops).toEqual([]);
    expect(ofType(events, 'loot')).toHaveLength(drops);
    expect(state.marks).toBeGreaterThan(before);
  });

  it('cannot be collected in the air', () => {
    const { state, enemy } = oneOf('runner');
    place(unitOf(state, SNIPER), enemy.x, enemy.z);
    kill(state, enemy);
    const before = state.marks;
    run(state, 5);
    expect(state.marks).toBe(before);
  });

  it('leaves a potion about one kill in twenty', () => {
    const { state, enemy } = oneOf('runner');
    for (let kills = 0; kills < 2000; kills += 1) {
      dropLoot(state, enemy);
    }
    const potions = state.live.drops.filter(({ kind }) => kind === 'potion').length;
    expect(potions / 2000).toBeCloseTo(LOOT.potionChance, 1);
    expect(potions).toBeGreaterThan(0);
  });

  it('adds a found potion to the stock', () => {
    const { state, enemy } = oneOf('runner');
    const unit = unitOf(state, SNIPER);
    place(unit, enemy.x, enemy.z);
    state.live.drops.push({
      id: 999,
      kind: 'potion',
      value: 1,
      x: enemy.x,
      z: enemy.z,
      speedX: 0,
      speedZ: 0,
      flightTicks: 0,
      ageTicks: 0,
    });
    const before = state.potions;
    run(state, 1);
    expect(state.potions).toBe(before + 1);
  });
});
