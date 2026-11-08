import { describe, expect, it } from 'vitest';
import { BOSS, MONSTER_RULES } from '../data/enemies';
import { CLASSES } from '../data/squad';
import { EMPTY_SCENARIO } from '../data/scenarios';
import { characterOf } from '../src/family';
import { hitEnemy } from '../src/combat';
import { createGame, step } from '../src/game';
import { nextRandom } from '../src/random';
import type { BossMove, Enemy, GameState, PackData } from '../src/state';
import { TICKS } from '../src/time';
import { zoneOf } from '../src/world';
import { FIGHTER, HEALER, SNIPER, ofType, place, run, sendAway, unitOf } from './helpers';

const HOME = { x: 0, z: 16 };

function bossGame(seed = 1, packs: readonly PackData[] = []): { state: GameState; boss: Enemy } {
  const state = createGame(seed, { ...EMPTY_SCENARIO, contents: { dummy: null, boss: HOME, packs, obstacles: [] } });
  sendAway(state);
  const boss = state.live.enemies.find((enemy) => enemy.boss);
  if (!boss) throw new Error('No boss.');
  return { state, boss };
}

function awakeBoss(seed = 1): { state: GameState; boss: Enemy } {
  const game = bossGame(seed);
  game.boss.awake = true;
  return game;
}

function stateOf(boss: Enemy): NonNullable<Enemy['boss']> {
  if (!boss.boss) throw new Error('Not a boss.');
  return boss.boss;
}

/** Stops the squad doing anything of its own. */
function pacify(state: GameState): void {
  for (const unit of state.bodies) {
    unit.attackTicks = 100000;
    unit.mana = 0;
  }
}

const MOVE_ORDER: readonly BossMove[] = ['slam', 'charge', 'blast', 'summon'];

/** Sets the generator so that the boss picks this move on the next tick. */
function forceMove(state: GameState, boss: Enemy, move: BossMove): void {
  const data = stateOf(boss);
  data.phase = 'free';
  data.lastMove = null;
  boss.strikeTicks = 1;
  const wanted = MOVE_ORDER.indexOf(move);
  for (let rng = 0; rng < 1000; rng += 1) {
    const probe = { rng };
    if (Math.floor(nextRandom(probe) * MOVE_ORDER.length) === wanted) {
      state.rng = rng;
      step(state, []);
      expect(data.lastMove).toBe(move);
      return;
    }
  }
  throw new Error(`Never picked ${move}.`);
}

function lastStarted(boss: Enemy): BossMove | null {
  return stateOf(boss).lastMove;
}

describe('waking', () => {
  it('sleeps until a unit comes within its range', () => {
    const { state, boss } = bossGame();
    run(state, 60);
    expect(boss.awake).toBe(false);
    place(unitOf(state, FIGHTER), boss.x + BOSS.wakeRange - 1, boss.z);
    const events = run(state, 2);
    expect(boss.awake).toBe(true);
    expect(ofType(events, 'boss-woken')).toHaveLength(1);
  });

  it('wakes when hit, and raises the event once', () => {
    const { state, boss } = bossGame();
    const events: Parameters<typeof hitEnemy>[4] = [];
    hitEnemy(state, unitOf(state, SNIPER), boss, 1, events);
    hitEnemy(state, unitOf(state, SNIPER), boss, 1, events);
    expect(ofType(events, 'boss-woken')).toHaveLength(1);
  });

  it('is not woken by a Taunt, and idle units leave it alone', () => {
    const { state, boss } = bossGame();
    const sniper = unitOf(state, SNIPER);
    place(sniper, boss.x + BOSS.wakeRange + 2, boss.z);
    run(state, 40);
    expect(state.live.shots).toEqual([]);
    place(unitOf(state, FIGHTER), boss.x + BOSS.wakeRange + 3, boss.z + 5);
    step(state, [{ type: 'cast', unitId: FIGHTER, spell: 'taunt' }]);
    expect(boss.awake).toBe(false);
  });

  it('is not attacked by attack-move while it sleeps', () => {
    const { state, boss } = bossGame();
    place(unitOf(state, SNIPER), boss.x + 22, boss.z);
    step(state, [{ type: 'move', unitIds: [SNIPER], x: boss.x + 14, z: boss.z, attack: true }]);
    run(state, 90);
    expect(state.live.shots).toEqual([]);
    expect(boss.health).toBe(boss.maxHealth);
  });
});

describe('its four moves', () => {
  it('never repeats a move, and uses all four', () => {
    const { state, boss } = awakeBoss();
    pacify(state);
    place(unitOf(state, FIGHTER), boss.x + 3, boss.z);
    const seen: BossMove[] = [];
    let last: BossMove | null = null;
    for (let tick = 0; tick < 3000; tick += 1) {
      for (const unit of state.bodies) {
        unit.health = unit.maxHealth;
      }
      step(state, []);
      const move = lastStarted(boss);
      if (move !== last && move) {
        seen.push(move);
        last = move;
      }
    }
    expect(new Set(seen).size).toBe(4);
    expect(seen.length).toBeGreaterThan(8);
    expect(seen.some((move, index) => index > 0 && move === seen[index - 1])).toBe(false);
  });

  it('marks a slam under the squad, which lands after its telegraph', () => {
    const { state, boss } = awakeBoss();
    pacify(state);
    for (const unit of state.bodies) {
      place(unit, 30, 30 + unit.id * 2);
    }
    forceMove(state, boss, 'slam');
    const [slam] = state.live.scheduled;
    if (slam?.kind !== 'slam') throw new Error('No slam.');
    expect(Math.hypot(slam.x - 30, slam.z - 34)).toBeLessThan(0.01);
    expect(ofType(run(state, slam.ticks - 1), 'hit')).toEqual([]);
    expect(ofType(run(state, 1), 'hit').length).toBe(3);
  });

  it('misses with a slam if the squad has left', () => {
    const { state, boss } = awakeBoss();
    pacify(state);
    for (const unit of state.bodies) {
      place(unit, 30, 30 + unit.id * 2);
    }
    forceMove(state, boss, 'slam');
    for (const unit of state.bodies) {
      unit.x -= 50;
    }
    const slam = state.live.scheduled[0];
    const events = run(state, slam?.ticks ?? 0);
    expect(ofType(events, 'hit')).toEqual([]);
  });

  it('charges at the Healer along a telegraphed line, and hits each unit once', () => {
    const { state, boss } = awakeBoss();
    pacify(state);
    const healer = unitOf(state, HEALER);
    place(unitOf(state, FIGHTER), boss.x + 9, boss.z);
    place(healer, boss.x, boss.z + 20);
    forceMove(state, boss, 'charge');
    const [line] = state.live.scheduled;
    if (line?.kind !== 'charge') throw new Error('No line.');
    expect(line.angle).toBeCloseTo(Math.PI / 2, 2);
    const events = run(state, line.ticks + TICKS.chargeLength);
    expect(boss.z).toBeGreaterThan(HOME.z + 15);
    const hits = ofType(events, 'hit').filter(({ targetId }) => targetId === HEALER);
    expect(hits).toHaveLength(1);
  });

  it('turns a charge on the taunter', () => {
    const { state, boss } = awakeBoss();
    pacify(state);
    const fighter = unitOf(state, FIGHTER);
    place(fighter, boss.x + 9, boss.z);
    place(unitOf(state, HEALER), boss.x, boss.z + 20);
    boss.tauntTicks = 100;
    boss.tauntUnitId = FIGHTER;
    forceMove(state, boss, 'charge');
    const [line] = state.live.scheduled;
    if (line?.kind !== 'charge') throw new Error('No line.');
    expect(Math.abs(line.angle)).toBeLessThan(0.05);
  });

  it('summons minions that go for the Healer and are worth no XP', () => {
    const { state, boss } = awakeBoss();
    pacify(state);
    forceMove(state, boss, 'summon');
    const minions = state.live.enemies.filter(({ minion }) => minion);
    expect(minions).toHaveLength(BOSS.summon.calmCount);
    for (const minion of minions) {
      expect(minion.maxHealth).toBe(BOSS.summon.health);
      expect(minion.preferId).toBe(HEALER);
      expect(minion.xp).toBe(0);
      expect(minion.awake).toBe(true);
    }
  });

  it('reaches for its target in melee between moves', () => {
    const { state, boss } = awakeBoss();
    pacify(state);
    const fighter = unitOf(state, FIGHTER);
    place(fighter, boss.x + 3, boss.z);
    boss.strikeTicks = 1000;
    const hits = ofType(run(state, 100), 'hit').filter(({ targetId }) => targetId === FIGHTER);
    expect(hits).toHaveLength(2);
  });
});

describe('interrupts', () => {
  function casting(): { state: GameState; boss: Enemy } {
    const game = awakeBoss();
    pacify(game.state);
    place(unitOf(game.state, SNIPER), game.boss.x + 20, game.boss.z);
    forceMove(game.state, game.boss, 'blast');
    return game;
  }

  it('hits every unit if the cast finishes', () => {
    const { state, boss } = casting();
    const events = run(state, stateOf(boss).castTicks);
    expect(new Set(ofType(events, 'hit').map(({ targetId }) => targetId)).size).toBe(3);
    expect(ofType(events, 'interrupted')).toEqual([]);
  });

  it('stops the cast on a Crippling Shot, and staggers the boss', () => {
    const { state, boss } = casting();
    step(state, [{ type: 'cast', unitId: SNIPER, spell: 'crippling-shot', enemyId: boss.id }]);
    const events = run(state, 20);
    expect(ofType(events, 'interrupted')).toHaveLength(1);
    expect(stateOf(boss).castTicks).toBe(0);
    expect(boss.staggerTicks).toBeGreaterThan(0);
    expect(ofType(run(state, 200), 'hit').filter(({ targetId }) => targetId <= 3).length).toBeLessThan(3);
  });

  it('does nothing while staggered', () => {
    const { state, boss } = awakeBoss();
    pacify(state);
    place(unitOf(state, FIGHTER), boss.x + 3, boss.z);
    boss.staggerTicks = 40;
    boss.strikeTicks = 0;
    const events = run(state, 30);
    expect(stateOf(boss).lastMove).toBeNull();
    expect(ofType(events, 'hit')).toEqual([]);
  });

  it('takes half as much again while staggered', () => {
    const { state, boss } = awakeBoss();
    const unit = unitOf(state, SNIPER);
    unit.crit = 0;
    const before = boss.health;
    hitEnemy(state, unit, boss, 1, []);
    const plain = before - boss.health;
    boss.staggerTicks = 10;
    const staggered = boss.health;
    hitEnemy(state, unit, boss, 1, []);
    expect((staggered - boss.health) / plain).toBeCloseTo(1.5, 1);
  });

  it('ignores a Crippling Shot that hits something else', () => {
    const { state, boss } = casting();
    const minionPack = { x: 20, z: 16, level: 3, mobs: [{ kind: 'swarm', count: 1 }] } as const;
    const other = bossGame(1, [minionPack]).state.live.enemies[0];
    if (!other) throw new Error('No monster.');
    state.live.enemies.unshift({ ...other, id: 500, x: boss.x + 12, z: boss.z, awake: true });
    step(state, [{ type: 'cast', unitId: SNIPER, spell: 'crippling-shot', enemyId: 500 }]);
    const events = run(state, 20);
    expect(ofType(events, 'interrupted')).toEqual([]);
    expect(stateOf(boss).castTicks).toBeGreaterThan(0);
  });

  it('does nothing to a boss that is not casting', () => {
    const { state, boss } = awakeBoss();
    pacify(state);
    place(unitOf(state, SNIPER), boss.x + 20, boss.z);
    boss.strikeTicks = 1000;
    step(state, [{ type: 'cast', unitId: SNIPER, spell: 'crippling-shot', enemyId: boss.id }]);
    expect(ofType(run(state, 20), 'interrupted')).toEqual([]);
    expect(boss.slowTicks).toBeGreaterThan(0);
    expect(boss.staggerTicks).toBe(0);
  });
});

describe('enrage', () => {
  function enraged(move: BossMove): { state: GameState; boss: Enemy } {
    const game = awakeBoss();
    pacify(game.state);
    game.boss.health = game.boss.maxHealth * BOSS.enrageBelowShare - 1;
    forceMove(game.state, game.boss, move);
    return game;
  }

  it('slams twice', () => {
    const { state } = enraged('slam');
    expect(state.live.scheduled.filter(({ kind }) => kind === 'slam')).toHaveLength(BOSS.slam.enragedCount);
  });

  it('summons more', () => {
    const { state } = enraged('summon');
    expect(state.live.enemies.filter(({ minion }) => minion)).toHaveLength(BOSS.summon.enragedCount);
  });

  it('casts faster', () => {
    const { boss } = enraged('blast');
    expect(stateOf(boss).castTotalTicks).toBe(BOSS.blast.enragedSeconds * 30);
  });

  it('moves again sooner', () => {
    const calm = awakeBoss();
    pacify(calm.state);
    forceMove(calm.state, calm.boss, 'summon');
    const angry = enraged('summon');
    expect(angry.boss.strikeTicks).toBeLessThan(calm.boss.strikeTicks);
  });

  it('does not begin above its share of health', () => {
    const { state, boss } = awakeBoss();
    pacify(state);
    boss.health = boss.maxHealth * BOSS.enrageBelowShare + 1;
    forceMove(state, boss, 'slam');
    expect(state.live.scheduled.filter(({ kind }) => kind === 'slam')).toHaveLength(BOSS.slam.calmCount);
  });
});

describe('Taunt and the slow on the boss', () => {
  it('reaches further and lasts less than on a monster', () => {
    const { state, boss } = awakeBoss();
    place(unitOf(state, FIGHTER), boss.x + 24, boss.z);
    step(state, [{ type: 'cast', unitId: FIGHTER, spell: 'taunt' }]);
    expect(boss.tauntTicks).toBe(TICKS.tauntBoss - 1);
  });

  it('halves its walk', () => {
    const walked = (slowed: boolean): number => {
      const { state, boss } = awakeBoss();
      pacify(state);
      place(unitOf(state, FIGHTER), boss.x + 60, boss.z);
      boss.strikeTicks = 1000;
      boss.slowTicks = slowed ? 1000 : 0;
      run(state, 30);
      const start = boss.x;
      run(state, 30);
      return boss.x - start;
    };
    expect(walked(true) / walked(false)).toBeCloseTo(BOSS.slowShare, 2);
  });

  it('is not moved by knockback', () => {
    const { state, boss } = bossGame();
    hitEnemy(state, unitOf(state, FIGHTER), boss, 1, [], 26, 0);
    run(state, 5);
    expect(boss.x).toBe(HOME.x);
  });
});

describe('victory', () => {
  it('ends the run, and later commands are refused', () => {
    const { state, boss } = awakeBoss();
    boss.health = 1;
    const events: Parameters<typeof hitEnemy>[4] = [];
    hitEnemy(state, unitOf(state, SNIPER), boss, 1, events);
    expect(ofType(events, 'victory')).toHaveLength(1);
    expect(state.victory).toBe(true);
    const tick = state.tick;
    const positions = JSON.stringify(state.bodies);
    unitOf(state, FIGHTER).dest = { x: 0, z: 0 };
    const after = step(state, [{ type: 'regroup' }]);
    expect(state.tick).toBe(tick + 1);
    expect(JSON.stringify({ ...state.bodies, 0: null })).toBe(
      JSON.stringify({ ...(JSON.parse(positions) as unknown[]), 0: null }),
    );
    expect(unitOf(state, FIGHTER).dest).toEqual({ x: 0, z: 0 });
    expect(unitOf(state, FIGHTER).bestDistance).toBeNull();
    expect(ofType(after, 'order-refused').map(({ reason }) => reason)).toEqual(['run-over']);
  });

  it('gives its XP', () => {
    const { state, boss } = awakeBoss();
    boss.health = 1;
    hitEnemy(state, unitOf(state, SNIPER), boss, 1, []);
    expect(state.family.characters.every(({ xp }) => xp === Math.round(BOSS.xp / 3))).toBe(true);
  });
});

describe('wipes', () => {
  const PACK = [{ x: 40, z: 30, level: 3, mobs: [{ kind: 'runner', count: 2 }] }] as const;

  function wiped(): { state: GameState; boss: Enemy; monster: Enemy } {
    const { state, boss } = bossGame(1, PACK);
    const monster = state.live.enemies[0];
    if (!monster) throw new Error('No monster.');
    boss.awake = true;
    pacify(state);
    place(unitOf(state, FIGHTER), boss.x + 3, boss.z);
    forceMove(state, boss, 'summon');
    boss.health = 100;
    monster.health = 50;
    monster.awake = true;
    state.family.marks = 1234;
    state.anchor = { x: 1, z: 1 };
    state.family.potions = 2;
    characterOf(state, FIGHTER).xp = 77;
    unitOf(state, SNIPER).spellTicks.volley = 300;
    state.live.scheduled.push({ kind: 'slam', ticks: 500, totalTicks: 500, enemyId: boss.id, x: 0, z: 0, radius: 1, hitRadius: 1, damage: 1 });
    for (const unit of state.bodies) {
      unit.health = 0;
      unit.alive = false;
    }
    state.squadDown = true;
    state.wipeTicks = TICKS.wipe;
    return { state, boss, monster };
  }

  it('refuses commands until the squad is back', () => {
    const { state } = wiped();
    const events = step(state, [{ type: 'regroup' }]);
    expect(ofType(events, 'order-refused')[0]?.reason).toBe('no-living-units');
    expect(state.squadDown).toBe(true);
  });

  it('returns everyone to camp, whole, after the delay', () => {
    const { state } = wiped();
    expect(ofType(run(state, TICKS.wipe - 1), 'squad-returned')).toEqual([]);
    expect(ofType(run(state, 1), 'squad-returned')).toHaveLength(1);
    expect(state.squadDown).toBe(false);
    for (const unit of state.bodies) {
      expect(unit.alive).toBe(true);
      expect(unit.health).toBe(unit.maxHealth);
      expect(unit.mana).toBe(CLASSES[characterOf(state, unit.id).classId].mana);
      expect(unit.spellTicks).toEqual({});
      expect(Math.hypot(unit.x - zoneOf(state).camp.x, unit.z - zoneOf(state).camp.z)).toBeLessThan(6);
    }
    expect(state.anchor).toEqual({ x: zoneOf(state).camp.x, z: zoneOf(state).camp.z });
    expect(state.live.scheduled).toEqual([]);
  });

  it('resets the boss and removes its minions', () => {
    const { state, boss } = wiped();
    run(state, TICKS.wipe);
    expect(boss.health).toBe(boss.maxHealth);
    expect(boss.awake).toBe(false);
    expect([boss.x, boss.z]).toEqual([HOME.x, HOME.z]);
    expect(stateOf(boss).castTicks).toBe(0);
    expect(state.live.enemies.filter(({ minion }) => minion)).toEqual([]);
  });

  it('keeps marks, potions, XP and hurt monsters', () => {
    const { state, monster } = wiped();
    run(state, TICKS.wipe);
    expect(state.family.marks).toBe(1234);
    expect(state.family.potions).toBe(2);
    expect(characterOf(state, FIGHTER).xp).toBe(77);
    expect(monster.health).toBe(50);
    expect(monster.awake).toBe(true);
  });

  it('awake monsters still come for the squad', () => {
    const { state, monster } = wiped();
    const start = Math.hypot(monster.x - zoneOf(state).camp.x, monster.z - zoneOf(state).camp.z);
    run(state, TICKS.wipe + 60);
    expect(Math.hypot(monster.x - zoneOf(state).camp.x, monster.z - zoneOf(state).camp.z)).toBeLessThan(start);
    expect(MONSTER_RULES.wakeRange).toBeLessThan(start);
  });
});
