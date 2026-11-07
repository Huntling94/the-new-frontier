import { currentZone, type GameEvent, type GameView, type Point } from '@new-frontier/core';
import {
  ColorManagement,
  LinearSRGBColorSpace,
  PCFShadowMap,
  PerspectiveCamera,
  Plane,
  Raycaster,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { Effects } from './effects';
import { EntityLayer, type Marks } from './entities';
import { Floats } from './floats';
import { monsterLook } from './looks';
import { ZoneScene } from './zone-scene';

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Where the camera sits and what it looks at. The camera's feel lives in `app`. */
export interface CameraPose {
  readonly eye: Vec3;
  readonly target: Vec3;
}

/** A box being dragged out, in page pixels. */
export interface Box {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

export interface ScreenState extends Marks {
  readonly box: Box | null;
}

export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
  /** In front of the camera. */
  readonly visible: boolean;
}

/** One drawn character or enemy, as the player sees it, for picking. */
export interface Pickable {
  readonly id: number;
  readonly screen: ScreenPoint;
}

export interface WorldView {
  /** Copies positions before a tick (decision 2). */
  beforeTick(view: GameView): void;
  afterTick(view: GameView, events: readonly GameEvent[]): void;
  /**
   * Draws a frame `alpha` of the way between ticks. `dt` is real seconds.
   */
  frame(view: GameView, alpha: number, dt: number, screen: ScreenState): void;
  /** How many floating texts are showing, for tests. */
  floating(): number;
  setCamera(pose: CameraPose): void;
  /** The point on the ground plane under a page pixel, as the squad test picks it. */
  groundAt(x: number, y: number): Point | null;
  screenOf(point: Vec3): ScreenPoint;
  heightAt(x: number, z: number): number;
  /** Characters and enemies where they are drawn, raised to body height for clicking. */
  pickables(view: GameView): { readonly units: Pickable[]; readonly enemies: Pickable[] };
  /** Drops the zone's scene and builds it again from the view (decision 10). */
  rebuildZone(view: GameView): void;
  resize(width: number, height: number, pixelRatio: number): void;
  /** What the GPU holds, for leak checks. */
  memory(): { readonly geometries: number; readonly textures: number; readonly programs: number };
  dispose(): void;
}

/** Characters and enemies are clicked at this height above their feet, as in the squad test. */
const PICK_HEIGHT = 2;
const UNIT_BAR_HEIGHT = 5.4;
const UNIT_BAR_WIDTH = 34;
const BAR_THICKNESS = 4;
const LOW_HEALTH = 0.3;
const MAX_OVERLAY_RATIO = 2;

interface Loaded {
  readonly scene: ZoneScene;
  readonly effects: Effects;
  readonly entities: EntityLayer;
}

function load(view: GameView): Loaded {
  const scene = new ZoneScene(view, currentZone(view));
  const effects = new Effects(scene);
  return { scene, effects, entities: new EntityLayer(scene, effects) };
}

function unload(loaded: Loaded): void {
  loaded.entities.dispose();
  loaded.effects.dispose();
  loaded.scene.dispose();
}

/**
 * Draws the zone holding the squad, everything in it, and the health bars over
 * them. It reads the game and changes nothing (decision 1).
 */
export function createWorldView(canvas: HTMLCanvasElement, overlay: HTMLCanvasElement, view: GameView): WorldView {
  // The squad test ran on three.js r128, before colour management (decision 8).
  ColorManagement.enabled = false;
  const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = LinearSRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  const camera = new PerspectiveCamera(40, 1, 1, 2200);
  const context = overlay.getContext('2d');
  const ray = new Raycaster();
  const pointer = new Vector2();
  const hit = new Vector3();
  const projected = new Vector3();
  let loaded = load(view);
  let size = { width: 1, height: 1 };
  /** Where the camera looks, which the sun and dressing follow. */
  let focus = { x: view.anchor.x, z: view.anchor.z };

  const groundPlane = (): Plane => new Plane(new Vector3(0, 1, 0), -loaded.scene.zone.ground.relief.groundLevel);

  const screenOf = ({ x, y, z }: Vec3): ScreenPoint => {
    projected.set(x, y, z).project(camera);
    return {
      x: (projected.x * 0.5 + 0.5) * size.width,
      y: (-projected.y * 0.5 + 0.5) * size.height,
      visible: projected.z < 1,
    };
  };

  const floats = new Floats();

  const drawOverlay = (current: GameView, screen: ScreenState, dt: number): void => {
    if (!context) return;
    const ratio = overlay.width / size.width;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, size.width, size.height);
    const { box } = screen;
    if (box) {
      context.fillStyle = '#8fd6c426';
      context.strokeStyle = '#8fd6c4';
      context.lineWidth = 1.5;
      context.fillRect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
      context.strokeRect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
    }
    for (const enemy of loaded.entities.drawnEnemies(current)) {
      // A boss's health is in the HUD (S2.3b).
      if (enemy.share >= 1 || !monsterLook(enemy.kind).overheadBar) continue;
      const at = screenOf({ x: enemy.x, y: enemy.y + monsterLook(enemy.kind).barHeight, z: enemy.z });
      if (!at.visible) continue;
      const width = 24 + enemy.size * 10;
      context.fillStyle = '#000a';
      context.fillRect(at.x - width / 2, at.y, width, BAR_THICKNESS);
      context.fillStyle = '#ef6a54';
      context.fillRect(at.x - width / 2, at.y, width * Math.min(Math.max(enemy.share, 0), 1), BAR_THICKNESS);
    }
    for (const unit of loaded.entities.drawnUnits()) {
      if (!unit.alive) continue;
      const at = screenOf({ x: unit.x, y: unit.y + UNIT_BAR_HEIGHT, z: unit.z });
      if (!at.visible) continue;
      context.fillStyle = '#000a';
      context.fillRect(at.x - UNIT_BAR_WIDTH / 2, at.y, UNIT_BAR_WIDTH, BAR_THICKNESS);
      context.fillStyle = unit.share < LOW_HEALTH ? '#ef6a54' : '#9be8a6';
      context.fillRect(at.x - UNIT_BAR_WIDTH / 2, at.y, UNIT_BAR_WIDTH * unit.share, BAR_THICKNESS);
    }
    floats.draw(context, dt, (x, y, z) => screenOf({ x, y, z }));
  };

  return {
    beforeTick(current) {
      loaded.entities.snapshot(current);
    },
    afterTick(current, events) {
      loaded.entities.events(current, events);
      const units = loaded.entities.drawnUnits();
      const enemies = loaded.entities.drawnEnemies(current);
      floats.fromEvents(
        events,
        (id) => units.find((unit) => unit.id === id) ?? null,
        (id) => enemies.find((enemy) => enemy.id === id) ?? null,
      );
    },
    frame(current, alpha, dt, screen) {
      if (currentZone(current).id !== loaded.scene.zone.id) {
        unload(loaded);
        loaded = load(current);
      }
      loaded.entities.draw(current, alpha, dt, screen);
      loaded.effects.update(dt);
      const living = current.units.filter(({ alive }) => alive);
      const squad = living.length > 0
        ? { x: living.reduce((sum, u) => sum + u.x, 0) / living.length, z: living.reduce((sum, u) => sum + u.z, 0) / living.length }
        : current.anchor;
      loaded.scene.update(current, dt, focus, squad);
      renderer.render(loaded.scene.scene, camera);
      drawOverlay(current, screen, dt);
    },
    floating() {
      return floats.count;
    },
    setCamera({ eye, target }) {
      camera.position.set(eye.x, eye.y, eye.z);
      camera.lookAt(target.x, target.y, target.z);
      camera.updateMatrixWorld();
      focus = { x: target.x, z: target.z };
    },
    groundAt(x, y) {
      pointer.set((x / size.width) * 2 - 1, -(y / size.height) * 2 + 1);
      ray.setFromCamera(pointer, camera);
      return ray.ray.intersectPlane(groundPlane(), hit) ? { x: hit.x, z: hit.z } : null;
    },
    screenOf,
    heightAt(x, z) {
      return loaded.scene.heightAt(x, z);
    },
    pickables(current) {
      const raise = (body: { id: number; x: number; y: number; z: number }): Pickable => ({
        id: body.id,
        screen: screenOf({ x: body.x, y: body.y + PICK_HEIGHT, z: body.z }),
      });
      return {
        units: loaded.entities.drawnUnits().filter(({ alive }) => alive).map(raise),
        enemies: loaded.entities.drawnEnemies(current).map(raise),
      };
    },
    rebuildZone(current) {
      unload(loaded);
      loaded = load(current);
    },
    resize(width, height, pixelRatio) {
      size = { width, height };
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      const ratio = Math.min(window.devicePixelRatio || 1, MAX_OVERLAY_RATIO);
      overlay.width = Math.floor(width * ratio);
      overlay.height = Math.floor(height * ratio);
    },
    memory() {
      const { geometries, textures } = renderer.info.memory;
      return { geometries, textures, programs: renderer.info.programs?.length ?? 0 };
    },
    dispose() {
      unload(loaded);
      renderer.dispose();
    },
  };
}
