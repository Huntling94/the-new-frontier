import { LEVELS, POTIONS } from '../data/combat';
import { MARKS } from '../data/gear';
import { CLASSES, SQUAD } from '../data/squad';
import { removeMinions, resetBoss } from './boss';
import { createBoss, createDummy, createPack, updateEnemy } from './enemies';
import { triangleSlot } from './formation';
import { updateDrops } from './loot';
import { updateUnit } from './movement';
import { applyCommands } from './orders';
import { updateScheduled, updateShots } from './shots';
import { createGear, recalculate } from './stats';
import type { ClassId, Command, GameEvent, GameState, Scenario, Unit } from './state';
import { buildZones } from './world';

function createUnit(state: GameState, classId: ClassId, scenario: Scenario): Unit {
  const { startOffset, mana } = CLASSES[classId];
  const id = state.nextId;
  state.nextId += 1;
  const unit: Unit = {
    id,
    classId,
    alive: true,
    x: scenario.squadStart.x + startOffset.x,
    z: scenario.squadStart.z + startOffset.z,
    dest: null,
    hold: false,
    attackMove: false,
    bestDistance: null,
    stuckTicks: 0,
    dashTicks: 0,
    dashX: 0,
    dashZ: 0,
    invulnerableTicks: 0,
    level: LEVELS.start,
    xp: 0,
    health: 0,
    mana,
    gear: createGear(classId),
    maxHealth: 0,
    attack: 0,
    ar: 0,
    crit: 0,
    defence: 0,
    dr: 0,
    targetId: null,
    forced: false,
    attackTicks: 0,
    spellTicks: {},
    guardTicks: 0,
    rallyTicks: 0,
  };
  recalculate(unit);
  return unit;
}

/** Builds the starting state. The same seed and scenario always build the same game. */
export function createGame(seed: number, scenario: Scenario): GameState {
  const state: GameState = {
    tick: 0,
    rng: seed >>> 0,
    nextId: 1,
    units: [],
    zones: [],
    anchor: scenario.squadStart,
    heading: scenario.squadHeading,
    scatterCooldownTicks: 0,
    enemies: [],
    shots: [],
    enemyShots: [],
    scheduled: [],
    drops: [],
    sharedTargetId: null,
    marks: MARKS.start,
    potions: POTIONS.start,
    potionCooldownTicks: 0,
    squadDown: false,
    wipeTicks: 0,
    victory: false,
    camp: scenario.squadStart,
    campHeading: scenario.squadHeading,
  };
  state.zones = buildZones(state);
  state.units = SQUAD.map((classId) => createUnit(state, classId, scenario));
  if (scenario.dummy) {
    state.enemies.push(createDummy(state, scenario.dummy));
  }
  scenario.packs.forEach((pack, packId) => {
    state.enemies.push(...createPack(state, pack, packId));
  });
  if (scenario.boss) {
    state.enemies.push(createBoss(state, scenario.boss));
  }
  return state;
}

function runRules(state: GameState, events: GameEvent[]): void {
  state.scatterCooldownTicks = Math.max(0, state.scatterCooldownTicks - 1);
  state.potionCooldownTicks = Math.max(0, state.potionCooldownTicks - 1);
  for (const unit of state.units) {
    updateUnit(state, unit, events);
  }
  for (const enemy of state.enemies) {
    updateEnemy(state, enemy, events);
  }
  updateShots(state, events);
  updateDrops(state, events);
  updateScheduled(state, events);
  state.enemies = state.enemies.filter((enemy) => enemy.alive || enemy.kind === 'dummy');
}

/** Everyone gets up at camp, whole. Marks, XP and hurt monsters all stay (S2.2c). */
function returnToCamp(state: GameState, events: GameEvent[]): void {
  state.anchor = state.camp;
  state.heading = state.campHeading;
  state.squadDown = false;
  state.sharedTargetId = null;
  state.shots = [];
  state.enemyShots = [];
  state.scheduled = [];
  for (const unit of state.units) {
    const { x, z } = triangleSlot(unit.classId, state.camp, state.campHeading);
    Object.assign(unit, {
      alive: true,
      x,
      z,
      dest: null,
      hold: false,
      attackMove: false,
      bestDistance: null,
      stuckTicks: 0,
      dashTicks: 0,
      invulnerableTicks: 0,
      health: unit.maxHealth,
      mana: CLASSES[unit.classId].mana,
      targetId: null,
      forced: false,
      attackTicks: 0,
      spellTicks: {},
      guardTicks: 0,
      rallyTicks: 0,
    });
  }
  removeMinions(state);
  state.enemies.forEach(resetBoss);
  events.push({ type: 'squad-returned', tick: state.tick });
}

/**
 * Runs one tick. Units update in ID order. While the squad is down, or once the
 * boss is dead, the tick still counts, because replays and the viewer rely on it.
 */
export function advance(state: GameState): GameEvent[] {
  const events: GameEvent[] = [];
  if (state.squadDown) {
    state.wipeTicks -= 1;
    if (state.wipeTicks <= 0) {
      returnToCamp(state, events);
    }
  } else if (!state.victory) {
    runRules(state, events);
  }
  state.tick += 1;
  return events;
}

/** Commands land at the start of the tick, then the tick runs. */
export function step(state: GameState, commands: readonly Command[]): GameEvent[] {
  return [...applyCommands(state, commands), ...advance(state)];
}
