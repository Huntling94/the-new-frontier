import {
  ISLAND_SCENARIO,
  REPLAYS,
  RUNS,
  TICK_RATE,
  botCommands,
  createGame,
  hashState,
  step,
  type BotKind,
  type Command,
  type GameEvent,
  type GameState,
  type GameView,
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

const seedInput = element<HTMLInputElement>('seed');
const gridToggle = element<HTMLInputElement>('grid');

/** What the viewer is playing: a game, how long it runs, and where its commands come from. */
interface Run {
  readonly game: GameState;
  readonly ticks: number;
  readonly commands: (game: GameState) => readonly Command[];
}

const BOTS: Readonly<Record<string, BotKind>> = {
  'live bot, careful': 'careful',
  'live bot, sloppy': 'sloppy',
};

function chosenRun(): Run {
  const name = replaySelect.value || firstName;
  const bot = BOTS[name];
  if (bot) {
    return {
      game: createGame(Number(seedInput.value), ISLAND_SCENARIO),
      ticks: RUNS.tickLimit,
      commands: (view) => botCommands(view, bot),
    };
  }
  const replay = REPLAYS[name];
  if (!replay) {
    throw new Error(`No replay is called ${name}.`);
  }
  return {
    game: createGame(replay.seed, replay.scenario),
    ticks: replay.ticks,
    commands: (view) => replay.entries.find(({ tick }) => tick === view.tick)?.commands ?? [],
  };
}

for (const name of [...Object.keys(BOTS), ...Object.keys(REPLAYS)]) {
  replaySelect.add(new Option(name, name));
}

let run = chosenRun();
let game = run.game;
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
    case 'zone-changed':
      return `${String(event.tick)} the squad went from ${event.from} to ${event.to}`;
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
    case 'squad-returned':
      return `${String(event.tick)} squad back at camp`;
    case 'boss-woken':
      return `${String(event.tick)} the Warden has woken`;
    case 'interrupted':
      return `${String(event.tick)} the Warden was interrupted`;
    case 'loot':
      return `${String(event.tick)} found ${event.kind === 'marks' ? `${String(event.value)} marks` : 'a potion'}`;
    case 'victory':
      return `${String(event.tick)} the Warden is down`;
  }
}

/** Whoever has this ID, for placing a number on the map. */
function placeOf(id: number): { x: number; z: number } | undefined {
  return game.units.find((unit) => unit.id === id) ?? game.live.enemies.find((enemy) => enemy.id === id);
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
      const onEnemy = hit && game.live.enemies.some(({ id }) => id === event.targetId);
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
  for (const event of step(game, run.commands(game))) {
    if (event.type !== 'loot') {
      addToLog(event);
    }
    addMark(event);
  }
  marks = marks.filter(({ until }) => until > game.tick);
}

function showStatus(view: GameView): void {
  element('tick').textContent = `${String(view.tick)} of ${String(run.ticks)}`;
  element('hash').textContent = hashState(view);
  element('squad').textContent = view.units
    .map((unit) => {
      const mana = unit.classId === 'healer' ? `, mana ${String(Math.round(unit.mana))}` : '';
      return `${unit.classId} L${String(unit.level)}: ${String(Math.round(unit.health))} of ${String(unit.maxHealth)}${mana}`;
    })
    .join('\n');
  element('stock').textContent = `${String(view.marks)} marks, ${String(view.potions)} potions`;
  const boss = view.live.enemies.find((enemy) => enemy.boss);
  const cast = boss?.boss && boss.boss.castTicks > 0 ? ', casting' : '';
  const state = view.victory ? 'down' : boss?.awake ? `awake${cast}` : 'asleep';
  element('boss').textContent = boss
    ? `${String(Math.round(boss.health))} of ${String(boss.maxHealth)}, ${state}`
    : view.victory
      ? 'down'
      : 'none';
}

function frame(now: number): void {
  requestAnimationFrame(frame);
  const elapsed = Math.min((now - lastFrame) / 1000, MAX_FRAME_SECONDS);
  lastFrame = now;
  if (!paused) {
    owedSeconds += elapsed * Number(speedSelect.value);
  }
  const over = (): boolean => game.tick >= run.ticks || game.victory;
  while (owedSeconds >= 1 / TICK_RATE && !over()) {
    owedSeconds -= 1 / TICK_RATE;
    runOneTick();
  }
  if (over()) {
    owedSeconds = 0;
  }
  drawGame(context as CanvasRenderingContext2D, game, marks, gridToggle.checked);
  showStatus(game);
}

pauseButton.addEventListener('click', () => {
  paused = !paused;
  pauseButton.textContent = paused ? 'Play' : 'Pause';
});

function restart(): void {
  run = chosenRun();
  game = run.game;
  marks = [];
  owedSeconds = 0;
  log.replaceChildren();
}

element('restart').addEventListener('click', restart);
replaySelect.addEventListener('change', restart);
seedInput.addEventListener('change', restart);

requestAnimationFrame((now) => {
  lastFrame = now;
  frame(now);
});
