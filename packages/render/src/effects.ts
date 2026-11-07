import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
  RingGeometry,
  type Group,
  type Sprite,
} from 'three';
import { looseGlowSprite } from './kit';
import type { ZoneScene } from './zone-scene';

const PARTICLES = 520;
const GRAVITY = 22;
const FADE = 3;
const TAU = 2 * Math.PI;

interface Timed {
  age: number;
  readonly seconds: number;
  readonly update: (share: number) => void;
  readonly done: () => void;
}

const random = (low: number, high: number): number => low + Math.random() * (high - low);

/** Bursts, shock rings and flashes, as in the squad test. Look only; nothing here touches the game. */
export class Effects {
  private readonly positions = new Float32Array(PARTICLES * 3);
  private readonly colours = new Float32Array(PARTICLES * 3);
  private readonly speeds = new Float32Array(PARTICLES * 3);
  private readonly lives = new Float32Array(PARTICLES);
  private readonly geometry: BufferGeometry;
  private readonly ring: RingGeometry;
  private readonly timed: Timed[] = [];
  private readonly layer: Group;
  private head = 0;

  private readonly zone: ZoneScene;

  constructor(zone: ZoneScene) {
    this.zone = zone;
    this.layer = zone.world;
    const keep = zone.resources;
    this.geometry = keep.keep(new BufferGeometry());
    this.geometry.setAttribute('position', new BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new BufferAttribute(this.colours, 3));
    this.ring = keep.keep(new RingGeometry(0.93, 1, 44).rotateX(-Math.PI / 2));
    const points = new Points(
      this.geometry,
      keep.keep(
        new PointsMaterial({
          size: 0.85,
          map: zone.glow,
          vertexColors: true,
          transparent: true,
          depthWrite: false,
          blending: AdditiveBlending,
        }),
      ),
    );
    points.frustumCulled = false;
    this.layer.add(points);
  }

  burst(x: number, y: number, z: number, colour: number, count = 14, speed = 12): void {
    const tint = new Color(colour);
    for (let index = 0; index < count; index += 1) {
      this.head = (this.head + 1) % PARTICLES;
      const k = this.head;
      const angle = random(0, TAU);
      const lift = random(-0.4, 1);
      const pace = random(0.3, 1) * speed;
      this.positions.set([x, y, z], k * 3);
      this.speeds.set([Math.cos(angle) * pace, lift * pace + 3, Math.sin(angle) * pace], k * 3);
      this.colours.set([tint.r, tint.g, tint.b], k * 3);
      this.lives[k] = random(0.3, 0.8);
    }
  }

  /** A ring that spreads out over the ground and fades. */
  shock(x: number, z: number, radius: number, colour = 0xfff0c8, seconds = 0.35): void {
    const material = new MeshBasicMaterial({
      color: colour,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      side: DoubleSide,
      blending: AdditiveBlending,
    });
    const mesh = new Mesh(this.ring, material);
    mesh.position.set(x, this.zone.heightAt(x, z) + 0.3, z);
    this.layer.add(mesh);
    this.timed.push({
      age: 0,
      seconds,
      update: (share) => {
        const size = 0.2 + radius * Math.sqrt(share);
        mesh.scale.set(size, 1, size);
        material.opacity = 0.9 * (1 - share);
      },
      done: () => {
        this.layer.remove(mesh);
        material.dispose();
      },
    });
  }

  flash(x: number, y: number, z: number, colour: number, size: number, seconds = 0.3): void {
    const sprite: Sprite = looseGlowSprite(this.zone.glow, colour, size);
    sprite.position.set(x, y, z);
    this.layer.add(sprite);
    this.timed.push({
      age: 0,
      seconds,
      update: (share) => {
        sprite.material.opacity = 1 - share;
        const grown = size * (1 + share * 0.6);
        sprite.scale.set(grown, grown, 1);
      },
      done: () => {
        this.layer.remove(sprite);
        sprite.material.dispose();
      },
    });
  }

  update(dt: number): void {
    for (let k = 0; k < PARTICLES; k += 1) {
      const life = this.lives[k] ?? 0;
      if (life <= 0) {
        this.positions[k * 3 + 1] = -99;
        continue;
      }
      this.lives[k] = life - dt;
      this.speeds[k * 3 + 1] = (this.speeds[k * 3 + 1] ?? 0) - GRAVITY * dt;
      for (let axis = 0; axis < 3; axis += 1) {
        const at = k * 3 + axis;
        this.positions[at] = (this.positions[at] ?? 0) + (this.speeds[at] ?? 0) * dt;
        this.colours[at] = (this.colours[at] ?? 0) * (1 - FADE * dt);
      }
    }
    this.geometry.getAttribute('position').needsUpdate = true;
    this.geometry.getAttribute('color').needsUpdate = true;

    for (let index = this.timed.length - 1; index >= 0; index -= 1) {
      const effect = this.timed[index];
      if (!effect) continue;
      effect.age += dt;
      effect.update(Math.min(1, effect.age / effect.seconds));
      if (effect.age >= effect.seconds) {
        this.timed.splice(index, 1);
        effect.done();
      }
    }
  }

  /** Frees what is still in flight. The scene frees the rest. */
  dispose(): void {
    for (const effect of this.timed) effect.done();
    this.timed.length = 0;
  }

  get active(): number {
    return this.timed.length;
  }
}
