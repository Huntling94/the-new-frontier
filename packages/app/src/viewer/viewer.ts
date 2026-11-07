import {
  REPLAYS,
  TICK_RATE,
  createGame,
  hashState,
  step,
  type GameEvent,
  type GameState,
  type GameView,
  type Replay,
} from '@new-frontier/core';
import { drawGame, type Mark } from './draw';

const LOG_LENGTH = 22;
/** How long a word or number stays on the map. */
const MARK_TICKS = 24;
const HIT_COLOUR = '#ffffff';
const HURT_COLOUR = '#ff7a62';
const HEAL_COLOUR = '#9be8a6';
const SPELL_COLOUR = '#ffd089';
/** Longest frame the viewer catches up on, so a hidden tab does not race afterwards. */
const MAX_FRAME_SECONDS = 0.25;

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) {
    throw new Error(`The page has no #${id} element.`);
  }
  return found as T;
}

const [firstName] = Object.keys(REPLAYS) as [string];
const canvas = element<HTMLCanvasElement>('map');
const context = canvas.getContext('2d');
if (!context) {
  throw new Error('This browser has no 2D canvas.');
}
const pauseButton = element<HTMLButtonElement>('pause');
const speedSelect = element<HTMLSelectElement>('speed');
const replaySelect = element<HTMLSelectElement>('replay');
const log = element<HTMLOListElement>('log');

function chosenReplay(): Replay {
  return REPLAYS[replaySelect.value || firstName] as Replay;
}

for (const name of Object.keys(REPLAYS)) {
  replaySelect.add(new Option(name, name));
}

let replay = chosenReplay();
let game: GameState = createGame(replay.seed, replay.scenario);
let marks: Mark[] = [];
let paused = false;
let owedSeconds = 0;
let lastFrame = 0;

function describe(event: GameEvent): string {
  switch (event.type) {
    case 'order-accepted':
      return `${String(event.tick)} ${event.order}`;
    case 'order-refused':
      return `${String(event.tick)} ${event.order} refused: ${event.reason}`;
    case 'unit-arrived':
      return `${String(event.tick)} unit ${String(event.unitId)} arrived`;
    case 'unit-gave-up':
      return `${String(event.tick)} unit ${String(event.unitId)} gave up`;
    case 'hit':
      return `${String(event.tick)} ${String(event.sourceId)} hit ${String(event.targetId)} for ${String(event.amount)}${event.crit ? ' (crit)' : ''}`;
    case 'healed':
      return `${String(event.tick)} unit ${String(event.unitId)} healed ${String(Math.round(event.amount))}`;
    case 'spell-cast':
      return `${String(event.tick)} unit ${String(event.unitId)} cast ${event.spell}`;
    case 'level-up':
      return `${String(event.tick)} unit ${String(event.unitId)} reached level ${String(event.level)}`;
    case 'unit-down':
      return `${String(event.tick)} unit ${String(event.unitId)} is down`;
    case 'enemy-down':
      return `${String(event.tick)} enemy ${String(event.enemyId)} is down`;
    case 'unit-revived':
      return `${String(event.tick)} unit ${String(event.unitId)} revived`;
    case 'upgraded':
      return `${String(event.tick)} unit ${String(event.unitId)} ${event.slot} now +${String(event.level)}`;
    case 'item-destroyed':
      return `${String(event.tick)} unit ${String(event.unitId)} ${event.slot} +${String(event.level)} destroyed`;
    case 'squad-down':
      return `${String(event.tick)} squad down`;
  }
}

/** Whoever has this ID, for placing a number on the map. */
function placeOf(id: number): { x: number; z: number } | undefined {
  return game.units.find((unit) => unit.id === id) ?? game.enemies.find((enemy) => enemy.id === id);
}

function addMark(event: GameEvent): void {
  const until = game.tick + MARK_TICKS;
  if (event.type === 'spell-cast') {
    const { x, z, spell } = event;
    marks.push({ x, z, text: spell, colour: SPELL_COLOUR, until, ring: true });
  } else if (event.type === 'hit' || event.type === 'healed') {
    const hit = event.type === 'hit';
    const place = placeOf(hit ? event.targetId : event.unitId);
    if (place) {
      const onEnemy = hit && game.enemies.some(({ id }) => id === event.targetId);
      const colour = hit ? (onEnemy ? HIT_COLOUR : HURT_COLOUR) : HEAL_COLOUR;
      const text = String(Math.round(event.amount));
      marks.push({ x: place.x, z: place.z, text, colour, until, ring: false });
    }
  }
}

function addToLog(event: GameEvent): void {
  const line = document.createElement('li');
  line.textContent = describe(event);
  log.prepend(line);
  while (log.children.length > LOG_LENGTH) {
    log.lastElementChild?.remove();
  }
}

function runOneTick(): void {
  const entry = replay.entries.find(({ tick }) => tick === game.tick);
  for (const event of step(game, entry?.commands ?? [])) {
    addToLog(event);
    addMark(event);
  }
  marks = marks.filter(({ until }) => until > game.tick);
}

function showStatus(view: GameView): void {
  element('tick').textContent = `${String(view.tick)} of ${String(replay.ticks)}`;
  element('hash').textContent = hashState(view);
  element('squad').textContent = view.units
    .map((unit) => {
      const mana = unit.classId === 'healer' ? `, mana ${String(Math.round(unit.mana))}` : '';
      return `${unit.classId} L${String(unit.level)}: ${String(Math.round(unit.health))} of ${String(unit.maxHealth)}${mana}`;
    })
    .join('\n');
  element('stock').textContent = `${String(view.marks)} marks, ${String(view.potions)} potions`;
}

function frame(now: number): void {
  requestAnimationFrame(frame);
  const elapsed = Math.min((now - lastFrame) / 1000, MAX_FRAME_SECONDS);
  lastFrame = now;
  if (!paused) {
    owedSeconds += elapsed * Number(speedSelect.value);
  }
  while (owedSeconds >= 1 / TICK_RATE && game.tick < replay.ticks) {
    owedSeconds -= 1 / TICK_RATE;
    runOneTick();
  }
  if (game.tick === replay.ticks) {
    owedSeconds = 0;
  }
  drawGame(context as CanvasRenderingContext2D, game, marks);
  showStatus(game);
}

pauseButton.addEventListener('click', () => {
  paused = !paused;
  pauseButton.textContent = paused ? 'Play' : 'Pause';
});

function restart(): void {
  replay = chosenReplay();
  game = createGame(replay.seed, replay.scenario);
  marks = [];
  owedSeconds = 0;
  log.replaceChildren();
}

element('restart').addEventListener('click', restart);
replaySelect.addEventListener('change', restart);

requestAnimationFrame((now) => {
  lastFrame = now;
  frame(now);
});
