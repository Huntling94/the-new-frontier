import { LEVELS, NO_RESISTANCE, POTIONS } from '../data/combat';
import { MARKS } from '../data/gear';
import { STARTING_INVENTORY } from '../data/items';
import { CLASSES, FORMATION, STARTING_FAMILY } from '../data/squad';
import { removeMinions, resetBoss } from './boss';
import { updateEnemy } from './enemies';
import { updateDrops } from './loot';
import { updateUnit } from './movement';
import { applyCommands } from './orders';
import { updateScheduled, updateShots } from './shots';
import { createItem, startingItems } from './items';
import { recalculate } from './stats';
import { characterOf, classOf } from './family';
import type { Body, Character, CharacterStart, Command, GameEvent, GameState, Point, Scenario } from './state';
import { gateAt, zoneOf } from './world';
import {
  createRecords,
  crossGate,
  emptyLive,
  enterZone,
  standInTriangle,
  updateReturns,
} from './zones';

/** A character from the starting family, with the next ID (decision 2). */
function createCharacter(state: GameState, start: CharacterStart): Character {
  const id = state.nextId;
  state.nextId += 1;
  return {
    id,
    name: start.name,
    classId: start.classId,
    level: LEVELS.start,
    xp: 0,
    arts: [...CLASSES[start.classId].arts],
    items: startingItems(state, start.classId),
  };
}

/** A character's body at its place in the triangle, from the scenario's starting point. */
function startingPoint(place: number, scenario: Scenario): Point {
  const { startOffset } = FORMATION[place] ?? { startOffset: { x: 0, z: 0 } };
  return { x: scenario.squadStart.x + startOffset.x, z: scenario.squadStart.z + startOffset.z };
}

/**
 * A character's body standing at a point, whole and with no orders, timers or target.
 * Its stats come from the character's level and items (decision 14).
 */
export function createBody(character: Character, point: Point): Body {
  const body: Body = {
    id: character.id,
    alive: true,
    x: point.x,
    z: point.z,
    dest: null,
    hold: false,
    attackMove: false,
    bestDistance: null,
    stuckTicks: 0,
    route: [],
    routeGoal: null,
    dashTicks: 0,
    dashX: 0,
    dashZ: 0,
    invulnerableTicks: 0,
    health: 0,
    mana: CLASSES[character.classId].mana,
    maxHealth: 0,
    attack: 0,
    attackSeconds: 0,
    ar: 0,
    crit: 0,
    defence: 0,
    dr: 0,
    evade: 0,
    block: 0,
    resistances: NO_RESISTANCE,
    targetId: null,
    forced: false,
    attackTicks: 0,
    spellTicks: {},
    guardTicks: 0,
    rallyTicks: 0,
  };
  recalculate(character, body);
  return body;
}

/** Builds the starting state. The same seed and scenario always build the same game. */
export function createGame(seed: number, scenario: Scenario): GameState {
  const state: GameState = {
    tick: 0,
    rng: seed >>> 0,
    nextId: 1,
    nextItemId: 1,
    family: { characters: [], active: [], inventory: [], marks: MARKS.start, potions: POTIONS.start },
    bodies: [],
    zoneId: scenario.zone,
    records: createRecords(scenario),
    live: emptyLive(),
    anchor: scenario.squadStart,
    heading: scenario.squadHeading,
    scatterCooldownTicks: 0,
    sharedTargetId: null,
    potionCooldownTicks: 0,
    squadDown: false,
    wipeTicks: 0,
  };
  const characters = (scenario.family ?? STARTING_FAMILY).map((start) => createCharacter(state, start));
  state.family.characters = characters;
  state.family.inventory = STARTING_INVENTORY.map((typeId) => createItem(state, typeId));
  state.family.active = characters.slice(0, FORMATION.length).map(({ id }) => id);
  state.bodies = state.family.active.map((id, place) => createBody(characterOf(state, id), startingPoint(place, scenario)));
  enterZone(state, scenario.zone);
  return state;
}

/** The first character this tick to arrive on an order inside a gate's area, and that gate. */
function arrivedAtGate(state: GameState, events: readonly GameEvent[]): ReturnType<typeof gateAt> {
  for (const event of events) {
    const unit = event.type === 'unit-arrived' ? state.bodies.find(({ id }) => id === event.unitId) : null;
    const gate = unit?.alive ? gateAt(state, unit) : null;
    if (gate) {
      return gate;
    }
  }
  return null;
}

function runRules(state: GameState, events: GameEvent[]): void {
  state.scatterCooldownTicks = Math.max(0, state.scatterCooldownTicks - 1);
  state.potionCooldownTicks = Math.max(0, state.potionCooldownTicks - 1);
  updateReturns(state);
  const moved: GameEvent[] = [];
  for (const unit of state.bodies) {
    updateUnit(state, unit, moved);
  }
  events.push(...moved);
  const gate = arrivedAtGate(state, moved);
  if (gate) {
    // The zone left behind is dropped, so nothing in it acts this tick.
    crossGate(state, gate, events);
    return;
  }
  const { live } = state;
  for (const enemy of live.enemies) {
    updateEnemy(state, enemy, events);
  }
  updateShots(state, events);
  updateDrops(state, events);
  updateScheduled(state, events);
  live.enemies = live.enemies.filter((enemy) => enemy.alive || enemy.kind === 'dummy');
}

/** Everyone gets up at the zone's camp, whole. Marks, XP and hurt monsters all stay (S2.2c). */
function returnToCamp(state: GameState, events: GameEvent[]): void {
  const { camp } = zoneOf(state);
  state.anchor = { x: camp.x, z: camp.z };
  state.heading = camp.heading;
  state.squadDown = false;
  state.sharedTargetId = null;
  state.live.shots = [];
  state.live.enemyShots = [];
  state.live.scheduled = [];
  for (const unit of state.bodies) {
    const { x, z } = standInTriangle(state, unit, camp, camp.heading);
    Object.assign(unit, {
      alive: true,
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
      invulnerableTicks: 0,
      health: unit.maxHealth,
      mana: classOf(state, unit.id).mana,
      targetId: null,
      forced: false,
      attackTicks: 0,
      spellTicks: {},
      guardTicks: 0,
      rallyTicks: 0,
    });
  }
  removeMinions(state);
  state.live.enemies.forEach(resetBoss);
  events.push({ type: 'squad-returned', tick: state.tick });
}

/**
 * Runs one tick. Units update in ID order. While the squad is down, the tick
 * still counts, because replays and the viewer rely on it.
 */
export function advance(state: GameState): GameEvent[] {
  const events: GameEvent[] = [];
  if (state.squadDown) {
    state.wipeTicks -= 1;
    if (state.wipeTicks <= 0) {
      returnToCamp(state, events);
    }
  } else {
    runRules(state, events);
  }
  state.tick += 1;
  return events;
}

/** Commands land at the start of the tick, then the tick runs. */
export function step(state: GameState, commands: readonly Command[]): GameEvent[] {
  return [...applyCommands(state, commands), ...advance(state)];
}
