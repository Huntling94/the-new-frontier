import '@fontsource/alegreya-sans/latin-400.css';
import '@fontsource/alegreya-sans/latin-500.css';
import '@fontsource/alegreya-sans/latin-700.css';
import '@fontsource/im-fell-english-sc/latin-400.css';
import '@fontsource/vt323/latin-400.css';
import {
  currentZone,
  ISLAND_SCENARIO,
  TOWN_SCENARIO,
  whyNotTalk,
  type BotKind,
  type GameEvent,
  type GameState,
  type LoadResult,
} from '@new-frontier/core';
import { createWorldView, zoneLook, type CameraPose, type WorldView } from '@new-frontier/render';
import {
  addShake,
  clampToZone,
  createCamera,
  easeZoom,
  followSquad,
  pan,
  poseOf,
  rotate,
  shakePose,
  type Camera,
} from './camera';
import { Clock } from './clock';
import { followPoint, HELD, squadCentre, type KeyAction } from './controls';
import { FEEL } from './feel';
import { Hud, HUD_SECONDS } from './hud';
import { Input } from './input';
import { Reactions, type Reaction } from './reactions';
import { Inventory } from './inventory';
import {
  AutoSaver,
  BrowserSaveStore,
  describeSave,
  download,
  exportName,
  readSave,
  savedTime,
  savingAllowed,
} from './saves';
import { showVictory, SmithScreen, StartScreen } from './screens';
import { Session } from './session';
import { Sound } from './sound';
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
/** The start screen circles the island, as the squad test's does, and comes closer for a town (S3d). */
const ORBIT = { radius: 130, height: 64, lookHeight: 4, turn: 0.1 };
const TOWN_ORBIT = { ...ORBIT, radius: 92, height: 58 };
/** Banners last this long, and the victory screen follows the beacon's banner after it. */
const BANNER_SECONDS = 2.6;
/** Crossing a gate fades out with the game held, then fades in on the new zone (D-021). */
const FADE = { outSeconds: 0.3, inSeconds: 0.45 };
const seed = params.has('seed') ? Number(params.get('seed')) >>> 0 : Math.floor(Math.random() * 2 ** 31);
const speed = Math.min(Math.max(Number(params.get('speed') ?? 1) || 1, 0), MAX_SPEED);
const botParam = params.get('bot');
const bot: BotKind | null = botParam === 'careful' || botParam === 'sloppy' ? botParam : null;
const stillMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
/** How long the HUD's "Saved" line stays lit after a save. */
const SAVED_GLOW_MS = 1500;

/** The browser store, unless this is a test or bot run (S3c decision 9) or the browser blocks storage. */
function openStore(): BrowserSaveStore | null {
  if (!savingAllowed(params)) return null;
  try {
    return new BrowserSaveStore(window.localStorage);
  } catch {
    return null;
  }
}
const store = openStore();

const canvas = element<HTMLCanvasElement>('game');
const overlay = element<HTMLCanvasElement>('overlay');
const fadeLayer = element<HTMLDivElement>('fade');
/**
 * A player's new game starts in Montclaire (S3d decision 6). Bot runs and test pages
 * keep starting on the Lande, unless a test page asks for the town with `?town`.
 */
const inTown = !bot && (!params.has('test') || params.has('town'));
const session = new Session(seed, bot, inTown ? TOWN_SCENARIO : ISLAND_SCENARIO);
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

type Mode = 'start' | 'play' | 'won';

interface PageState {
  readonly saver: AutoSaver | null;
  readonly mode: Mode;
  readonly paused: boolean;
  readonly sound: Sound;
  readonly help: boolean;
  readonly fading: boolean;
}

function start(world: WorldView): void {
  let mode: Mode = 'start';
  let shown = 0;
  let victoryIn = 0;
  let hudIn = 0;
  const camera = createCamera(squadCentre(session.view));
  const sound = new Sound();
  const reactions = new Reactions();
  const recent: GameEvent[] = [];
  const groundLevel = (): number => currentZone(session.view).groundLevel;
  /** A gate crossing in progress: fading out on the old zone, or in on the new one. */
  let fade: { phase: 'out' | 'in'; seconds: number } | null = null;

  const smith = new SmithScreen(
    (commands) => {
      const events = session.applyNow(commands);
      recent.push(...events);
      for (const event of events) {
        if (event.type === 'upgraded' || event.type === 'repaired') {
          reactions.tally.upgrades += event.type === 'upgraded' ? 1 : 0;
          sound.play('forge');
        }
        if (event.type === 'item-broken') {
          reactions.tally.broken += 1;
          sound.play('fail');
        }
      }
      // A save follows every result, so a reload never undoes one (D-024, S3e decision 10).
      if (events.some(({ type }) => type === 'upgraded' || type === 'item-broken' || type === 'repaired')) {
        void saver?.saveNow(session.view, performance.now(), true);
      }
      return events;
    },
    () => smith.hide(),
  );

  // The inventory pauses the game, and its commands land at once (S3b decision 20).
  const inventory = new Inventory(
    (commands) => {
      const events = session.applyNow(commands);
      recent.push(...events);
      sound.play(events.some((event) => event.type === 'order-refused') ? 'fail' : 'click');
      return events;
    },
    () => inventory.hide(),
  );
  /** A screen that pauses the game is open. The smith's does not pause (S3e decision 4). */
  const screenOpen = (): boolean => inventory.open;
  /** Any screen is open, so the world takes no orders. */
  const modalOpen = (): boolean => screenOpen() || smith.open;

  const hud = new Hud(
    (id) => {
      if (mode !== 'play' || modalOpen()) return;
      session.selectOnly([id]);
      camera.follow = true;
      sound.play('click');
    },
    (place, slot) => {
      if (mode !== 'play' || modalOpen()) return;
      session.act({ kind: 'spell', place, slot }, null);
    },
  );

  const input = new Input(canvas, session, world, camera, {
    playing: () => mode === 'play' && !modalOpen(),
    menu: (action: KeyAction) => {
      if (mode !== 'play') return;
      if (inventory.open) {
        if (action.kind === 'inventory' || action.kind === 'close') inventory.hide();
        return;
      }
      if (smith.open) {
        // Only closing works while talking to the smith.
        if (action.kind === 'close') smith.hide();
        return;
      }
      if (action.kind === 'inventory' && fade === null) {
        // Anywhere, in fields and dungeons too (D-040).
        input.letGo();
        inventory.show(session.view);
        sound.play('click');
        return;
      }
      if (action.kind === 'help') hud.toggleHelp();
      if (action.kind === 'mute') sound.toggleMute();
    },
    cue: () => sound.play('click'),
    talk: (index) => tryTalk(index),
  });

  /** Opens the NPC's screen. Only the smith has one so far (D-044). */
  const openNpc = (npcId: string): void => {
    const npc = currentZone(session.view).npcs.find(({ id }) => id === npcId);
    session.talking = null;
    if (!npc?.services.includes('smith')) return;
    input.letGo();
    smith.show(session.view, `${npc.name}, the smith`);
    sound.play('click');
  };

  /** A right click on an NPC: talk now if in reach, or walk over and talk on arriving (S3e decision 2). */
  function tryTalk(index: number): void {
    const npc = currentZone(session.view).npcs[index];
    if (!npc) return;
    const reason = whyNotTalk(session.view, npc.id);
    if (reason === 'in-fight') {
      sound.play('fail');
      hud.log({ text: 'Not during a fight. Wait until no enemy is awake.', tone: 'bad' });
    } else if (reason === 'not-near-npc') {
      session.walkToTalk(npc.id, npc.at);
      sound.play('click');
      camera.follow = true;
    } else if (reason === null) {
      openNpc(npc.id);
    }
  }

  // Saves (S3c): the HUD says when the game last saved, and a failed save says so once.
  const savedLine = element('saved');
  let glow = 0;
  let failed = false;
  const saver = store
    ? new AutoSaver(
        store,
        (at) => {
          failed = false;
          savedLine.textContent = `Saved ${savedTime(at)}`;
          savedLine.classList.add('fresh');
          window.clearTimeout(glow);
          glow = window.setTimeout(() => savedLine.classList.remove('fresh'), SAVED_GLOW_MS);
        },
        () => {
          if (!failed) hud.log({ text: 'The browser refused to save the game', tone: 'bad' });
          failed = true;
        },
      )
    : null;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && mode !== 'start') void saver?.saveNow(session.view, performance.now());
  });

  const hook = params.has('test')
    ? exposeHook(world, camera, recent, () => ({ saver, mode, paused: screenOpen(), sound, help: hud.helpShown, fading: fade !== null }))
    : null;

  const fit = (): void => {
    const { width, height, pixelRatio } = fitViewport(canvas.clientWidth, canvas.clientHeight, window.devicePixelRatio);
    world.resize(width, height, pixelRatio);
  };
  fit();
  window.addEventListener('resize', fit);

  /** Starts play: on the fresh game, or on a loaded one (S3c decision 7). */
  const begin = (loaded: GameState | null, line: string): void => {
    if (loaded) {
      session.restore(loaded);
      world.rebuildZone(session.view);
      const centre = squadCentre(session.view);
      camera.x = centre.x;
      camera.z = centre.z;
    }
    startScreen.hide();
    sound.start();
    mode = 'play';
    hud.show(true);
    hud.log({ text: loaded ? 'Welcome back.' : 'Squad ready. Right click to move.', tone: 'plain' });
    hud.banner({ title: zoneLook(currentZone(session.view).id).name, line, seconds: BANNER_SECONDS });
    // A won run stays won: its save says the boss is dead.
    if (session.view.victory) {
      mode = 'won';
      victoryIn = BANNER_SECONDS;
    }
  };

  /** What the store holds, and the game Continue loads: from the backup if the save itself is refused. */
  let storedText: string | null = null;
  let toContinue: Extract<LoadResult, { ok: true }> | null = null;
  const startScreen = new StartScreen({
    onContinue: () => {
      if (toContinue) begin(toContinue.state, 'Welcome back');
    },
    onNew: () => {
      void (async () => {
        if (storedText !== null && !(await startScreen.ask('Start a new game? It replaces your saved game.', 'Replace it'))) return;
        begin(null, inTown ? `Head out to ${zoneLook('lande').name}` : 'Clear the camps, then visit the smith');
        void saver?.saveNow(session.view, performance.now(), true);
      })();
    },
    onExport: () => {
      void store?.load().then((text) => {
        if (text !== null) download(text, exportName(new Date()));
      });
    },
    onImport: (file) => {
      void (async () => {
        const text = await file.text();
        const result = readSave(text);
        if (!result.ok) {
          startScreen.say(`That file could not be loaded. ${result.detail}`, true);
          return;
        }
        const question = `Replace your saved game with this one? ${describeSave(result.state, result.savedAt)}.`;
        if (storedText !== null && !(await startScreen.ask(question, 'Replace it'))) return;
        try {
          await store?.save(text);
        } catch {
          startScreen.say('The browser refused to save the imported game.', true);
          return;
        }
        begin(result.state, 'Save imported');
      })();
    },
  });

  /** Reads the store and offers Continue, or says why a save would not load (S3c decisions 4 and 7). */
  const offer = async (): Promise<void> => {
    storedText = (await store?.load()) ?? null;
    const result = storedText === null ? null : readSave(storedText);
    let note: { text: string; warn: boolean } | null = null;
    toContinue = result?.ok ? result : null;
    if (result && !result.ok) {
      const backupText = await store?.loadBackup();
      const backup = backupText ? readSave(backupText) : null;
      toContinue = backup?.ok ? backup : null;
      const why = `Your saved game could not be loaded. ${result.detail}`;
      note = { text: toContinue ? `${why} Continue picks up the save before it.` : `${why} Export it to keep a copy, or start a new game.`, warn: true };
    }
    startScreen.show({
      continueInfo: toContinue ? describeSave(toContinue.state, toContinue.savedAt) : null,
      note,
      saving: store !== null,
      canExport: storedText !== null,
    });
  };
  void offer();

  const react = (reaction: Reaction): void => {
    for (const name of reaction.sounds) sound.play(name);
    for (const line of reaction.log) hud.log(line);
    if (reaction.banner) hud.banner(reaction.banner);
    if (reaction.shake > 0) addShake(camera, reaction.shake);
    if (reaction.hitStop) clock.hitStop();
    if (reaction.victory && mode === 'play') {
      mode = 'won';
      victoryIn = BANNER_SECONDS;
    }
  };

  const moveCamera = (dt: number): CameraPose => {
    const right = (input.held(HELD.panRight) ? 1 : 0) - (input.held(HELD.panLeft) ? 1 : 0);
    const back = (input.held(HELD.panDown) ? 1 : 0) - (input.held(HELD.panUp) ? 1 : 0);
    pan(camera, right, back, dt);
    const turn = (input.held(HELD.rotateRight) ? 1 : 0) - (input.held(HELD.rotateLeft) ? 1 : 0);
    rotate(camera, turn, dt);
    if (session.auto || camera.follow) followSquad(camera, followPoint(session.view, session.selected), dt);
    const zone = currentZone(session.view);
    clampToZone(camera, zone);
    easeZoom(camera, dt);
    world.setCamera(poseOf(camera, groundLevel()));
    // Gripping keeps the same ground point under the cursor.
    if (input.grip) {
      const under = world.groundAt(input.mouse.x, input.mouse.y);
      if (under) {
        camera.x += input.grip.x - under.x;
        camera.z += input.grip.z - under.z;
        clampToZone(camera, zone);
      }
    }
    // No jolt while paused, and none when the player asks for reduced motion.
    return shakePose(camera, poseOf(camera, groundLevel()), dt, Math.random, stillMotion || dt === 0);
  };

  /** The start screen's slow circle around the zone. */
  const orbitPose = (): CameraPose => {
    const zone = currentZone(session.view);
    const orbit = zone.kind === 'town' ? TOWN_ORBIT : ORBIT;
    const angle = shown * orbit.turn;
    return {
      eye: { x: zone.x + Math.cos(angle) * orbit.radius, y: orbit.height, z: zone.z + Math.sin(angle) * orbit.radius },
      target: { x: zone.x, y: orbit.lookHeight, z: zone.z },
    };
  };

  let last = performance.now();
  const frame = (now: number): void => {
    requestAnimationFrame(frame);
    const real = Math.max(0, (now - last) / 1000);
    last = now;
    const dt = Math.min(real, FEEL.longestFrame);
    shown += dt;
    if (fade) fade.seconds += dt;
    if (fade?.phase === 'out' && fade.seconds >= FADE.outSeconds) {
      // Black: the new zone's scene is built on the next draw, and the camera starts on the squad.
      fade = { phase: 'in', seconds: 0 };
      const centre = squadCentre(session.view);
      camera.x = centre.x;
      camera.z = centre.z;
    }
    if (fade?.phase === 'in' && fade.seconds >= FADE.inSeconds) fade = null;
    // The inventory pauses the game: no ticks run while it is open (decision 4), nor while fading out.
    const running = mode !== 'start' && !screenOpen() && fade?.phase !== 'out';
    const ticks = running ? clock.advance(real, input.wantsSlow) : 0;
    for (let index = 0; index < ticks; index += 1) {
      reactions.remember(session.view);
      world.beforeTick(session.view);
      const events = session.tick();
      world.afterTick(session.view, events);
      react(reactions.react(session.view, events));
      if (hook) {
        recent.push(...events);
        if (recent.length > MAX_RECENT) recent.splice(0, recent.length - MAX_RECENT);
      }
      if (events.some(({ type }) => type === 'zone-changed')) {
        // Arriving through a gate saves at once (S3c decision 6).
        void saver?.saveNow(session.view, now);
        input.letGo();
        fade = { phase: 'out', seconds: 0 };
        break;
      }
    }
    if (mode === 'play' && session.talking !== null && !modalOpen() && fade === null) {
      // Walking to talk ends on arriving in reach, or if a fight starts on the way.
      const reason = whyNotTalk(session.view, session.talking);
      if (reason === null) openNpc(session.talking);
      else if (reason !== 'not-near-npc') session.talking = null;
    }
    if (mode !== 'start') saver?.consider(session.view, now);
    fadeLayer.style.opacity = !fade ? '0' : String(fade.phase === 'out' ? Math.min(fade.seconds / FADE.outSeconds, 1) : Math.max(1 - fade.seconds / FADE.inSeconds, 0));
    // While fading out the canvas keeps its last picture of the zone being left.
    if (fade?.phase === 'out') {
      if (hook) hook.frames += 1;
      return;
    }
    for (const note of session.notes.splice(0)) hud.log(note);
    world.setCamera(mode === 'start' ? orbitPose() : moveCamera(running ? dt : 0));
    if (running) session.frame(dt);
    const npcHover = input.hoveredNpc();
    canvas.style.cursor = npcHover === null ? '' : 'pointer';
    world.frame(session.view, clock.alpha, running ? dt : 0, { selected: session.selected, move: session.move, box: input.box, npcHover });
    hud.ageBanner(dt);
    hudIn -= dt;
    if (mode !== 'start' && hudIn <= 0) {
      hudIn = HUD_SECONDS;
      hud.update(session.view, {
        selected: session.selected,
        autoIds: session.autoIds,
        slowMeter: clock.meter,
        slowed: running && clock.slowed,
        paused: modalOpen(),
      });
    }
    if (mode === 'won' && victoryIn > 0) {
      victoryIn -= dt;
      if (victoryIn <= 0) {
        hud.show(false);
        showVictory(session.view, reactions.tally);
      }
    }
    if (hook) hook.frames += 1;
  };
  requestAnimationFrame(frame);
}

/** A read-only window onto the game, only when `?test` is in the address. */
function exposeHook(world: WorldView, camera: Camera, recent: readonly GameEvent[], page: () => PageState): { frames: number } {
  const hook = {
    frames: 0,
    seed,
    /** Saving is on for this page (S3c decision 9). */
    get saving() {
      return page().saver !== null;
    },
    get saves() {
      return page().saver?.count ?? 0;
    },
    /** Saves now if no fight is on, as the automatic save does. Resolves to whether it saved. */
    saveNow: () => page().saver?.saveNow(session.view, performance.now()) ?? Promise.resolve(false),
    get view() {
      return session.view;
    },
    get selected() {
      return [...session.selected];
    },
    get auto() {
      return session.auto;
    },
    get mode() {
      return page().mode;
    },
    get paused() {
      return page().paused;
    },
    get muted() {
      return page().sound.muted;
    },
    get volume() {
      return page().sound.level;
    },
    get audio() {
      return page().sound.running;
    },
    get help() {
      return page().help;
    },
    get fading() {
      return page().fading;
    },
    camera: camera as Readonly<Camera>,
    clock: clock as Readonly<Clock>,
    events: recent,
    world: {
      groundAt: world.groundAt,
      screenOf: world.screenOf,
      heightAt: world.heightAt,
      pickables: () => world.pickables(session.view),
      npcHighlighted: () => world.npcHighlighted(),
      rebuildZone: () => world.rebuildZone(session.view),
      memory: world.memory,
      floating: world.floating,
      fadedBuildings: world.fadedBuildings,
    },
  };
  Object.assign(window, { __tnf: hook });
  return hook;
}
