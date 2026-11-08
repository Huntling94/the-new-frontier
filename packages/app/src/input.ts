import type { Point } from '@new-frontier/core';
import type { Box, Pickable, WorldView } from '@new-frontier/render';
import { orbit, resetView, snapTo, zoomBy, type Camera } from './camera';
import { altAction, CLAIMED, followPoint, pressAction, type KeyAction } from './controls';
import { FEEL } from './feel';
import { pickInBox, pickNearest } from './picking';
import type { Session } from './session';

const P = FEEL.pointer;
const LEFT = 0;
const MIDDLE = 1;
const RIGHT = 2;

/** What the page tells input about screens and sound (S2.3b). */
export interface InputGate {
  /** The squad can be commanded: a run has started, and nothing is paused. */
  playing(): boolean;
  /** The inventory, close, help and mute keys, which work outside play too. */
  menu(action: KeyAction): void;
  /** A click sound, played on the press (S2.3b decision 3). */
  cue(): void;
  /** A right click on an NPC, by its place in the zone's list (S3e decision 2). */
  talk(index: number): void;
}

const MENU_KEYS = new Set<KeyAction['kind']>(['inventory', 'close', 'help', 'mute']);

/** Mouse and keyboard, from D-003, D-013, D-031, D-034 and D-035. */
export class Input {
  readonly keys = new Set<string>();
  readonly mouse = { x: 0, y: 0 };
  box: Box | null = null;
  /** The ground point held under the cursor while gripping. */
  grip: Point | null = null;
  /** A right drag turns and tilts the camera (D-034). */
  private orbiting = false;
  private rightDown: { x: number; y: number } | null = null;
  private leftDown: { x: number; y: number } | null = null;

  private readonly session: Session;
  private readonly world: WorldView;
  private readonly camera: Camera;
  private readonly gate: InputGate;

  constructor(canvas: HTMLCanvasElement, session: Session, world: WorldView, camera: Camera, gate: InputGate) {
    this.session = session;
    this.world = world;
    this.camera = camera;
    this.gate = gate;
    this.mouse = { x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 };
    window.addEventListener('keydown', (event) => this.keyDown(event));
    window.addEventListener('keyup', (event) => this.keys.delete(event.code));
    window.addEventListener('blur', () => this.release());
    canvas.addEventListener('pointermove', (event) => this.pointerMove(event));
    canvas.addEventListener('pointerdown', (event) => this.pointerDown(event, canvas));
    canvas.addEventListener('pointerup', (event) => this.pointerUp(event));
    canvas.addEventListener('mousedown', (event) => {
      if (event.button === MIDDLE) event.preventDefault();
    });
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    canvas.addEventListener(
      'wheel',
      (event) => {
        event.preventDefault();
        if (this.gate.playing()) zoomBy(this.camera, event.deltaY);
      },
      { passive: false },
    );
  }

  held(code: string): boolean {
    return this.gate.playing() && this.keys.has(code);
  }

  get wantsSlow(): boolean {
    return this.held('ShiftLeft') || this.held('ShiftRight');
  }

  /** Lets go of every key and drag, as when a screen opens. */
  letGo(): void {
    this.release();
  }

  /**
   * The NPC under the pointer, by its place in the zone's list, unless a squad member
   * stands nearer the pointer, so a character beside the smith can still be clicked.
   */
  npcUnder(x: number, y: number): number | null {
    const { units, npcs } = this.world.pickables(this.session.view);
    const npc = pickNearest(npcs, x, y, P.npcRadius);
    const unit = pickNearest(units, x, y, P.characterRadius);
    if (npc === null || unit === null) return npc;
    const away = (screen: Pickable['screen']): number => Math.hypot(screen.x - x, screen.y - y);
    const npcAt = npcs.find(({ id }) => id === npc)?.screen;
    const unitAt = units.find(({ id }) => id === unit)?.screen;
    return npcAt && unitAt && away(unitAt) < away(npcAt) ? null : npc;
  }

  /** What the pointer is over now: nothing while a drag is on. */
  hoveredNpc(): number | null {
    return this.gate.playing() && !this.box && !this.orbiting ? this.npcUnder(this.mouse.x, this.mouse.y) : null;
  }

  cursorGround(): Point | null {
    return this.world.groundAt(this.mouse.x, this.mouse.y);
  }

  private release(): void {
    this.keys.clear();
    this.grip = null;
    this.orbiting = false;
    this.rightDown = null;
    this.leftDown = null;
    this.box = null;
  }

  private keyDown(event: KeyboardEvent): void {
    if (CLAIMED.has(event.code)) event.preventDefault();
    const alt = event.altKey && !event.ctrlKey && !event.metaKey ? altAction(event.code) : null;
    if (alt) {
      // The browser's own menu would take `Alt` + `E` otherwise (D-040).
      event.preventDefault();
      if (!event.repeat) this.gate.menu(alt);
      return;
    }
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    this.keys.add(event.code);
    const action = pressAction(event.code);
    if (!action) return;
    if (MENU_KEYS.has(action.kind)) {
      this.gate.menu(action);
      return;
    }
    if (!this.gate.playing()) return;
    if (action.kind === 'select' || action.kind === 'select-all' || action.kind === 'regroup') this.gate.cue();
    if (action.kind === 'snap') {
      snapTo(this.camera, followPoint(this.session.view, this.session.selected));
    } else if (action.kind === 'reset-view') {
      resetView(this.camera);
    } else {
      this.session.act(action, this.cursorGround());
      if (action.kind === 'select') this.followOne();
    }
  }

  /** Selecting one character on their own turns follow on, onto them (D-037). */
  private followOne(): void {
    if (this.session.selected.size === 1) this.camera.follow = true;
  }

  private pointerMove(event: PointerEvent): void {
    const right = this.rightDown;
    if (right && !this.orbiting && Math.hypot(event.clientX - right.x, event.clientY - right.y) > P.dragThreshold) {
      this.orbiting = true;
    }
    if (this.orbiting) orbit(this.camera, event.clientX - this.mouse.x, event.clientY - this.mouse.y);
    this.mouse.x = event.clientX;
    this.mouse.y = event.clientY;
    const left = this.leftDown;
    if (left && (this.box || Math.hypot(event.clientX - left.x, event.clientY - left.y) > P.dragThreshold)) {
      this.box = { x0: left.x, y0: left.y, x1: event.clientX, y1: event.clientY };
    }
  }

  private pointerDown(event: PointerEvent, canvas: HTMLCanvasElement): void {
    this.mouse.x = event.clientX;
    this.mouse.y = event.clientY;
    if (!this.gate.playing()) return;
    canvas.setPointerCapture(event.pointerId);
    if (event.button === MIDDLE) {
      // A middle drag grips the ground and pans (D-034).
      event.preventDefault();
      const ground = this.world.groundAt(event.clientX, event.clientY);
      if (ground) {
        this.grip = ground;
        this.camera.follow = false;
      }
    } else if (event.button === RIGHT) {
      this.rightDown = { x: event.clientX, y: event.clientY };
    } else if (event.button === LEFT) {
      // Ctrl, or Cmd on a Mac, and a left click attack-moves (D-034).
      if (event.ctrlKey || event.metaKey) {
        const ground = this.world.groundAt(event.clientX, event.clientY);
        if (ground) this.order(() => this.session.moveTo(ground, true));
        return;
      }
      this.leftDown = { x: event.clientX, y: event.clientY };
    }
  }

  /** Orders turn follow back on, so the camera goes with the squad (D-034). */
  private order(give: () => void): void {
    give();
    this.gate.cue();
    this.camera.follow = true;
  }

  private pointerUp(event: PointerEvent): void {
    if (event.button === MIDDLE) this.grip = null;
    if (event.button === LEFT) {
      if (this.leftDown) {
        const { units } = this.world.pickables(this.session.view);
        if (this.box) {
          const ids = pickInBox(units, this.box, P.boxMargin);
          this.session.selectOnly(ids);
          if (ids.length > 0) this.gate.cue();
          if (ids.length === 1) this.followOne();
        } else {
          const id = pickNearest(units, event.clientX, event.clientY, P.characterRadius);
          if (id !== null) {
            this.session.selectOnly([id]);
            this.gate.cue();
            this.followOne();
          }
        }
      }
      this.leftDown = null;
      this.box = null;
    }
    if (event.button !== RIGHT) return;
    const turned = this.orbiting;
    this.orbiting = false;
    const pressed = this.rightDown;
    this.rightDown = null;
    // A right drag turns the camera and never orders a move (done means 5).
    if (turned || !pressed) return;
    const { enemies } = this.world.pickables(this.session.view);
    const enemy = pickNearest(enemies, event.clientX, event.clientY, P.enemyRadius);
    if (enemy !== null) {
      this.order(() => this.session.target(enemy));
      return;
    }
    const npc = this.npcUnder(event.clientX, event.clientY);
    if (npc !== null) {
      this.gate.talk(npc);
      return;
    }
    const ground = this.world.groundAt(event.clientX, event.clientY);
    if (ground) this.order(() => this.session.moveTo(ground, false));
  }
}
