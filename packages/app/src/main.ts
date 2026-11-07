import { currentZone, type BotKind, type GameEvent } from '@new-frontier/core';
import { createWorldView, type WorldView } from '@new-frontier/render';
import {
  clampToZone,
  createCamera,
  easeZoom,
  followSquad,
  pan,
  poseOf,
  rotate,
  type Camera,
} from './camera';
import { Clock } from './clock';
import { HELD, squadCentre } from './controls';
import { FEEL } from './feel';
import { Input } from './input';
import { Session } from './session';
import { fitViewport } from './viewport';

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) {
    throw new Error(`The page has no #${id} element.`);
  }
  return found as T;
}

/** The browser-test hook (decision 16): a seed, a tick speed, a bot, and a read-only handle. */
const params = new URLSearchParams(window.location.search);
const MAX_SPEED = 64;
const MAX_RECENT = 2000;
const seed = params.has('seed') ? Number(params.get('seed')) >>> 0 : Math.floor(Math.random() * 2 ** 31);
const speed = Math.min(Math.max(Number(params.get('speed') ?? 1) || 1, 0), MAX_SPEED);
const botParam = params.get('bot');
const bot: BotKind | null = botParam === 'careful' || botParam === 'sloppy' ? botParam : null;

const canvas = element<HTMLCanvasElement>('game');
const overlay = element<HTMLCanvasElement>('overlay');
const session = new Session(seed, bot);
const clock = new Clock();
clock.speed = speed;

let world: WorldView | null = null;
try {
  world = createWorldView(canvas, overlay, session.view);
} catch {
  canvas.hidden = true;
  overlay.hidden = true;
  element('fatal').hidden = false;
}

if (world) start(world);

function start(world: WorldView): void {
  const camera = createCamera(squadCentre(session.view));
  const input = new Input(canvas, session, world, camera);
  const recent: GameEvent[] = [];
  const hook = params.has('test') ? exposeHook(world, camera, recent) : null;
  const groundLevel = currentZone(session.view).ground.relief.groundLevel;

  const fit = (): void => {
    const { width, height, pixelRatio } = fitViewport(canvas.clientWidth, canvas.clientHeight, window.devicePixelRatio);
    world.resize(width, height, pixelRatio);
  };
  fit();
  window.addEventListener('resize', fit);

  const moveCamera = (dt: number): void => {
    const right = (input.held(HELD.panRight) ? 1 : 0) - (input.held(HELD.panLeft) ? 1 : 0);
    const back = (input.held(HELD.panDown) ? 1 : 0) - (input.held(HELD.panUp) ? 1 : 0);
    pan(camera, right, back, dt);
    const turn = (input.held(HELD.rotateRight) ? 1 : 0) - (input.held(HELD.rotateLeft) ? 1 : 0);
    rotate(camera, turn, dt);
    if (session.auto || camera.follow) followSquad(camera, squadCentre(session.view), dt);
    const zone = currentZone(session.view);
    clampToZone(camera, zone);
    easeZoom(camera, dt);
    world.setCamera(poseOf(camera, groundLevel));
    // Gripping keeps the same ground point under the cursor.
    if (input.grip) {
      const under = world.groundAt(input.mouse.x, input.mouse.y);
      if (under) {
        camera.x += input.grip.x - under.x;
        camera.z += input.grip.z - under.z;
        clampToZone(camera, zone);
        world.setCamera(poseOf(camera, groundLevel));
      }
    }
  };

  let last = performance.now();
  const frame = (now: number): void => {
    requestAnimationFrame(frame);
    const real = Math.max(0, (now - last) / 1000);
    last = now;
    const dt = Math.min(real, FEEL.longestFrame);
    const ticks = clock.advance(real, input.wantsSlow);
    for (let index = 0; index < ticks; index += 1) {
      world.beforeTick(session.view);
      const events = session.tick();
      world.afterTick(session.view, events);
      if (hook) {
        recent.push(...events);
        if (recent.length > MAX_RECENT) recent.splice(0, recent.length - MAX_RECENT);
      }
    }
    moveCamera(dt);
    session.frame(dt);
    world.frame(session.view, clock.alpha, dt, { selected: session.selected, move: session.move, box: input.box, auto: session.auto });
    if (hook) hook.frames += 1;
  };
  requestAnimationFrame(frame);
}

/** A read-only window onto the game, only when `?test` is in the address. */
function exposeHook(world: WorldView, camera: Camera, recent: readonly GameEvent[]): { frames: number } {
  const hook = {
    frames: 0,
    seed,
    get view() {
      return session.view;
    },
    get selected() {
      return [...session.selected];
    },
    get auto() {
      return session.auto;
    },
    camera: camera as Readonly<Camera>,
    clock: clock as Readonly<Clock>,
    events: recent,
    world: {
      groundAt: world.groundAt,
      screenOf: world.screenOf,
      heightAt: world.heightAt,
      pickables: () => world.pickables(session.view),
      rebuildZone: () => world.rebuildZone(session.view),
      memory: world.memory,
    },
  };
  Object.assign(window, { __tnf: hook });
  return hook;
}
