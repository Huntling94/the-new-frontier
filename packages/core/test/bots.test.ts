import { describe, expect, it } from 'vitest';
import { BOTS } from '../data/bots';
import { ISLAND_SCENARIO } from '../data/scenarios';
import { ZONES } from '../data/zones';
import { autoCommands } from '../src/auto';
import { botCommands } from '../src/bots';
import { createGame, step } from '../src/game';
import type { Command, GameState, MoveCommand } from '../src/state';
import { TICKS } from '../src/time';
import { FIGHTER, HEALER, SNIPER, unitOf } from './helpers';

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

function bossOf(state: GameState): GameState['enemies'][number] {
  const boss = state.enemies.find((enemy) => enemy.boss);
  if (!boss) throw new Error('No boss.');
  return boss;
}

function moves(commands: readonly Command[]): MoveCommand[] {
  return commands.filter((command): command is MoveCommand => command.type === 'move');
}

function clearMonsters(state: GameState): void {
  state.enemies = state.enemies.filter((enemy) => enemy.boss);
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
    state.drops.push({ id: 900, kind: 'marks', value: 1, x: 40, z: 40, speedX: 0, speedZ: 0, flightTicks: 0, ageTicks: 0 });
    expect(moves(autoCommands(state).commands)[0]).toMatchObject({ x: 40, z: 40 });
  });

  it('leaves an old drop', () => {
    const state = thinking(island());
    state.drops.push({ id: 900, kind: 'marks', value: 1, x: 40, z: 40, speedX: 0, speedZ: 0, flightTicks: 0, ageTicks: TICKS.dropLife });
    expect(moves(autoCommands(state).commands)[0]).not.toMatchObject({ x: 40, z: 40 });
  });

  it('waits while it fights', () => {
    const state = thinking(island());
    const [monster] = state.enemies;
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
    const [monster] = state.enemies;
    if (!monster) throw new Error('No monster.');
    monster.awake = true;
    for (const unit of state.units) {
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
    state.enemies.push({ ...bossOf(state), id: 900, boss: null, kind: 'runner', x: 0, z: -60 });
    for (const unit of state.units) {
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
    expect(result.commands).toContainEqual({ type: 'target', unitIds: state.units.map(({ id }) => id), enemyId: boss.id });

    // Characters already fighting or walking are left alone.
    unitOf(state, FIGHTER).targetId = boss.id;
    const rest = autoCommands(state).commands.find(({ type }) => type === 'target');
    expect(rest).toEqual({ type: 'target', unitIds: [SNIPER, HEALER], enemyId: boss.id });
  });

  it('stops for a stated reason', () => {
    const danger = thinking(island());
    danger.potions = 0;
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
    state.potions = 0;
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

  it('walk to the anvil with the island clear and marks to spend', () => {
    const state = thinking(island());
    clearMonsters(state);
    for (const unit of state.units) {
      unit.x = -40;
      unit.z = 20 + unit.id;
    }
    state.marks = 1000;
    const [move] = moves(botCommands(state, 'careful'));
    expect(move).toMatchObject(ZONES[0]?.anvil ?? {});
  });

  it('buy from the list only at the anvil', () => {
    const state = thinking(island());
    clearMonsters(state);
    const [first] = botCommands(state, 'careful');
    expect(first).toEqual({ type: 'upgrade', unitId: SNIPER, slot: 'weapon' });
    expect(state.units[0]?.gear.weapon.upgrade).toBe(0);
  });

  it('stop buying at the safe level', () => {
    const state = thinking(island());
    clearMonsters(state);
    for (const unit of state.units) {
      for (const item of Object.values(unit.gear)) {
        item.upgrade = BOTS.upgradeBelow;
      }
    }
    state.marks = 100000;
    expect(botCommands(state, 'careful').map(({ type }) => type)).not.toContain('upgrade');
  });

  it('go to the boss with the marks spent', () => {
    const state = thinking(island());
    clearMonsters(state);
    state.marks = 0;
    const [move] = moves(botCommands(state, 'sloppy'));
    expect(move).toMatchObject(BOTS.bossStart);
  });

  it('come back to the camp side first, if they are beyond the beacon', () => {
    const state = thinking(island());
    clearMonsters(state);
    state.marks = 0;
    for (const unit of state.units) {
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
      for (const unit of state.units) {
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
      state.units.forEach((unit) => {
        unit.x = 30;
        unit.z = 30;
      });
      const slam = { kind: 'slam', ticks: 10, totalTicks: 40, enemyId: 1, x: 30, z: 30, radius: 9, hitRadius: 9.4, damage: 1 } as const;
      state.scheduled.push(slam);
      expect(botCommands(state, 'careful').map(({ type }) => type)).toContain('scatter');
      expect(botCommands(state, 'sloppy').map(({ type }) => type)).not.toContain('scatter');

      state.scheduled.length = 0;
      state.units.forEach((unit) => (unit.hold = true));
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
