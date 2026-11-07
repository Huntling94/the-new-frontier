import { TICK_RATE, type GameEvent, type GameView } from '@new-frontier/core';
import {
  BoxGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  RingGeometry,
  SphereGeometry,
  Sprite,
  type BufferGeometry,
  type SpriteMaterial,
} from 'three';
import type { Effects } from './effects';
import { buildCharacter, buildMonster, type Figure } from './figures';
import { looseGlowSprite, Resources } from './kit';
import { characterLook, MARKS, monsterLook, spellLook } from './looks';
import type { ZoneScene } from './zone-scene';

type UnitView = GameView['units'][number];
type EnemyView = GameView['enemies'][number];
type ShotView = GameView['shots'][number];
type EnemyShotView = GameView['enemyShots'][number];
type ScheduledView = GameView['scheduled'][number];

/** What the player has marked, which the screen shows at once (decision 3). */
export interface Marks {
  readonly selected: ReadonlySet<number>;
  readonly move: { readonly x: number; readonly z: number; readonly attack: boolean; readonly age: number } | null;
}

/** Where something was drawn this frame, for health bars and picking. */
export interface Drawn {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly share: number;
  readonly alive: boolean;
}

interface Body {
  readonly figure: Figure;
  /** The core's type ID, kept so a corpse still knows what it was. */
  readonly kind: string;
  scale: number;
  readonly resources: Resources;
  angle: number;
  walk: number;
  swing: number;
  flash: number;
  /** Wind-up ticks when it began, to squash the body as it builds. */
  windFrom: number;
  /** A corpse shrinks away over this many seconds after it falls. */
  dying: number | null;
  drawn: Drawn;
}

interface Point2 {
  x: number;
  z: number;
}

const DEATH_SECONDS = 0.3;
const TURN_RATE = 11;
const WALK_RATE = 13;
const SWING_DECAY = 5;
const UNIT_FLASH_DECAY = 6;
const ENEMY_FLASH_DECAY = 7;
const MOVE_MARK_FADE = 1.4;
const SHOT_HEIGHT = 2.2;
const ENEMY_SHOT_HEIGHT = 2;
const DROP_HEIGHT = 0.6;
const DROP_LIFT = 9;
const DROP_FALL = 16;
const MOVING = 0.01;

const angleBetween = (from: number, to: number): number => {
  let difference = (to - from) % (2 * Math.PI);
  if (difference > Math.PI) difference -= 2 * Math.PI;
  if (difference < -Math.PI) difference += 2 * Math.PI;
  return difference;
};

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * Draws everything that moves, keyed on entity IDs (decision 2). Things the core
 * gives no ID, such as shots and telegraphs, are keyed on the record itself,
 * which works because the core changes state in place.
 */
export class EntityLayer {
  private readonly units = new Map<number, Body>();
  private readonly enemies = new Map<number, Body>();
  private readonly before = new Map<number, Point2>();
  private readonly shotsBefore = new WeakMap<object, Point2>();
  private readonly shots = new Map<object, Mesh>();
  private readonly drops = new Map<number, Mesh>();
  private readonly telegraphs = new Map<object, { readonly group: Group; readonly materials: MeshBasicMaterial[]; last: ScheduledView }>();
  private readonly rings = new Map<number, Mesh>();
  private readonly targetRing: Mesh;
  private readonly moveMark: Mesh;
  private readonly shotGeometry: BufferGeometry;
  private readonly enemyShotGeometry: BufferGeometry;
  private readonly unitRing: BufferGeometry;
  private readonly teleRing: BufferGeometry;
  private readonly teleDisc: BufferGeometry;
  private readonly telePlane: BufferGeometry;
  private readonly shotMaterial: MeshBasicMaterial;
  private readonly coinMaterial: MeshBasicMaterial;
  private readonly potionMaterial: MeshBasicMaterial;
  private readonly ringMaterial: MeshBasicMaterial;
  private readonly enemyShotMaterials = new Map<number, MeshBasicMaterial>();
  private readonly enemyShotGlows = new Map<number, SpriteMaterial>();
  private castBefore = new Map<number, number>();
  private readonly layer = new Group();

  private readonly zone: ZoneScene;
  private readonly effects: Effects;

  constructor(zone: ZoneScene, effects: Effects) {
    this.zone = zone;
    this.effects = effects;
    const keep = zone.resources;
    zone.world.add(this.layer);
    this.shotGeometry = keep.keep(new BoxGeometry(0.16, 0.16, 1.9));
    this.enemyShotGeometry = keep.keep(new SphereGeometry(0.3, 6, 5));
    this.unitRing = keep.keep(new RingGeometry(1.25, 1.55, 32).rotateX(-Math.PI / 2));
    this.teleRing = keep.keep(new RingGeometry(0.93, 1, 44).rotateX(-Math.PI / 2));
    this.teleDisc = keep.keep(new RingGeometry(0, 1, 44).rotateX(-Math.PI / 2));
    this.telePlane = keep.keep(new PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5));
    this.shotMaterial = keep.keep(new MeshBasicMaterial({ color: MARKS.shot }));
    this.coinMaterial = keep.keep(new MeshBasicMaterial({ color: MARKS.coin }));
    this.potionMaterial = keep.keep(new MeshBasicMaterial({ color: MARKS.potion }));
    this.ringMaterial = keep.keep(this.markMaterial(MARKS.selection, 0.95));
    this.targetRing = new Mesh(keep.keep(new RingGeometry(0.92, 1, 40).rotateX(-Math.PI / 2)), keep.keep(this.markMaterial(MARKS.target, 0.9)));
    this.targetRing.visible = false;
    this.moveMark = new Mesh(keep.keep(new RingGeometry(0.9, 1.3, 26).rotateX(-Math.PI / 2)), keep.keep(this.markMaterial(MARKS.move, 0)));
    this.layer.add(this.targetRing, this.moveMark);
  }

  /** Copies positions before a tick, so frames can be drawn between ticks. */
  snapshot(view: GameView): void {
    this.before.clear();
    for (const unit of view.units) this.before.set(unit.id, { x: unit.x, z: unit.z });
    for (const enemy of view.enemies) this.before.set(enemy.id, { x: enemy.x, z: enemy.z });
    for (const drop of view.drops) this.before.set(drop.id, { x: drop.x, z: drop.z });
    for (const shot of [...view.shots, ...view.enemyShots]) this.shotsBefore.set(shot, { x: shot.x, z: shot.z });
    this.castBefore = new Map(view.enemies.map((enemy) => [enemy.id, enemy.boss?.castTicks ?? 0]));
  }

  /** Turns a tick's events into flashes and bursts. */
  events(view: GameView, events: readonly GameEvent[]): void {
    const interrupted = new Set<number>();
    for (const event of events) {
      if (event.type === 'interrupted') interrupted.add(event.enemyId);
    }
    for (const event of events) {
      this.event(view, event);
    }
    for (const enemy of view.enemies) {
      const was = this.castBefore.get(enemy.id) ?? 0;
      if (was > 0 && (enemy.boss?.castTicks ?? 0) === 0 && !interrupted.has(enemy.id) && enemy.alive) {
        const y = this.zone.heightAt(enemy.x, enemy.z);
        this.effects.shock(enemy.x, enemy.z, 60, 0xffd089, 0.6);
        this.effects.flash(enemy.x, y + 4, enemy.z, 0xffd089, 80, 0.4);
      }
    }
  }

  /** Draws a frame `alpha` of the way from the last tick to this one. */
  draw(view: GameView, alpha: number, dt: number, marks: Marks): void {
    this.drawUnits(view, alpha, dt, marks);
    this.drawEnemies(view, alpha, dt);
    this.drawShots(view, alpha);
    this.drawDrops(view, alpha, dt);
    this.drawTelegraphs(view);

    const target = view.enemies.find(({ id, alive }) => alive && id === view.sharedTargetId);
    const targetBody = target ? this.enemies.get(target.id) : undefined;
    this.targetRing.visible = Boolean(target && targetBody);
    if (target && targetBody) {
      const size = target.size + 1;
      this.targetRing.scale.set(size, 1, size);
      this.targetRing.position.set(targetBody.drawn.x, this.zone.heightAt(targetBody.drawn.x, targetBody.drawn.z) + 0.2, targetBody.drawn.z);
    }
    const mark = marks.move;
    const material = this.moveMark.material as MeshBasicMaterial;
    material.opacity = mark ? Math.max(0, 1 - mark.age * MOVE_MARK_FADE) : 0;
    if (mark) {
      material.color.setHex(mark.attack ? MARKS.attackMove : MARKS.move);
      this.moveMark.position.set(mark.x, this.zone.heightAt(mark.x, mark.z) + 0.3, mark.z);
    }
  }

  drawnUnits(): Drawn[] {
    return [...this.units.values()].map(({ drawn }) => drawn);
  }

  drawnEnemies(view: GameView): (Drawn & { readonly kind: string; readonly size: number })[] {
    return view.enemies.flatMap((enemy) => {
      const body = this.enemies.get(enemy.id);
      return body && enemy.alive ? [{ ...body.drawn, kind: enemy.kind, size: enemy.size }] : [];
    });
  }

  /** How much is drawn, for tests. */
  counts(): { units: number; enemies: number; shots: number; drops: number; telegraphs: number; rings: number } {
    return {
      units: this.units.size,
      enemies: this.enemies.size,
      shots: this.shots.size,
      drops: this.drops.size,
      telegraphs: this.telegraphs.size,
      rings: [...this.rings.values()].filter(({ visible }) => visible).length,
    };
  }

  dispose(): void {
    for (const body of [...this.units.values(), ...this.enemies.values()]) body.resources.dispose();
    for (const { materials } of this.telegraphs.values()) for (const material of materials) material.dispose();
    for (const material of this.enemyShotMaterials.values()) material.dispose();
    for (const material of this.enemyShotGlows.values()) material.dispose();
    this.units.clear();
    this.enemies.clear();
    this.telegraphs.clear();
  }

  private markMaterial(colour: number, opacity: number): MeshBasicMaterial {
    return new MeshBasicMaterial({ color: colour, transparent: true, opacity, depthWrite: false, side: DoubleSide });
  }

  private event(view: GameView, event: GameEvent): void {
    const unitAt = (id: number): UnitView | undefined => view.units.find((unit) => unit.id === id);
    const fx = this.effects;
    switch (event.type) {
      case 'hit': {
        const source = this.units.get(event.sourceId);
        if (source) source.swing = 1;
        const hurt = this.units.get(event.targetId);
        if (hurt) {
          hurt.flash = 1;
          fx.burst(hurt.drawn.x, hurt.drawn.y + 2, hurt.drawn.z, 0xff5a3c, 7, 8);
        }
        const struck = this.enemies.get(event.targetId);
        if (struck) struck.flash = 1;
        const attacker = this.enemies.get(event.sourceId);
        if (attacker) attacker.flash = Math.max(attacker.flash, 0.5);
        break;
      }
      case 'healed': {
        const unit = unitAt(event.unitId);
        if (unit) fx.burst(unit.x, this.zone.heightAt(unit.x, unit.z) + 2, unit.z, 0x9be8a6, 8, 6);
        break;
      }
      case 'spell-cast': {
        const caster = unitAt(event.unitId);
        const body = this.units.get(event.unitId);
        if (body) body.swing = 1;
        const look = spellLook(event.spell);
        if (look && caster) fx.shock(caster.x, caster.z, look.radius, look.colour, look.seconds);
        if (event.spell === 'rally') {
          for (const unit of view.units) {
            if (unit.alive) fx.burst(unit.x, this.zone.heightAt(unit.x, unit.z) + 3, unit.z, 0xffb648, 12, 6);
          }
        }
        break;
      }
      case 'unit-revived': {
        const unit = unitAt(event.unitId);
        if (unit) {
          fx.shock(unit.x, unit.z, 8, 0xffd089, 0.5);
          fx.burst(unit.x, 2 + this.zone.heightAt(unit.x, unit.z), unit.z, 0xffd089, 40, 12);
        }
        break;
      }
      case 'unit-down': {
        const unit = unitAt(event.unitId);
        if (unit) fx.burst(unit.x, 2 + this.zone.heightAt(unit.x, unit.z), unit.z, 0xffb648, 30, 14);
        break;
      }
      case 'level-up': {
        const unit = unitAt(event.unitId);
        if (unit) fx.burst(unit.x, 3 + this.zone.heightAt(unit.x, unit.z), unit.z, 0xffd089, 24, 8);
        break;
      }
      case 'enemy-down': {
        const body = this.enemies.get(event.enemyId);
        if (body) {
          body.dying = 0;
          const trim = monsterLook(body.kind).trim;
          fx.burst(body.drawn.x, body.drawn.y + 2, body.drawn.z, trim, 18, 13);
        }
        break;
      }
      default:
        break;
    }
  }

  private place(id: number, now: Point2, alpha: number): Point2 {
    const was = this.before.get(id) ?? now;
    return { x: lerp(was.x, now.x, alpha), z: lerp(was.z, now.z, alpha) };
  }

  private newBody(figure: Figure, resources: Resources, angle: number, kind: string): Body {
    this.layer.add(figure.root);
    return {
      figure,
      kind,
      scale: 1,
      resources,
      angle,
      walk: 0,
      swing: 0,
      flash: 0,
      windFrom: 0,
      dying: null,
      drawn: { id: 0, x: 0, y: 0, z: 0, share: 1, alive: true },
    };
  }

  private kit(resources: Resources): { resources: Resources; shapes: ZoneScene['shapes']; glow: ZoneScene['glow'] } {
    return { resources, shapes: this.zone.shapes, glow: this.zone.glow };
  }

  private drawUnits(view: GameView, alpha: number, dt: number, marks: Marks): void {
    const seen = new Set<number>();
    for (const unit of view.units) {
      seen.add(unit.id);
      let body = this.units.get(unit.id);
      if (!body) {
        const resources = new Resources();
        body = this.newBody(buildCharacter(this.kit(resources), characterLook(unit.classId)), resources, view.heading, unit.classId);
        this.units.set(unit.id, body);
        const ring = new Mesh(this.unitRing, this.ringMaterial);
        this.rings.set(unit.id, ring);
        this.layer.add(ring);
      }
      const at = this.place(unit.id, unit, alpha);
      const was = this.before.get(unit.id) ?? unit;
      const moving = Math.hypot(unit.x - was.x, unit.z - was.z) > MOVING;
      const target = view.enemies.find(({ id }) => id === unit.targetId);
      const facing = moving ? Math.atan2(unit.z - was.z, unit.x - was.x) : target ? Math.atan2(target.z - unit.z, target.x - unit.x) : body.angle;
      body.angle += angleBetween(body.angle, facing) * Math.min(1, dt * TURN_RATE);
      if (moving) body.walk += dt * WALK_RATE;
      body.swing = Math.max(0, body.swing - dt * SWING_DECAY);
      body.flash = Math.max(0, body.flash - dt * UNIT_FLASH_DECAY);
      const y = this.zone.heightAt(at.x, at.z);
      const { root, legs, arm, flashing } = body.figure;
      root.position.set(at.x, y + (unit.alive ? 0 : 0.4), at.z);
      root.rotation.set(unit.alive ? 0 : -Math.PI / 2, Math.PI / 2 - body.angle, 0, 'YXZ');
      const stride = moving && unit.alive ? Math.sin(body.walk) * 0.8 : 0;
      legs[0]?.rotation.set(stride, 0, 0);
      legs[1]?.rotation.set(-stride, 0, 0);
      if (arm) arm.rotation.x = -1.2 - Math.sin(body.swing * Math.PI) * 0.8;
      const guard = unit.guardTicks > 0 ? 1 : 0;
      for (const material of flashing) {
        material.emissive.setRGB(body.flash * 0.6 + guard * 0.1, body.flash * 0.2 + guard * 0.3, body.flash * 0.2 + guard * 0.3);
      }
      body.drawn = { id: unit.id, x: at.x, y, z: at.z, share: unit.maxHealth > 0 ? unit.health / unit.maxHealth : 0, alive: unit.alive };
      const ring = this.rings.get(unit.id);
      if (ring) {
        ring.visible = unit.alive && marks.selected.has(unit.id);
        ring.position.set(at.x, y + 0.15, at.z);
      }
    }
    for (const [id, body] of this.units) {
      if (!seen.has(id)) {
        this.layer.remove(body.figure.root);
        body.resources.dispose();
        this.units.delete(id);
        const ring = this.rings.get(id);
        if (ring) this.layer.remove(ring);
        this.rings.delete(id);
      }
    }
  }

  private drawEnemies(view: GameView, alpha: number, dt: number): void {
    const seen = new Set<number>();
    const living = view.units.filter(({ alive }) => alive);
    for (const enemy of view.enemies) {
      seen.add(enemy.id);
      let body = this.enemies.get(enemy.id);
      const look = monsterLook(enemy.kind);
      if (!body) {
        const resources = new Resources();
        body = this.newBody(buildMonster(this.kit(resources), look), resources, Math.PI / 2, enemy.kind);
        this.enemies.set(enemy.id, body);
      }
      body.figure.root.visible = enemy.alive || body.dying !== null;
      const at = this.place(enemy.id, enemy, alpha);
      const was = this.before.get(enemy.id) ?? enemy;
      const speed = Math.hypot(enemy.x - was.x, enemy.z - was.z) * TICK_RATE;
      let facing = body.angle;
      if (enemy.boss?.phase === 'charging' || enemy.boss?.phase === 'aiming') {
        facing = enemy.boss.chargeAngle;
      } else if (enemy.awake && living.length > 0) {
        const nearest = living.reduce((best, unit) =>
          Math.hypot(unit.x - enemy.x, unit.z - enemy.z) < Math.hypot(best.x - enemy.x, best.z - enemy.z) ? unit : best,
        );
        facing = Math.atan2(nearest.z - enemy.z, nearest.x - enemy.x);
      }
      body.angle += angleBetween(body.angle, facing) * Math.min(1, dt * TURN_RATE);
      body.walk += dt * 10 * Math.min(1, speed / 3);
      body.flash = Math.max(0, body.flash - dt * ENEMY_FLASH_DECAY);
      this.squash(body, enemy);

      const y = this.zone.heightAt(at.x, at.z);
      const { root, legs, flashing, restGlow } = body.figure;
      root.position.set(at.x, y, at.z);
      root.rotation.y = Math.PI / 2 - body.angle;
      body.scale = enemy.size / look.modelSize;
      root.scale.setScalar(body.scale * (body.dying === null ? 1 : Math.max(0.01, 1 - body.dying / DEATH_SECONDS)));
      legs.forEach((leg, index) => {
        leg.rotation.x = Math.sin(body.walk + index * 2.2) * 0.6;
      });
      flashing.forEach((material, index) => {
        material.emissive.copy(restGlow[index] ?? new Color(0)).lerp(new Color(1, 1, 1), body.flash);
      });
      body.drawn = { id: enemy.id, x: at.x, y, z: at.z, share: enemy.health / enemy.maxHealth, alive: enemy.alive };
    }
    for (const [id, body] of this.enemies) {
      if (body.dying !== null) body.dying += dt;
      const gone = !seen.has(id) && (body.dying === null || body.dying >= DEATH_SECONDS);
      if (!seen.has(id) && body.dying !== null) {
        body.figure.root.scale.setScalar(body.scale * Math.max(0.01, 1 - body.dying / DEATH_SECONDS));
      }
      if (gone) {
        this.layer.remove(body.figure.root);
        body.resources.dispose();
        this.enemies.delete(id);
      } else if (seen.has(id) && body.dying !== null && body.dying >= DEATH_SECONDS) {
        body.dying = null;
      }
    }
  }

  /** Wind-ups and the boss's cast swell the body, as in the squad test. */
  private squash(body: Body, enemy: EnemyView): void {
    const { body: shape } = body.figure;
    const cast = enemy.boss?.castTicks ?? 0;
    if (cast > 0 && enemy.boss) {
      shape.scale.setScalar(1 + (1 - cast / enemy.boss.castTotalTicks) * 0.25);
    } else if (enemy.windTicks > 0) {
      if (body.windFrom === 0) body.windFrom = enemy.windTicks;
      const seconds = (body.windFrom - enemy.windTicks) / TICK_RATE;
      shape.scale.set(1 + seconds * 0.3, 1 - seconds * 0.3, 1 + seconds * 0.3);
    } else {
      body.windFrom = 0;
      shape.scale.setScalar(1);
    }
  }

  private drawShots(view: GameView, alpha: number): void {
    const seen = new Set<object>();
    const enemyKind = new Map(view.enemies.map((enemy) => [enemy.id, enemy.kind]));
    const draw = (shot: ShotView | EnemyShotView, make: () => Mesh, height: number, angle: number): void => {
      seen.add(shot);
      let mesh = this.shots.get(shot);
      if (!mesh) {
        mesh = make();
        this.shots.set(shot, mesh);
        this.layer.add(mesh);
      }
      const was = this.shotsBefore.get(shot) ?? shot;
      const x = lerp(was.x, shot.x, alpha);
      const z = lerp(was.z, shot.z, alpha);
      mesh.position.set(x, this.zone.heightAt(x, z) + height, z);
      mesh.rotation.y = Math.PI / 2 - angle;
    };
    for (const shot of view.shots) {
      const enemy = view.enemies.find(({ id }) => id === shot.enemyId);
      const angle = enemy ? Math.atan2(enemy.z - shot.z, enemy.x - shot.x) : 0;
      draw(shot, () => new Mesh(this.shotGeometry, this.shotMaterial), SHOT_HEIGHT, angle);
    }
    for (const shot of view.enemyShots) {
      const trim = monsterLook(enemyKind.get(shot.sourceId) ?? '').trim;
      draw(
        shot,
        () => {
          const mesh = new Mesh(this.enemyShotGeometry, this.enemyShotMaterial(trim));
          const glow = new Sprite(this.enemyShotGlow(trim));
          glow.scale.set(3, 3, 1);
          mesh.add(glow);
          return mesh;
        },
        ENEMY_SHOT_HEIGHT,
        Math.atan2(shot.speedZ, shot.speedX),
      );
    }
    for (const [shot, mesh] of this.shots) {
      if (!seen.has(shot)) {
        this.layer.remove(mesh);
        this.shots.delete(shot);
      }
    }
  }

  private enemyShotGlow(colour: number): SpriteMaterial {
    let material = this.enemyShotGlows.get(colour);
    if (!material) {
      material = looseGlowSprite(this.zone.glow, colour, 1).material;
      this.enemyShotGlows.set(colour, material);
    }
    return material;
  }

  private enemyShotMaterial(colour: number): MeshBasicMaterial {
    let material = this.enemyShotMaterials.get(colour);
    if (!material) {
      material = new MeshBasicMaterial({ color: colour });
      this.enemyShotMaterials.set(colour, material);
    }
    return material;
  }

  private drawDrops(view: GameView, alpha: number, dt: number): void {
    const seen = new Set<number>();
    for (const drop of view.drops) {
      seen.add(drop.id);
      let mesh = this.drops.get(drop.id);
      if (!mesh) {
        const coin = drop.kind === 'marks';
        mesh = new Mesh(this.zone.shapes.ico, coin ? this.coinMaterial : this.potionMaterial);
        mesh.scale.setScalar(coin ? 0.25 : 0.45);
        this.drops.set(drop.id, mesh);
        this.layer.add(mesh);
      }
      const at = this.place(drop.id, drop, alpha);
      const seconds = drop.ageTicks / TICK_RATE;
      const lift = drop.flightTicks > 0 ? Math.max(0, DROP_LIFT * seconds - DROP_FALL * seconds * seconds) : 0;
      mesh.position.set(at.x, this.zone.heightAt(at.x, at.z) + DROP_HEIGHT + lift, at.z);
      mesh.rotation.y += dt * 3;
    }
    for (const [id, mesh] of this.drops) {
      if (!seen.has(id)) {
        this.layer.remove(mesh);
        this.drops.delete(id);
      }
    }
  }

  /** Every dangerous move is drawn on the ground before it lands. */
  private drawTelegraphs(view: GameView): void {
    const seen = new Set<object>();
    for (const effect of view.scheduled) {
      seen.add(effect);
      const known = this.telegraphs.get(effect);
      if (known) known.last = effect;
      if (effect.kind === 'volley-strike') {
        if (!known) this.telegraphs.set(effect, { group: new Group(), materials: [], last: effect });
        continue;
      }
      let entry = known;
      if (!entry) {
        entry = this.buildTelegraph(effect);
        this.telegraphs.set(effect, entry);
        this.layer.add(entry.group);
      }
      const share = 1 - effect.ticks / effect.totalTicks;
      const [ring, fill] = entry.group.children;
      if (effect.kind === 'slam') {
        ring?.scale.set(effect.radius, 1, effect.radius);
        fill?.scale.set(effect.radius * share, 1, effect.radius * share);
      } else {
        fill?.scale.set(effect.width, 1, effect.length * share);
      }
    }
    for (const [effect, entry] of this.telegraphs) {
      if (seen.has(effect)) continue;
      const last = entry.last;
      if (last.kind === 'volley-strike' && last.ticks <= 1) {
        this.effects.shock(last.x, last.z, 8, 0xffd089, 0.22);
        this.effects.burst(last.x, 3 + this.zone.heightAt(last.x, last.z), last.z, 0xffd089, 12, 11);
      } else if (last.kind === 'slam' && last.ticks <= 1) {
        this.effects.shock(last.x, last.z, last.radius, 0xff9a5a);
        this.effects.burst(last.x, 3 + this.zone.heightAt(last.x, last.z), last.z, 0xffb648, 26, 14);
      }
      this.layer.remove(entry.group);
      for (const material of entry.materials) material.dispose();
      this.telegraphs.delete(effect);
    }
  }

  private buildTelegraph(effect: Exclude<ScheduledView, { kind: 'volley-strike' }>): { group: Group; materials: MeshBasicMaterial[]; last: ScheduledView } {
    const group = new Group();
    const material = (opacity: number): MeshBasicMaterial =>
      new MeshBasicMaterial({ color: MARKS.telegraph, transparent: true, opacity, depthWrite: false, side: DoubleSide });
    const y = this.zone.heightAt(effect.x, effect.z);
    group.position.set(effect.x, y + 0.22, effect.z);
    if (effect.kind === 'slam') {
      const ring = material(0.75);
      const disc = material(0.22);
      group.add(new Mesh(this.teleRing, ring), new Mesh(this.teleDisc, disc));
      return { group, materials: [ring, disc], last: effect };
    }
    const fill = material(0.28);
    group.position.y += 0.02;
    group.rotation.y = Math.PI / 2 - effect.angle;
    const placeholder = new Group();
    group.add(placeholder, new Mesh(this.telePlane, fill));
    return { group, materials: [fill], last: effect };
  }
}
