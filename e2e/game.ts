import { expect, type Page } from '@playwright/test';

/** What the page's test hook gives (decision 16). Kept loose: it is read in the page. */
export interface Hook {
  frames: number;
  seed: number;
  /** The page waits for `step` instead of running its own frames (S3k). */
  stepping: boolean;
  /** Runs frames now, stopping early once `until` holds, and returns the frames run (S3k decision 1). */
  step(frames: number, options?: { draw?: boolean; until?: () => boolean }): number;
  /** A fingerprint of the whole game state (S3k). */
  hash(): string;
  /** Saving is on for this page (S3c). */
  saving: boolean;
  saves: number;
  saveNow(): Promise<boolean>;
  view: {
    tick: number;
    anchor: { x: number; z: number };
    family: {
      marks: number;
      potions: number;
      active: number[];
      characters: { id: number; name: string; classId: string; level: number; xp: number; items: Record<string, { id: number; typeId: string; upgrade: number; broken: boolean } | null> }[];
      inventory: { id: number; typeId: string; upgrade: number; broken: boolean }[];
    };
    bodies: {
      id: number;
      x: number;
      z: number;
      health: number;
      mana: number;
      alive: boolean;
      hold: boolean;
      dest: unknown;
      spellTicks: Record<string, number>;
    }[];
    zoneId: string;
    records: { id: string; returns: { packId: number; tick: number }[] }[];
    live: { enemies: { id: number; kind: string; alive: boolean; awake: boolean }[] };
  };
  selected: number[];
  mode: 'start' | 'play' | 'won';
  paused: boolean;
  muted: boolean;
  volume: number;
  audio: boolean;
  /** A gate crossing is fading out or in. */
  fading: boolean;
  camera: { x: number; z: number; zoom: number; zoomTarget: number; yaw: number; tiltAdjust: number; follow: boolean };
  events: { type: string; tick: number; order?: string; unitId?: number; spell?: string; amount?: number; to?: string }[];
  world: {
    groundAt(x: number, y: number): { x: number; z: number } | null;
    screenOf(point: { x: number; y: number; z: number }): { x: number; y: number; visible: boolean };
    heightAt(x: number, z: number): number;
    pickables(): { units: { id: number; screen: { x: number; y: number } }[]; enemies: unknown[]; npcs: { id: number; screen: { x: number; y: number } }[] };
    npcHighlighted(): number | null;
    rebuildZone(): void;
    memory(): { geometries: number; textures: number; programs: number };
    floating(): number;
    fadedBuildings(): number;
  };
}

declare global {
  interface Window {
    __tnf: Hook;
  }
}

/** Collects console errors and page errors for the whole test. */
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

/** Frames a stepped wait may run before it fails, when the test does not say: a minute of game time. */
export const STEP_LIMIT = 1800;
/** Frames per call into the page, so a long wait still draws now and then. */
const BATCH = 60;

/**
 * Runs frames in a stepped page (S3k decision 1). Frames before the last skip the picture
 * unless `draw` is set; the last always draws, so the page shows what the camera sees.
 */
export async function step(page: Page, frames: number, draw = false): Promise<void> {
  await page.evaluate(([count, drawEach]) => window.__tnf.step(count, { draw: drawEach }), [frames, draw] as const);
}

/**
 * Steps until `predicate` holds in the page, checked after every frame, and fails once
 * `maxFrames` have run without it (S3k decision 5). `what` names the wait in the failure.
 * The predicate runs in the page, so it may read only its argument and the page.
 */
export async function stepUntil<Arg>(
  page: Page,
  what: string,
  predicate: (arg: Arg) => boolean,
  arg: Arg,
  maxFrames = STEP_LIMIT,
  draw = false,
): Promise<number> {
  const code = predicate.toString();
  let ran = 0;
  for (;;) {
    const { done, frames } = await page.evaluate(
      ({ source, value, most, drawEach }) => {
        // The predicate arrives as source, since a function cannot cross into the page.
        const check = new Function(`return (${source});`)() as (input: unknown) => boolean;
        const count = window.__tnf.step(most, { draw: drawEach, until: () => check(value) });
        return { done: check(value), frames: count };
      },
      { source: code, value: arg as unknown, most: Math.min(BATCH, maxFrames - ran), drawEach: draw },
    );
    ran += frames;
    if (done) return ran;
    if (ran >= maxFrames) throw new Error(`Stepped ${maxFrames} frames and still waiting for ${what}.`);
  }
}

/** Opens the page on the start screen, without starting a run. A stepped page unless `real` (S3k decision 8). */
export async function openStart(page: Page, query = 'seed=1', real = false): Promise<void> {
  await page.goto(`./?test${real ? '' : '&step'}&${query}`);
  await expect(page.locator('#fatal')).toBeHidden();
  if (real) {
    await page.waitForFunction(() => window.__tnf?.frames > 5);
    return;
  }
  await stepFresh(page);
}

/** Readies a stepped page that has just loaded or reloaded: no frame runs until a step. */
export async function stepFresh(page: Page): Promise<void> {
  // The hook is there as soon as the page's script has run.
  await page.waitForFunction(() => window.__tnf !== undefined);
  await step(page, 6);
}

/** Opens the page and presses Start, as a player would. */
export async function openGame(page: Page, query = 'seed=1', real = false): Promise<void> {
  await openStart(page, query, real);
  await page.locator('#go').click();
  await expect(page.locator('#start')).toBeHidden();
  if (real) {
    await page.waitForFunction(() => window.__tnf.mode === 'play' && window.__tnf.view.tick > 2);
    return;
  }
  await stepUntil(page, 'the run to start', () => window.__tnf.mode === 'play' && window.__tnf.view.tick > 2, null, 30);
}

/** Steps until the game clock has run `ticks` more ticks. */
export async function ticksPass(page: Page, ticks: number): Promise<void> {
  const from = await page.evaluate(() => window.__tnf.view.tick);
  await stepUntil(page, `${ticks} ticks to pass`, (until) => window.__tnf.view.tick >= until, from + ticks, ticks * 4 + 30);
}

/** Holds an arrow key until the camera has panned and let go of the squad, so it holds still. */
export async function stillCamera(page: Page): Promise<void> {
  await page.keyboard.down('ArrowUp');
  await stepUntil(page, 'the camera to stop following', () => !window.__tnf.camera.follow, null, 30);
  await page.keyboard.up('ArrowUp');
  await step(page, 1);
}

/** Where a ground point shows on the page, if it shows on the game itself and not under the HUD. */
export async function onScreen(page: Page, point: { x: number; z: number }): Promise<{ x: number; y: number } | null> {
  return page.evaluate(({ x, z }) => {
    const { world } = window.__tnf;
    const at = world.screenOf({ x, y: world.heightAt(x, z), z });
    const under = document.elementFromPoint(at.x, at.y);
    return at.visible && (under?.id === 'game' || under?.id === 'overlay') ? { x: at.x, y: at.y } : null;
  }, point);
}

export async function rightClickGround(page: Page, points: readonly { x: number; z: number }[]): Promise<{ x: number; z: number }> {
  for (const point of points) {
    const at = await onScreen(page, point);
    if (at) {
      await page.mouse.move(at.x, at.y);
      await page.mouse.down({ button: 'right' });
      await page.mouse.up({ button: 'right' });
      return point;
    }
  }
  throw new Error('None of the points is on screen.');
}

/** Frames one arrow-key hold may last in `bringIntoView`, and how many holds it may try. */
const PAN = { frames: 40, holds: 20 };

/** Pans with the arrow keys until a ground point shows, as a player would look for it. */
export async function bringIntoView(page: Page, point: { x: number; z: number }): Promise<void> {
  for (let hold = 0; hold < PAN.holds && !(await onScreen(page, point)); hold += 1) {
    const at = await page.evaluate(({ x, z }) => window.__tnf.world.screenOf({ x, y: window.__tnf.world.heightAt(x, z), z }), point);
    const keys = [
      ...(at.x < 320 ? ['ArrowLeft'] : at.x > 960 ? ['ArrowRight'] : []),
      ...(at.y < 180 ? ['ArrowUp'] : at.y > 540 ? ['ArrowDown'] : []),
    ];
    if (keys.length === 0) return;
    for (const key of keys) await page.keyboard.down(key);
    // Held until the point shows, or for a stretch of frames if the zone's edge stops the camera.
    // The pan moves the camera without drawing; whether the point shows is worked out from it.
    await page.evaluate(
      ([{ x, z }, most]) =>
        window.__tnf.step(most, {
          until: () => {
            const { world } = window.__tnf;
            const seen = world.screenOf({ x, y: world.heightAt(x, z), z });
            const under = document.elementFromPoint(seen.x, seen.y);
            return seen.visible && seen.x > 0 && seen.y > 0 && seen.x < innerWidth && seen.y < innerHeight && (under?.id === 'game' || under?.id === 'overlay');
          },
        }),
      [point, PAN.frames] as const,
    );
    for (const key of keys) await page.keyboard.up(key);
    await step(page, 1);
  }
  if (!(await onScreen(page, point))) throw new Error(`Panning never brought (${point.x}, ${point.z}) into view.`);
}

/** Steps until the core reports the crossing into a zone, then until the fade has finished. */
export async function crossInto(page: Page, zoneId: string, maxFrames = STEP_LIMIT): Promise<void> {
  await stepUntil(
    page,
    `the crossing into ${zoneId}`,
    (id) => window.__tnf.events.filter(({ type }) => type === 'zone-changed').at(-1)?.to === id,
    zoneId,
    maxFrames,
  );
  await stepUntil(page, 'the fade to end', () => !window.__tnf.fading, null, 60);
}
