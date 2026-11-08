import { createBoss, createDummy, createPack } from './enemies';
import { placeOf } from './family';
import { triangleSlot } from './formation';
import { clearAlong } from './grid';
import type { Enemy, GameEvent, GameState, LiveGroup, Point, Scenario, Body, ZoneRecord } from './state';
import { secondsToTicks } from './time';
import { ZONES } from '../data/zones';
import { contentsOf, gridOf, zoneOf, type GateData } from './world';

/** One record per zone, in data order. A scenario may replace its starting zone's contents. */
export function createRecords(scenario: Scenario): ZoneRecord[] {
  return ZONES.map(({ id }) => ({
    id,
    bossDead: false,
    returns: [],
    contents: id === scenario.zone ? (scenario.contents ?? null) : null,
  }));
}

export function recordOf(state: GameState, zoneId: string = state.zoneId): ZoneRecord {
  const record = state.records.find(({ id }) => id === zoneId);
  if (!record) {
    throw new Error(`No record of zone ${zoneId}.`);
  }
  return record;
}

export function emptyLive(): LiveGroup {
  return { enemies: [], shots: [], enemyShots: [], scheduled: [], drops: [] };
}

/** Packs whose return is due come back at home, and leave the record. */
function bringBackPacks(state: GameState): Enemy[] {
  const record = recordOf(state);
  const { packs } = contentsOf(state);
  const due = record.returns.filter(({ tick }) => tick <= state.tick);
  record.returns = record.returns.filter(({ tick }) => tick > state.tick);
  return due.flatMap(({ packId }) => {
    const pack = packs[packId];
    return pack ? createPack(state, pack, packId) : [];
  });
}

/** Builds the zone's live group fresh: the dummy, packs not away, and the boss unless it is dead. */
function buildLive(state: GameState): LiveGroup {
  const live = emptyLive();
  state.live = live;
  const record = recordOf(state);
  const { dummy, packs, boss } = contentsOf(state);
  if (dummy) {
    live.enemies.push(createDummy(state, dummy));
  }
  record.returns = record.returns.filter(({ tick }) => tick > state.tick);
  packs.forEach((pack, packId) => {
    if (!record.returns.some((away) => away.packId === packId)) {
      live.enemies.push(...createPack(state, pack, packId));
    }
  });
  if (boss && !record.bossDead) {
    live.enemies.push(createBoss(state, boss));
  }
  return live;
}

export function enterZone(state: GameState, zoneId: string): void {
  state.zoneId = zoneId;
  state.live = buildLive(state);
}

/** Runs each tick in the zone that runs: a cleared pack due back appears at home. */
export function updateReturns(state: GameState): void {
  if (recordOf(state).returns.some(({ tick }) => tick <= state.tick)) {
    state.live.enemies.push(...bringBackPacks(state));
  }
}

/** The zone record notes a dead boss, or the last of a pack, so it lasts after leaving. */
export function noteKill(state: GameState, enemy: Enemy): void {
  const record = recordOf(state);
  if (enemy.boss) {
    record.bossDead = true;
  }
  const { packId } = enemy;
  if (packId === null || enemy.minion) {
    return;
  }
  const left = state.live.enemies.some((other) => other.alive && other.packId === packId);
  if (!left) {
    const tick = state.tick + secondsToTicks(zoneOf(state).packRespawnSeconds);
    record.returns.push({ packId, tick });
  }
}

/** Puts each unit at its place in the triangle, pulled in short of any wall. */
export function standInTriangle(state: GameState, unit: Body, centre: Point, heading: number): Point {
  return clearAlong(gridOf(state), centre, triangleSlot(placeOf(state, unit.id), centre, heading));
}

/** A character arrived on an order inside a gate's area, so the whole squad goes through (D-021). */
export function crossGate(state: GameState, gate: GateData, events: GameEvent[]): void {
  const from = state.zoneId;
  enterZone(state, gate.to);
  state.anchor = gate.arrival;
  state.heading = gate.heading;
  state.sharedTargetId = null;
  for (const unit of state.bodies) {
    const { x, z } = standInTriangle(state, unit, gate.arrival, gate.heading);
    Object.assign(unit, {
      x,
      z,
      dest: null,
      hold: false,
      attackMove: false,
      bestDistance: null,
      stuckTicks: 0,
      route: [],
      routeGoal: null,
      dashTicks: 0,
      targetId: null,
      forced: false,
    });
  }
  events.push({ type: 'zone-changed', tick: state.tick, from, to: gate.to });
}
