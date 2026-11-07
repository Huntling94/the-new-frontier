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
import { drawGame } from './draw';

const LOG_LENGTH = 16;
/** Longest frame the viewer catches up on, so a hidden tab does not race afterwards. */
const MAX_FRAME_SECONDS = 0.25;

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) {
    throw new Error(`The page has no #${id} element.`);
  }
  return found as T;
}

const [replay] = Object.values(REPLAYS) as [Replay];
const canvas = element<HTMLCanvasElement>('map');
const context = canvas.getContext('2d');
if (!context) {
  throw new Error('This browser has no 2D canvas.');
}
const pauseButton = element<HTMLButtonElement>('pause');
const speedSelect = element<HTMLSelectElement>('speed');
const log = element<HTMLOListElement>('log');

let game: GameState = createGame(replay.seed, replay.scenario);
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
  step(game, entry?.commands ?? []).forEach(addToLog);
}

function showStatus(view: GameView): void {
  element('tick').textContent = `${String(view.tick)} of ${String(replay.ticks)}`;
  element('hash').textContent = hashState(view);
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
  drawGame(context as CanvasRenderingContext2D, game);
  showStatus(game);
}

pauseButton.addEventListener('click', () => {
  paused = !paused;
  pauseButton.textContent = paused ? 'Play' : 'Pause';
});

element('restart').addEventListener('click', () => {
  game = createGame(replay.seed, replay.scenario);
  owedSeconds = 0;
  log.replaceChildren();
});

requestAnimationFrame((now) => {
  lastFrame = now;
  frame(now);
});
