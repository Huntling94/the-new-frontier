import { describe, expect, it } from 'vitest';
import { BOTS } from '../data/bots';
import { ISLAND_SCENARIO, TOWN_SCENARIO } from '../data/scenarios';
import { ZONES } from '../data/zones';
import { characterOf } from '../src/family';
import { gateRoute } from '../src/npcs';
import { autoCommands } from '../src/auto';
import { botCommands } from '../src/bots';
import { createGame, step } from '../src/game';
import type { Command, GameEvent, GameState, MoveCommand } from '../src/state';
import { TICKS } from '../src/time';
import { FIGHTER, HEALER, SNIPER, itemAt, unitOf } from './helpers';

const INTO_TOWN = { x: 16, z: 72 };

function island(seed = 1): GameState {
  return createGame(seed, ISLAND_SCENARIO);
}

/** Brings the game to a tick on which the bots think. */
function thinking(state: GameState): GameState {
  state.tick = TICKS.autoThink * TICKS.botThink;
  return state;
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

function bossOf(state: GameState): GameState['live']['enemies'][number] {
  const boss = state.live.enemies.find((enemy) => enemy.boss);
  if (!boss) throw new Error('No boss.');
  return boss;
}

function moves(commands: readonly Command[]): MoveCommand[] {
  return commands.filter((command): command is MoveCommand => command.type === 'move');
}

function clearMonsters(state: GameState): void {
  state.live.enemies = state.live.enemies.filter((enemy) => enemy.boss);
}

describe('auto-combat', () => {
  it('thinks only on its own ticks', () => {
    const state = thinking(island());
    expect(autoCommands(state).commands.length).toBeGreaterThan(0);
    state.tick += 1;
    expect(autoCommands(state).commands).toEqual([]);
  });

  it('walks to the nearest monster, on attack-move', () => {
    const [move] = moves(autoCommands(thinking(island())).commands);
    expect(move?.attack).toBe(true);
    expect(move?.unitIds).toEqual([FIGHTER, SNIPER, HEALER]);
  });

  it('fetches a fresh drop before the next monster', () => {
    const state = thinking(island());
    state.live.drops.push({ id: 900, kind: 'marks', value: 1, x: 40, z: 40, speedX: 0, speedZ: 0, flightTicks: 0, ageTicks: 0 });
    expect(moves(autoCommands(state).commands)[0]).toMatchObject({ x: 40, z: 40 });
  });

  it('leaves an old drop', () => {
    const state = thinking(island());
    state.live.drops.push({ id: 900, kind: 'marks', value: 1, x: 40, z: 40, speedX: 0, speedZ: 0, flightTicks: 0, ageTicks: TICKS.dropLife });
    expect(moves(autoCommands(state).commands)[0]).not.toMatchObject({ x: 40, z: 40 });
  });

  it('waits while it fights', () => {
    const state = thinking(island());
    const [monster] = state.live.enemies;
    if (!monster) throw new Error('No monster.');
    monster.awake = true;
    monster.x = 0;
    monster.z = 55;
    expect(autoCommands(state).commands).toEqual([]);
  });

  it('runs only the characters it is given, and leaves the rest alone (D-035)', () => {
    const state = thinking(island());
    const [move] = moves(autoCommands(state, [SNIPER]).commands);
    expect(move?.unitIds).toEqual([SNIPER]);
    expect(moves(autoCommands(state).commands)[0]?.unitIds).toEqual([FIGHTER, SNIPER, HEALER]);
  });

  it('is not held up by another character walking', () => {
    const state = thinking(island());
    const fighter = unitOf(state, FIGHTER);
    fighter.dest = { x: 0, z: 0 };
    expect(autoCommands(state).commands).toEqual([]);
    expect(moves(autoCommands(state, [HEALER]).commands)).toHaveLength(1);
  });

  it('stops once everyone it runs is down', () => {
    const state = thinking(island());
    unitOf(state, SNIPER).alive = false;
    expect(autoCommands(state, [SNIPER])).toEqual({ commands: [], stop: 'squad-down' });
  });

  it('does not wait on a monster nobody can reach, which is what stalled it', () => {
    const state = thinking(island());
    const [monster] = state.live.enemies;
    if (!monster) throw new Error('No monster.');
    monster.awake = true;
    for (const unit of state.bodies) {
      unit.x = -60;
      unit.z = 10 + unit.id;
    }
    unitOf(state, HEALER).x = 30;
    monster.x = 30;
    monster.z = 12;
    expect(moves(autoCommands(state).commands)).toHaveLength(1);
  });

  it('swings round the arena rather than through it', () => {
    const state = thinking(island());
    clearMonsters(state);
    state.live.enemies.push({ ...bossOf(state), id: 900, boss: null, kind: 'runner', x: 0, z: -60 });
    for (const unit of state.bodies) {
      unit.x = 0;
      unit.z = 60 + unit.id;
    }
    const [move] = moves(autoCommands(state).commands);
    expect(Math.hypot(move?.x ?? 0, move?.z ?? 0)).toBeCloseTo(34, 3);
  });

  it('drinks when someone is low', () => {
    const state = thinking(island());
    unitOf(state, FIGHTER).health = 100;
    expect(autoCommands(state).commands.map(({ type }) => type)).toContain('potion');
  });

  it('fights the boss once it is awake, instead of stopping (D-036)', () => {
    const state = thinking(island());
    const boss = bossOf(state);
    boss.awake = true;
    const result = autoCommands(state);
    expect(result.stop).toBeNull();
    expect(result.commands).toContainEqual({ type: 'target', unitIds: state.bodies.map(({ id }) => id), enemyId: boss.id });

    // Characters already fighting or walking are left alone.
    unitOf(state, FIGHTER).targetId = boss.id;
    const rest = autoCommands(state).commands.find(({ type }) => type === 'target');
    expect(rest).toEqual({ type: 'target', unitIds: [SNIPER, HEALER], enemyId: boss.id });
  });

  it('stops for a stated reason', () => {
    const danger = thinking(island());
    danger.family.potions = 0;
    unitOf(danger, FIGHTER).health = 100;
    expect(autoCommands(danger).stop).toBe('danger');

    const clear = thinking(island());
    clearMonsters(clear);
    expect(autoCommands(clear).stop).toBe('clear');

    const down = thinking(island());
    down.squadDown = true;
    expect(autoCommands(down).stop).toBe('squad-down');

    const won = thinking(island());
    won.victory = true;
    expect(autoCommands(won).stop).toBe('victory');
  });

  it('does not reach for a potion it has not got', () => {
    const state = thinking(island());
    state.family.potions = 0;
    unitOf(state, FIGHTER).health = unitOf(state, FIGHTER).maxHealth * 0.3;
    expect(autoCommands(state).commands.map(({ type }) => type)).not.toContain('potion');
  });

  it('carries on through healthy play', () => {
    expect(autoCommands(thinking(island())).stop).toBeNull();
  });
});

describe('bots', () => {
  it('act only through commands, and read state without changing it', () => {
    const state = deepFreeze(thinking(island()));
    expect(botCommands(state, 'careful').length).toBeGreaterThan(0);
    expect(autoCommands(state).commands.length).toBeGreaterThan(0);
  });

  it('think only on their own ticks', () => {
    const state = thinking(island());
    expect(botCommands(state, 'careful').length).toBeGreaterThan(0);
    state.tick += 1;
    expect(botCommands(state, 'careful')).toEqual([]);
  });

  it('keep no memory, so the same state gives the same commands', () => {
    const first = botCommands(thinking(island()), 'careful');
    expect(botCommands(thinking(island()), 'careful')).toEqual(first);
  });

  it('walk for the town gate with the island clear and marks to spend', () => {
    const state = thinking(island());
    clearMonsters(state);
    for (const unit of state.bodies) {
      unit.x = -40;
      unit.z = 20 + unit.id;
    }
    state.family.marks = 1000;
    const [move] = moves(botCommands(state, 'careful'));
    expect(move).toMatchObject(INTO_TOWN);
  });

  it('buy from the list in order, once at the smith', () => {
    const state = createGame(1, TOWN_SCENARIO);
    state.tick = TICKS.autoThink * TICKS.botThink;
    for (const unit of state.bodies) {
      unit.x = -40.6;
      unit.z = unit.id - 4;
    }
    const [first] = botCommands(state, 'careful');
    expect(first).toEqual({ type: 'upgrade', itemId: itemAt(state, SNIPER, 'main-hand').id });
    expect(itemAt(state, FIGHTER, 'main-hand').upgrade).toBe(0);
  });

  it('route across zones by breadth-first search over gates (S3e decision 13)', () => {
    expect(gateRoute('lande', ({ kind }) => kind === 'town')?.map(({ id }) => id)).toEqual(['lande-to-montclaire']);
    expect(gateRoute('lande-cave', ({ kind }) => kind === 'town')?.map(({ id }) => id)).toEqual(['cave-to-lande', 'lande-to-montclaire']);
    expect(gateRoute('lande', ({ id }) => id === 'lande')).toEqual([]);
    expect(gateRoute('lande', () => false)).toBeNull();
    expect(ZONES.length).toBeGreaterThan(1);
  });

  it('with an affordable upgrade on the Lande, reach the smith in Montclaire, upgrade, and return to the Lande', () => {
    const state = thinking(island());
    clearMonsters(state);
    state.family.marks = 200;
    const rifle = itemAt(state, SNIPER, 'main-hand');
    const zones = new Set<string>();
    const events: GameEvent[] = [];
    while (state.tick < 12000 && !(events.some(({ type }) => type === 'upgraded') && state.zoneId === 'lande')) {
      events.push(...step(state, botCommands(state, 'careful')));
      zones.add(state.zoneId);
    }
    expect(zones).toContain('montclaire');
    expect(state.zoneId).toBe('lande');
    expect(rifle.upgrade).toBeGreaterThan(0);
    expect(events.filter(({ type }) => type === 'order-refused')).toEqual([]);
  });

  it('stop buying at the safe level', () => {
    const state = thinking(island());
    clearMonsters(state);
    for (const unit of state.bodies) {
      for (const item of Object.values(characterOf(state, unit.id).items)) {
        if (item) item.upgrade = BOTS.upgradeBelow;
      }
    }
    state.family.marks = 100000;
    expect(botCommands(state, 'careful').map(({ type }) => type)).not.toContain('upgrade');
  });

  it('go to the boss with the marks spent', () => {
    const state = thinking(island());
    clearMonsters(state);
    state.family.marks = 0;
    const [move] = moves(botCommands(state, 'sloppy'));
    expect(move).toMatchObject(BOTS.bossStart);
  });

  it('come back to the camp side first, if they are beyond the beacon', () => {
    const state = thinking(island());
    clearMonsters(state);
    state.family.marks = 0;
    for (const unit of state.bodies) {
      unit.x = 50;
      unit.z = -30 + unit.id;
    }
    expect(moves(botCommands(state, 'sloppy'))[0]).toMatchObject(BOTS.bossApproach);
  });

  describe('in the boss fight', () => {
    function fight(): GameState {
      const state = thinking(island());
      clearMonsters(state);
      bossOf(state).awake = true;
      for (const unit of state.bodies) {
        unit.x = bossOf(state).x + 8;
        unit.z = bossOf(state).z + unit.id * 3;
      }
      return state;
    }

    const spells = (commands: readonly Command[]): string[] => {
      return commands.flatMap((command) => (command.type === 'cast' ? [command.spell] : []));
    };

    it('the careful bot interrupts, and the sloppy one does not', () => {
      const state = fight();
      const { boss } = bossOf(state);
      if (!boss) throw new Error('No boss.');
      boss.castTicks = 50;
      expect(spells(botCommands(state, 'careful'))).toContain('crippling-shot');
      expect(spells(botCommands(state, 'sloppy'))).not.toContain('crippling-shot');
    });

    it('the careful bot scatters from a slam, and regroups after', () => {
      const state = fight();
      state.bodies.forEach((unit) => {
        unit.x = 30;
        unit.z = 30;
      });
      const slam = { kind: 'slam', ticks: 10, totalTicks: 40, enemyId: 1, x: 30, z: 30, radius: 9, hitRadius: 9.4, damage: 1 } as const;
      state.live.scheduled.push(slam);
      expect(botCommands(state, 'careful').map(({ type }) => type)).toContain('scatter');
      expect(botCommands(state, 'sloppy').map(({ type }) => type)).not.toContain('scatter');

      state.live.scheduled.length = 0;
      state.bodies.forEach((unit) => (unit.hold = true));
      state.scatterCooldownTicks = TICKS.scatterCooldown - TICKS.scatterRegroup;
      expect(botCommands(state, 'careful').map(({ type }) => type)).toContain('regroup');
    });

    it('both bots revive, heal and drink', () => {
      for (const kind of ['careful', 'sloppy'] as const) {
        const state = fight();
        const fighter = unitOf(state, FIGHTER);
        fighter.alive = false;
        fighter.health = 0;
        unitOf(state, SNIPER).health = 100;
        const commands = botCommands(state, kind);
        expect(spells(commands)).toEqual(expect.arrayContaining(['revive', 'mend']));
        expect(commands.map(({ type }) => type)).toContain('potion');
      }
    });

    it('do not try a spell that is cooling down', () => {
      const state = fight();
      unitOf(state, SNIPER).spellTicks['aimed-shot'] = 5;
      expect(spells(botCommands(state, 'sloppy'))).not.toContain('aimed-shot');
    });

    it('send no order that would be refused', () => {
      const state = fight();
      const refused = step(state, botCommands(state, 'careful')).filter(({ type }) => type === 'order-refused');
      expect(refused).toEqual([]);
    });
  });
});
