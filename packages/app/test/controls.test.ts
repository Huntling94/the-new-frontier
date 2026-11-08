import { createGame, ISLAND_SCENARIO, spellsOf, step, type GameState } from '@new-frontier/core';
import { describe, expect, it } from 'vitest';
import { castFor, characterAt, followPoint, orderedIds, pressAction, SPELL_ROWS, spellKey, squadCentre } from '../src/controls';
import { Session } from '../src/session';

/** A family of three Fighters (D-025), built by the core from the scenario's family. */
function threeFighters(): GameState {
  const fighter = { classId: 'fighter', name: 'Fighter' } as const;
  return createGame(3, { ...ISLAND_SCENARIO, family: [fighter, fighter, fighter] });
}

describe('keys (D-031)', () => {
  it('gives each place in the three a row of spell keys', () => {
    expect(pressAction('KeyQ')).toEqual({ kind: 'spell', place: 0, slot: 0 });
    expect(pressAction('KeyR')).toEqual({ kind: 'spell', place: 0, slot: 3 });
    expect(pressAction('KeyS')).toEqual({ kind: 'spell', place: 1, slot: 1 });
    expect(pressAction('KeyV')).toEqual({ kind: 'spell', place: 2, slot: 3 });
  });

  it('selects by F1 to F3, all by F4, and moves the old keys off the grid (D-034)', () => {
    expect(pressAction('F2')).toEqual({ kind: 'select', place: 1 });
    expect(pressAction('F3')).toEqual({ kind: 'select', place: 2 });
    expect(pressAction('F4')).toEqual({ kind: 'select-all' });
    expect(pressAction('Digit1')).toBeNull();
    expect(pressAction('KeyT')).toBeNull();
    expect(pressAction('KeyG')).toEqual({ kind: 'regroup' });
    expect(pressAction('KeyB')).toEqual({ kind: 'scatter' });
    expect(pressAction('Digit5')).toEqual({ kind: 'potion' });
    expect(pressAction('Backspace')).toEqual({ kind: 'reset-view' });
  });

  it('puts the anvil on Y, closes it on Escape, and keeps H and N for help and sound (S2.3b)', () => {
    expect(pressAction('KeyY')).toEqual({ kind: 'anvil' });
    expect(pressAction('Escape')).toEqual({ kind: 'close' });
    expect(pressAction('KeyH')).toEqual({ kind: 'help' });
    expect(pressAction('KeyN')).toEqual({ kind: 'mute' });
    expect(pressAction('KeyE')).toEqual({ kind: 'spell', place: 0, slot: 2 });
  });

  it('labels each spell button with its key', () => {
    expect(spellKey(0, 0)).toBe('Q');
    expect(spellKey(1, 3)).toBe('F');
    expect(spellKey(2, 2)).toBe('C');
    expect(spellKey(2, 4)).toBeNull();
    expect(spellKey(3, 0)).toBeNull();
  });
});

describe('a family of three Fighters', () => {
  it('gives each its own row of spell keys, by place and not class', () => {
    const state = threeFighters();
    const casts = SPELL_ROWS.map((_, place) => castFor(state, place, 0, null));
    expect(casts.map((cast) => cast?.type === 'cast' && cast.unitId)).toEqual(state.bodies.map(({ id }) => id));
    expect(casts.every((cast) => cast?.type === 'cast' && cast.spell === 'taunt')).toBe(true);
  });

  it('casts for all three in the core, each from its own character', () => {
    const state = threeFighters();
    const casts = SPELL_ROWS.map((_, place) => castFor(state, place, 1, null)).filter((cast) => cast !== null);
    const events = step(state, casts);
    const cast = events.filter((event) => event.type === 'spell-cast');
    expect(cast.map((event) => event.type === 'spell-cast' && event.unitId)).toEqual(state.bodies.map(({ id }) => id));
  });

  it('selects each one alone by its place', () => {
    const state = threeFighters();
    const session = new Session(3, null);
    Object.assign(session.state, { units: state.bodies });
    for (let place = 0; place < 3; place += 1) {
      session.act({ kind: 'select', place }, null);
      expect([...session.selected]).toEqual([characterAt(state, place)]);
    }
  });
});

describe('orders', () => {
  it('a slot past the end of a spell list does nothing', () => {
    const state = createGame(1, ISLAND_SCENARIO);
    expect(spellsOf(state, 1)).toHaveLength(3);
    expect(castFor(state, 0, 3, null)).toBeNull();
  });

  it('aims at the point under the cursor', () => {
    const state = createGame(1, ISLAND_SCENARIO);
    expect(castFor(state, 1, 2, { x: 4, z: 5 })).toEqual({ type: 'cast', unitId: 2, spell: 'volley', point: { x: 4, z: 5 } });
  });

  it('orders the selected who are up, or everyone up if none are', () => {
    const state = createGame(1, ISLAND_SCENARIO);
    expect(orderedIds(state, new Set([2]))).toEqual([2]);
    const two = state.bodies[1];
    if (two) two.alive = false;
    expect(orderedIds(state, new Set([2]))).toEqual([1, 3]);
  });

  it('Space puts only the selected characters into auto-combat (D-035)', () => {
    const session = new Session(1, null);
    session.selectOnly([1]);
    session.act({ kind: 'auto' }, null);
    expect([...session.autoIds]).toEqual([1]);
    expect([...session.selected]).toEqual([1]);
    session.selectOnly([2, 3]);
    session.act({ kind: 'auto' }, null);
    expect([...session.autoIds].sort()).toEqual([1, 2, 3]);
    session.act({ kind: 'auto' }, null);
    expect([...session.autoIds]).toEqual([1]);
  });

  it('an order takes only the ordered characters out of auto-combat', () => {
    const session = new Session(1, null);
    session.act({ kind: 'auto' }, null);
    expect(session.autoIds.size).toBe(3);
    session.selectOnly([2]);
    session.moveTo({ x: 0, z: 40 }, false);
    expect([...session.autoIds].sort()).toEqual([1, 3]);
    expect(session.move).toMatchObject({ x: 0, z: 40, attack: false });
    session.act({ kind: 'regroup' }, null);
    expect(session.auto).toBe(false);
  });

  it('a lone character on auto-combat is sent off without the others', () => {
    const session = new Session(1, null);
    session.selectOnly([2]);
    session.act({ kind: 'auto' }, null);
    let moved: number[] = [];
    for (let tick = 0; tick < 30 && moved.length === 0; tick += 1) {
      session.tick();
      moved = session.state.bodies.filter((unit) => unit.dest !== null).map(({ id }) => id);
    }
    expect(moved).toEqual([2]);
  });
});

describe('what the camera follows (D-037)', () => {
  it('follows one selected character on their own, and the squad otherwise', () => {
    const state = createGame(3, ISLAND_SCENARIO);
    const [first, second] = state.bodies;
    if (!first || !second) throw new Error('No units.');
    expect(followPoint(state, new Set([first.id]))).toEqual({ x: first.x, z: first.z });
    expect(followPoint(state, new Set([first.id, second.id]))).toEqual(squadCentre(state));
    first.alive = false;
    expect(followPoint(state, new Set([first.id]))).toEqual(squadCentre(state));
  });
});
