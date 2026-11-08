import { botCommands, characterOf, createGame, ISLAND_SCENARIO, step, TICK_RATE, type GameEvent, type GameState, TOWN_SCENARIO } from '@new-frontier/core';
import { describe, expect, it } from 'vitest';
import { addShake, createCamera, poseOf, shakePose } from '../src/camera';
import { Clock } from '../src/clock';
import { FEEL } from '../src/feel';
import { Reactions } from '../src/reactions';
import { Session } from '../src/session';

const TICK = 1 / TICK_RATE;

function game(): GameState {
  return createGame(1, ISLAND_SCENARIO);
}

function enemyId(state: GameState): number {
  const enemy = state.live.enemies.find(({ boss }) => !boss);
  if (!enemy) throw new Error('No enemy.');
  return enemy.id;
}

describe('hit-stop slows the clock, not the rules (decision 2)', () => {
  it('runs ticks at 15% for 0.05 game seconds, then at full speed', () => {
    const plain = new Clock();
    const stopped = new Clock();
    stopped.hitStop();
    let plainTicks = 0;
    let stoppedTicks = 0;
    for (let frame = 0; frame < 6; frame += 1) {
      plainTicks += plain.advance(1 / 60, false);
      stoppedTicks += stopped.advance(1 / 60, false);
    }
    // Six frames of 1/60 s: three ticks in plain time, and fewer while the hit-stop lasts.
    expect(plainTicks).toBe(3);
    expect(stoppedTicks).toBeLessThan(plainTicks);
    // Once it is over, the clock runs at full speed again.
    const before = stoppedTicks;
    for (let frame = 0; frame < 60; frame += 1) stoppedTicks += stopped.advance(1 / 60, false);
    expect(stoppedTicks - before).toBeGreaterThanOrEqual(TICK_RATE / 2 - 1);
    expect(FEEL.hitStop).toEqual({ seconds: 0.05, share: 0.15 });
  });
});

describe('camera shake (decision 14)', () => {
  it('keeps the strongest shake, jolts the eye only sideways, and fades at 2.4 a second', () => {
    const camera = createCamera({ x: 0, z: 0 });
    addShake(camera, FEEL.shake.slam);
    addShake(camera, FEEL.shake.hurt);
    expect(camera.shake).toBe(0.7);
    const still = poseOf(camera, 0);
    const shaken = shakePose(camera, still, 0.1, () => 1, false);
    expect(shaken.eye.x - still.eye.x).toBeCloseTo(0.7 * 0.7 * FEEL.shake.reach);
    expect(shaken.eye.y).toBe(still.eye.y);
    expect(shaken.target).toEqual(still.target);
    expect(camera.shake).toBeCloseTo(0.7 - 0.24);
  });

  it('never jolts when the player asks for reduced motion', () => {
    const camera = createCamera({ x: 0, z: 0 });
    addShake(camera, 1);
    const still = poseOf(camera, 0);
    expect(shakePose(camera, still, TICK, () => 1, true)).toBe(still);
  });
});

describe('reactions turn events into feel', () => {
  it('plays a crit with hit-stop, and a hurt character with a small shake', () => {
    const state = game();
    const reactions = new Reactions();
    reactions.remember(state);
    const [unit] = state.bodies;
    if (!unit) throw new Error('No unit.');
    const enemy = enemyId(state);
    const events: GameEvent[] = [
      { type: 'hit', tick: 0, sourceId: unit.id, targetId: enemy, amount: 120, crit: true },
      { type: 'hit', tick: 0, sourceId: enemy, targetId: unit.id, amount: 40, crit: false },
    ];
    const reaction = reactions.react(state, events);
    expect(reaction.sounds).toEqual(expect.arrayContaining(['crit', 'hurt']));
    expect(reaction.hitStop).toBe(true);
    expect(reaction.shake).toBe(FEEL.shake.hurt);
  });

  it('shakes when a slam lands, but not when a reset clears it early', () => {
    const state = game();
    const reactions = new Reactions();
    const slam = { kind: 'slam' as const, ticks: 1, totalTicks: 40, enemyId: 0, x: 0, z: 0, radius: 9, hitRadius: 9.4, damage: 1 };
    state.live.scheduled.push(slam);
    reactions.remember(state);
    slam.ticks = 0;
    state.live.scheduled = [];
    expect(reactions.react(state, []).shake).toBe(FEEL.shake.slam);

    const early = { ...slam, ticks: 20 };
    state.live.scheduled = [early];
    reactions.remember(state);
    state.live.scheduled = [];
    expect(reactions.react(state, []).shake).toBe(0);
  });

  it('names who killed the squad, and counts wipes for the victory screen', () => {
    const state = game();
    const reactions = new Reactions();
    reactions.remember(state);
    const [unit] = state.bodies;
    if (!unit) throw new Error('No unit.');
    const enemy = enemyId(state);
    const reaction = reactions.react(state, [
      { type: 'hit', tick: 0, sourceId: enemy, targetId: unit.id, amount: 400, crit: false },
      { type: 'unit-down', tick: 0, unitId: unit.id },
      { type: 'squad-down', tick: 0 },
    ]);
    expect(reaction.log.map(({ text }) => text)).toContain('Aurelio is down. No XP while down.');
    expect(reaction.log.at(-1)?.text).toMatch(/^You died to a .+ \(lvl \d+\)\. You are being teleported back to: camp$/);
    expect(reaction.banner?.title).toBe('Squad down');
    expect(reactions.tally).toMatchObject({ wipes: 1, downs: 1 });
  });

  it('follows a whole bot run to victory, shaking for slams, blasts and the boss', () => {
    const state = game();
    const reactions = new Reactions();
    const shakes = new Set<number>();
    let victory = false;
    let banners = 0;
    for (let tick = 0; tick < TICK_RATE * 60 * 30 && !victory; tick += 1) {
      reactions.remember(state);
      const reaction = reactions.react(state, step(state, botCommands(state, 'careful')));
      if (reaction.shake > 0) shakes.add(reaction.shake);
      if (reaction.banner) banners += 1;
      victory = reaction.victory;
    }
    expect(victory).toBe(true);
    expect(shakes).toContain(FEEL.shake.boss);
    expect(shakes).toContain(FEEL.shake.slam);
    expect(banners).toBeGreaterThanOrEqual(2);
  });
});

describe('the session notes the player’s own orders', () => {
  it('says when auto-combat goes on and off, and when a spell is short of mana', () => {
    const session = new Session(1, null);
    session.act({ kind: 'auto' }, null);
    session.act({ kind: 'auto' }, null);
    expect(session.notes.map(({ text }) => text)).toEqual(['Auto-combat on', 'Auto-combat off']);
    session.notes.length = 0;
    const healer = session.state.bodies.find(({ id }) => characterOf(session.state, id).classId === 'healer');
    if (!healer) throw new Error('No Healer.');
    healer.mana = 0;
    session.act({ kind: 'spell', place: session.state.bodies.indexOf(healer), slot: 1 }, null);
    session.tick();
    expect(session.notes.map(({ text }) => text)).toEqual([`${characterOf(session.state, healer.id).name}: not enough mana`]);
  });

  it('applies an upgrade at once, with no tick passing (decision 4)', () => {
    const session = new Session(1, null, TOWN_SCENARIO);
    const [unit] = session.state.bodies;
    if (!unit) throw new Error('No unit.');
    for (const body of session.state.bodies) {
      body.x = -40.6;
      body.z = -4;
    }
    const held = characterOf(session.state, unit.id).items['main-hand'];
    if (!held) throw new Error('Nothing held.');
    const tick = session.state.tick;
    const events = session.applyNow([{ type: 'upgrade', itemId: held.id }]);
    expect(events.map(({ type }) => type)).toEqual(['order-accepted', 'upgraded']);
    expect(session.state.tick).toBe(tick);
    expect(held.upgrade).toBe(1);
  });
});
