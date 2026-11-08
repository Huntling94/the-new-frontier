import { zoneGrid, type GameView, type Obstacle, type Point, type ZoneView } from '@new-frontier/core';
import {
  Box3,
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  Float32BufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshPhongMaterial,
  Object3D,
  PlaneGeometry,
  Ray,
  RepeatWrapping,
  Shape,
  ShapeGeometry,
  Vector2,
  Vector3,
  type BufferGeometry,
  type Scene,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Resources } from './kit';
import { townLook, type TownLook, type ZoneLook } from './looks';

type Streets = Extract<ZoneView['ground'], { readonly shape: 'streets' }>;

/** A drawn point that a building must not hide, such as a living character's chest. */
export interface Seen {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** How far a building fades when it hides the squad, and how fast (S3d decision 9). */
const FADE = { opacity: 0.3, perSecond: 4 };

/** Building sizes, in world units. Fronts run along the street, depths run back from it. */
const FRONT = { least: 6, spread: 4 };
const DEPTH = { least: 7, spread: 4 };
const HEIGHT = { least: 5, spread: 5 };
const ROOF = { rise: 1.6, overhang: 0.5 };
const STOREY = 3;
/** Fronts stand back from a street's edge by this much, or by the second if the first will not fit. */
const SETBACKS = [1.2, 2.2];
/** How finely the town's ground is marked as taken, in world units. */
const TAKEN_CELL = 0.5;
/** Footprints are checked at points this far apart, this far inside their edges. */
const SAMPLE = { step: 0.75, inset: 0.3 };
/** The lattice that fills what the streets and their frontages leave. */
const FILL = { step: 9, size: 7 };
const TREES = { step: 5, keepOut: 4, share: 0.55 };
/** Streets are drawn this much wider than the rules' width, so cobbles reach the house fronts. */
const COBBLE_MARGIN = 2.4;
const COBBLE_TILE = 3;
const WALL = { thickness: 2, height: 4.5 };
/** The countryside round the town: a low plateau, falling to the sea at its rim. */
const COUNTRY = { radius: 170, rim: 200, depth: 8, rows: 4, along: 3, reach: 150, clear: 8 };
const LOT_SIZES: Readonly<Record<string, { w: number; d: number; h: number }>> = {
  smithy: { w: 9, d: 9, h: 6 },
  shop: { w: 9, d: 9, h: 7 },
  inn: { w: 11, d: 10, h: 10 },
};

/** A repeatable pseudo-random value from 0 to 1, so the town is the same on every visit. */
export function hash(a: number, b: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function pick<T>(list: readonly T[], value: number): T {
  return list[Math.min(list.length - 1, Math.floor(value * list.length))] as T;
}

/**
 * A geometry with one colour on every vertex, so many parts can share one material. It
 * comes back without an index, so parts of any shape can be merged into one.
 */
export function painted(shape: BufferGeometry, colour: number): BufferGeometry {
  const geometry = shape.index ? shape.toNonIndexed() : shape;
  if (geometry !== shape) shape.dispose();
  const c = new Color(colour);
  const count = geometry.getAttribute('position').count;
  const colours = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) colours.set([c.r, c.g, c.b], index * 3);
  geometry.setAttribute('color', new Float32BufferAttribute(colours, 3));
  return geometry;
}

interface Building {
  readonly mesh: Mesh;
  /** From the world into the building's own frame, where its box sits square. */
  readonly inverse: Matrix4;
  readonly box: Box3;
  opacity: number;
  faded: MeshPhongMaterial | null;
}

/**
 * A town's look (S3d): cobbled streets and a plaza, limestone houses with terracotta
 * roofs filling the ground the streets leave, the lots' buildings, the fountain, a
 * wall, gardens and lavender fields. Buildings are look only (D-022), and fade when
 * they stand between the camera and the squad (decision 9).
 */
export class Town {
  private readonly look: TownLook = townLook();
  private readonly buildings: Building[] = [];
  private readonly shared: MeshPhongMaterial;
  private readonly taken: Uint8Array;
  private readonly takenCols: number;
  private readonly grid: ReturnType<typeof zoneGrid>;
  private readonly ray = new Ray();
  private readonly local = new Ray();
  private readonly hit = new Vector3();
  private readonly trees: Point[] = [];
  private count = 0;
  private readonly zone: ZoneView;
  private readonly ground: Streets;
  private readonly keep: Resources;
  private readonly scene: Scene;

  constructor(view: GameView, zone: ZoneView, ground: Streets, keep: Resources, zoneLook: ZoneLook, scene: Scene) {
    this.zone = zone;
    this.ground = ground;
    this.keep = keep;
    this.scene = scene;
    this.grid = zoneGrid(view);
    const { bounds } = ground;
    this.takenCols = Math.ceil((bounds.maxX - bounds.minX) / TAKEN_CELL);
    this.taken = new Uint8Array(this.takenCols * Math.ceil((bounds.maxZ - bounds.minZ) / TAKEN_CELL));
    this.shared = keep.keep(new MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 4 }));

    this.buildCountry(zoneLook);
    this.buildStreets();
    for (const lot of zone.lots) this.buildLot(lot.id, lot.door, lot.facing);
    for (const { points, width } of ground.streets) this.buildFrontage(points, width / 2, false);
    for (const { outline } of ground.places) this.buildFrontage(outline, 0, true);
    this.buildFill();
    this.buildWall();
    this.buildTrees();
  }

  /** Builds a fountain for an obstacle of that kind. */
  buildFountain(obstacle: Obstacle, y: number): void {
    const keep = this.keep;
    const { radius } = obstacle;
    const stone = this.look.walls[0] ?? 0xe6dcc4;
    const parts = [
      // A basin, and the pool in it standing a little proud, inside a rim of stone.
      painted(new CylinderGeometry(radius, radius + 0.2, 0.9, 20).translate(0, 0.45, 0), stone),
      painted(new CylinderGeometry(radius * 0.86, radius * 0.86, 0.1, 20).translate(0, 0.93, 0), this.look.water),
      painted(new CylinderGeometry(0.35, 0.5, 2.6, 8).translate(0, 1.3, 0), stone),
      painted(new CylinderGeometry(1.1, 0.4, 0.5, 12).translate(0, 2.7, 0), stone),
      painted(new CylinderGeometry(0.9, 0.9, 0.08, 12).translate(0, 2.92, 0), this.look.water),
      painted(new DodecahedronGeometry(0.3, 0).translate(0, 3.2, 0), stone),
    ];
    const mesh = new Mesh(keep.keep(mergeGeometries(parts)), this.shared);
    for (const part of parts) part.dispose();
    mesh.position.set(obstacle.x, y, obstacle.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
  }

  /**
   * Fades every building that stands between the eye and any point to be seen, and
   * brings back any that no longer does (decision 9). Reads nothing from the rules.
   */
  occlude(eye: Vector3, seen: readonly Seen[], dt: number): void {
    const step = Math.min(1, dt * FADE.perSecond);
    for (const building of this.buildings) {
      const hides = seen.some((point) => this.hides(building, eye, point));
      const target = hides ? FADE.opacity : 1;
      building.opacity += Math.sign(target - building.opacity) * Math.min(Math.abs(target - building.opacity), step);
      if (building.opacity < 1) {
        building.faded ??= this.keep.keep(
          new MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 4, transparent: true, depthWrite: false }),
        );
        building.faded.opacity = building.opacity;
        building.mesh.material = building.faded;
      } else {
        building.mesh.material = this.shared;
      }
    }
  }

  /** How many buildings are faded, for tests. */
  fadedCount(): number {
    return this.buildings.filter(({ opacity }) => opacity < 1).length;
  }

  private hides(building: Building, eye: Vector3, point: Seen): boolean {
    const target = new Vector3(point.x, point.y, point.z);
    const distance = eye.distanceTo(target);
    this.ray.set(eye, target.sub(eye).normalize());
    this.local.copy(this.ray).applyMatrix4(building.inverse);
    // A building's frame only turns and moves, so distances are the same in it.
    return this.local.intersectBox(building.box, this.hit) !== null && this.local.origin.distanceTo(this.hit) < distance;
  }

  /** Whether any cell a character may stand in is next to a point. */
  private nearOpen(x: number, z: number): boolean {
    const { minX, minZ, cols, rows, cell, flags } = this.grid;
    const col = Math.floor((x - minX) / cell);
    const row = Math.floor((z - minZ) / cell);
    for (let dz = -1; dz <= 1; dz += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const c = col + dx;
        const r = row + dz;
        if (c >= 0 && r >= 0 && c < cols && r < rows && (flags[r * cols + c] ?? 0) % 2 === 1) return true;
      }
    }
    return false;
  }

  private takenIndex(x: number, z: number): number {
    const { bounds } = this.ground;
    const col = Math.floor((x - bounds.minX) / TAKEN_CELL);
    const row = Math.floor((z - bounds.minZ) / TAKEN_CELL);
    if (col < 0 || col >= this.takenCols || row < 0 || x >= bounds.maxX || z >= bounds.maxZ) return -1;
    return row * this.takenCols + col;
  }

  /** Points over a footprint, a little inside its edges. `along` and `back` are its axes. */
  private footprint(centre: Point, along: Point, back: Point, w: number, d: number): Point[] {
    const points: Point[] = [];
    const halfW = w / 2 - SAMPLE.inset;
    const halfD = d / 2 - SAMPLE.inset;
    for (let u = -halfW; u <= halfW + 1e-6; u += Math.min(SAMPLE.step, halfW * 2 || 1)) {
      for (let v = -halfD; v <= halfD + 1e-6; v += Math.min(SAMPLE.step, halfD * 2 || 1)) {
        points.push({ x: centre.x + along.x * u + back.x * v, z: centre.z + along.z * u + back.z * v });
      }
    }
    return points;
  }

  /** Takes a footprint if it is clear of the streets, the walls and every building already placed. */
  private claim(points: readonly Point[]): boolean {
    for (const { x, z } of points) {
      const index = this.takenIndex(x, z);
      if (index < 0 || this.taken[index] === 1 || this.nearOpen(x, z)) return false;
    }
    for (const { x, z } of points) this.taken[this.takenIndex(x, z)] = 1;
    return true;
  }

  /**
   * One building: walls, a hipped terracotta roof, a door and shuttered windows on
   * its front, which faces away from `back`. Extra parts are in the building's frame.
   */
  private addBuilding(centre: Point, back: Point, w: number, d: number, h: number, extras: BufferGeometry[] = []): void {
    const look = this.look;
    const n = (this.count += 1);
    const wall = pick(look.walls, hash(n, 3));
    const parts = [painted(new BoxGeometry(w, h, d).translate(0, h / 2, 0), wall), ...extras];
    parts.push(
      painted(
        new ConeGeometry(Math.SQRT1_2, 1, 4)
          .rotateY(Math.PI / 4)
          .scale(w + ROOF.overhang * 2, ROOF.rise, d + ROOF.overhang * 2)
          .translate(0, h + ROOF.rise / 2, 0),
        pick(look.roofs, hash(n, 4)),
      ),
    );
    const front = -d / 2 - 0.05;
    parts.push(painted(new BoxGeometry(1.3, 2.3, 0.15).translate(0, 1.15, front), look.door));
    for (let storey = 0; storey * STOREY + 2.4 < h - 0.6; storey += 1) {
      for (let u = -w / 2 + 1.4; u <= w / 2 - 1.2; u += 2.4) {
        if (storey === 0 && Math.abs(u) < 1.4) continue;
        parts.push(painted(new BoxGeometry(1, 1.3, 0.12).translate(u, storey * STOREY + 1.9, front), look.door));
      }
    }
    const geometry = this.keep.keep(mergeGeometries(parts));
    for (const part of parts) part.dispose();
    const mesh = new Mesh(geometry, this.shared);
    mesh.position.set(centre.x, this.zone.groundLevel, centre.z);
    // The frame's x runs along the front and its z runs back, so x is `back` turned a quarter.
    mesh.rotation.y = Math.atan2(back.x, back.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.updateMatrixWorld();
    this.scene.add(mesh);
    const box = new Box3(new Vector3(-w / 2, 0, -d / 2), new Vector3(w / 2, h + ROOF.rise, d / 2));
    this.buildings.push({ mesh, inverse: mesh.matrixWorld.clone().invert(), box, opacity: 1, faded: null });
  }

  /** Places a building on a footprint if it fits, and says whether it did. */
  private tryBuilding(centre: Point, back: Point, w: number, d: number, h: number, extras?: BufferGeometry[]): boolean {
    const along = { x: back.z, z: -back.x };
    if (!this.claim(this.footprint(centre, along, back, w, d))) {
      for (const extra of extras ?? []) extra.dispose();
      return false;
    }
    this.addBuilding(centre, back, w, d, h, extras);
    return true;
  }

  /** A lot's building, its front on the street at the door, with its sign and trade (decision 4). */
  private buildLot(id: string, door: Point, facing: number): void {
    const out = { x: Math.cos(facing), z: Math.sin(facing) };
    const back = { x: -out.x, z: -out.z };
    // Walk back from the door until clear of the street: that is the building's front.
    let reach = 0;
    while (this.nearOpen(door.x + back.x * reach, door.z + back.z * reach)) reach += 0.25;
    const { w, d, h } = LOT_SIZES[id] ?? { w: 9, d: 9, h: 7 };
    const front = { x: door.x + back.x * reach, z: door.z + back.z * reach };
    const look = this.look;
    const sign = look.signs[id] ?? look.door;
    const extras = [
      // An iron arm over the street, and the sign hanging from it.
      painted(new BoxGeometry(0.15, 0.15, 1.8).translate(w / 2 - 1.6, 4.4, -d / 2 - 0.9), look.door),
      painted(new BoxGeometry(1.5, 1.1, 0.12).translate(w / 2 - 1.6, 3.6, -d / 2 - 1.5), sign),
    ];
    if (id === 'smithy') {
      extras.push(painted(new BoxGeometry(1.2, 4, 1.2).translate(w / 2 - 1.2, h + 1, d / 2 - 1.5), 0x5c5664));
    }
    if (id === 'shop') {
      extras.push(painted(new BoxGeometry(w - 1.5, 0.15, 1.8).rotateX(-0.35).translate(0, 2.9, -d / 2 - 0.85), look.awning));
    }
    if (id === 'inn') {
      extras.push(painted(new BoxGeometry(w - 2, 0.25, 1.2).translate(0, 3.4, -d / 2 - 0.6), look.door));
    }
    this.tryBuilding({ x: front.x + back.x * (d / 2), z: front.z + back.z * (d / 2) }, back, w, d, h, extras);
  }

  /** Terraced houses along both sides of a line: a street's centreline, or a place's outline. */
  private buildFrontage(points: readonly Point[], halfWidth: number, closed: boolean): void {
    const count = closed ? points.length : points.length - 1;
    for (let index = 0; index < count; index += 1) {
      const from = points[index] as Point;
      const to = points[(index + 1) % points.length] as Point;
      const length = Math.hypot(to.x - from.x, to.z - from.z);
      const along = { x: (to.x - from.x) / length, z: (to.z - from.z) / length };
      for (const side of [-1, 1]) {
        const back = { x: -along.z * side, z: along.x * side };
        let t = 0;
        while (t < length) {
          const n = this.count + t;
          const w = FRONT.least + hash(n, 1 + side) * FRONT.spread;
          const d = DEPTH.least + hash(n, 5) * DEPTH.spread;
          const h = HEIGHT.least + hash(n, 6) * HEIGHT.spread;
          const placed = SETBACKS.some((setback) => {
            const reach = halfWidth + setback + d / 2;
            const centre = { x: from.x + along.x * (t + w / 2) + back.x * reach, z: from.z + along.z * (t + w / 2) + back.z * reach };
            return this.tryBuilding(centre, back, w, d, h);
          });
          t += placed ? w : 1.5;
        }
      }
    }
  }

  /** Fills what is left inside the town with more houses, set square. */
  private buildFill(): void {
    const { bounds } = this.ground;
    for (let z = bounds.minZ + FILL.size / 2; z < bounds.maxZ; z += FILL.step) {
      for (let x = bounds.minX + FILL.size / 2; x < bounds.maxX; x += FILL.step) {
        if (hash(x, z) < 0.25) continue;
        const h = HEIGHT.least + hash(z, x) * HEIGHT.spread;
        this.tryBuilding({ x, z }, { x: 0, z: 1 }, FILL.size, FILL.size, h);
      }
    }
  }

  /** A low limestone wall round the town, open where the gate street leaves. */
  private buildWall(): void {
    const { bounds } = this.ground;
    const t = WALL.thickness;
    const gates = this.zone.gates;
    const pieces: { minX: number; maxX: number; minZ: number; maxZ: number }[] = [
      { minX: bounds.minX - t, maxX: bounds.maxX + t, minZ: bounds.minZ - t, maxZ: bounds.minZ },
      { minX: bounds.minX - t, maxX: bounds.minX, minZ: bounds.minZ, maxZ: bounds.maxZ },
      { minX: bounds.maxX, maxX: bounds.maxX + t, minZ: bounds.minZ, maxZ: bounds.maxZ },
    ];
    // The south wall breaks for any gate near it, a street's width across.
    const south = gates
      .filter(({ z }) => z > bounds.maxZ - 10)
      .map(({ x }) => x)
      .sort((a, b) => a - b);
    let from = bounds.minX - t;
    for (const x of south) {
      pieces.push({ minX: from, maxX: x - 6.5, minZ: bounds.maxZ, maxZ: bounds.maxZ + t });
      from = x + 6.5;
    }
    pieces.push({ minX: from, maxX: bounds.maxX + t, minZ: bounds.maxZ, maxZ: bounds.maxZ + t });
    const colour = this.look.walls[3] ?? 0xd4c3a0;
    for (const piece of pieces) {
      const w = piece.maxX - piece.minX;
      const d = piece.maxZ - piece.minZ;
      const geometry = this.keep.keep(painted(new BoxGeometry(w, WALL.height, d).translate(0, WALL.height / 2, 0), colour));
      const mesh = new Mesh(geometry, this.shared);
      mesh.position.set((piece.minX + piece.maxX) / 2, this.zone.groundLevel, (piece.minZ + piece.maxZ) / 2);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.updateMatrixWorld();
      this.scene.add(mesh);
      const box = new Box3(new Vector3(-w / 2, 0, -d / 2), new Vector3(w / 2, WALL.height, d / 2));
      this.buildings.push({ mesh, inverse: mesh.matrixWorld.clone().invert(), box, opacity: 1, faded: null });
    }
  }

  /** Plane trees in the yards and gardens, well back from any street, each on a patch of grass. */
  private buildTrees(): void {
    const { bounds } = this.ground;
    for (let z = bounds.minZ + 2; z < bounds.maxZ - 2; z += TREES.step) {
      for (let x = bounds.minX + 2; x < bounds.maxX - 2; x += TREES.step) {
        if (hash(x + 0.5, z) > TREES.share) continue;
        const k = TREES.keepOut;
        const ring = [{ x, z }, { x: x - k, z }, { x: x + k, z }, { x, z: z - k }, { x, z: z + k }];
        if (ring.some((p) => this.nearOpen(p.x, p.z))) continue;
        if (!this.claim([{ x, z }, { x: x + 1, z }, { x, z: z + 1 }, { x: x + 1, z: z + 1 }])) continue;
        this.trees.push({ x, z });
      }
    }
    const y = this.zone.groundLevel;
    const look = this.look;
    const parts = {
      grass: painted(new CircleGeometry(3, 10).rotateX(-Math.PI / 2).translate(0, 0.02, 0), look.garden),
      trunk: painted(new CylinderGeometry(0.3, 0.45, 4.2, 6).translate(0, 2.1, 0), look.trunk),
      leaves: painted(new DodecahedronGeometry(2.4, 0).scale(1, 0.8, 1).translate(0, 5.4, 0), look.leaves),
    };
    const material = this.keep.keep(new MeshPhongMaterial({ vertexColors: true, flatShading: true }));
    const dummy = new Object3D();
    for (const [key, geometry] of Object.entries(parts)) {
      this.keep.keep(geometry);
      const mesh = this.keep.keep(new InstancedMesh(geometry, material, Math.max(1, this.trees.length)));
      mesh.count = this.trees.length;
      this.trees.forEach(({ x, z }, index) => {
        dummy.position.set(x, y, z);
        dummy.rotation.set(0, hash(x, z) * Math.PI * 2, 0);
        dummy.scale.setScalar(0.85 + hash(z, x) * 0.35);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
      });
      mesh.castShadow = key !== 'grass';
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    }
  }

  /** Cobbles: a small canvas of rounded stones, repeated over every street. */
  private cobbleTexture(): CanvasTexture {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    const base = new Color(this.look.cobbles);
    if (context) {
      context.fillStyle = `#${new Color(this.look.cobbleJoints).getHexString()}`;
      context.fillRect(0, 0, size, size);
      const stones = 8;
      const step = size / stones;
      for (let row = 0; row < stones; row += 1) {
        for (let col = 0; col < stones; col += 1) {
          const shade = base.clone().multiplyScalar(0.88 + hash(row, col) * 0.22);
          context.fillStyle = `#${shade.getHexString()}`;
          const offset = row % 2 === 0 ? 0 : step / 2;
          context.beginPath();
          context.roundRect((col * step + offset) % size, row * step + 1, step - 2, step - 2, 4);
          context.fill();
        }
      }
    }
    const texture = this.keep.keep(new CanvasTexture(canvas));
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    return texture;
  }

  /** The paved ground inside the wall, and the cobbled streets and plaza on it. */
  private buildStreets(): void {
    const { bounds, streets, places } = this.ground;
    const level = this.zone.groundLevel;
    const width = bounds.maxX - bounds.minX;
    const depth = bounds.maxZ - bounds.minZ;
    const paving = new Mesh(
      this.keep.keep(new PlaneGeometry(width, depth).rotateX(-Math.PI / 2)),
      this.keep.keep(new MeshPhongMaterial({ color: this.look.cobbleJoints, flatShading: true })),
    );
    paving.position.set((bounds.minX + bounds.maxX) / 2, level, (bounds.minZ + bounds.maxZ) / 2);
    paving.receiveShadow = true;

    const pieces: BufferGeometry[] = [];
    for (const street of streets) {
      const half = (street.width + COBBLE_MARGIN) / 2;
      street.points.forEach((point, index) => {
        pieces.push(new CircleGeometry(half, 20).rotateX(-Math.PI / 2).translate(point.x, 0, point.z));
        const next = street.points[index + 1];
        if (!next) return;
        const length = Math.hypot(next.x - point.x, next.z - point.z);
        pieces.push(
          new PlaneGeometry(length, half * 2)
            .rotateX(-Math.PI / 2)
            .rotateY(-Math.atan2(next.z - point.z, next.x - point.x))
            .translate((point.x + next.x) / 2, 0, (point.z + next.z) / 2),
        );
      });
    }
    for (const { outline } of places) {
      const shape = new Shape(outline.map(({ x, z }) => new Vector2(x, -z)));
      pieces.push(new ShapeGeometry(shape).rotateX(-Math.PI / 2));
    }
    // Every piece takes its texture from where it lies, so the cobbles run on across joins.
    for (const piece of pieces) {
      piece.deleteAttribute('uv');
      const positions = piece.getAttribute('position');
      const uvs = new Float32Array(positions.count * 2);
      for (let index = 0; index < positions.count; index += 1) {
        uvs[index * 2] = positions.getX(index) / COBBLE_TILE;
        uvs[index * 2 + 1] = positions.getZ(index) / COBBLE_TILE;
      }
      piece.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
    }
    const merged = this.keep.keep(mergeGeometries(pieces.map((piece) => (piece.index ? piece.toNonIndexed() : piece))));
    for (const piece of pieces) piece.dispose();
    const cobbles = new Mesh(merged, this.keep.keep(new MeshPhongMaterial({ map: this.cobbleTexture(), shininess: 2 })));
    cobbles.position.y = level + 0.04;
    cobbles.receiveShadow = true;
    this.scene.add(paving, cobbles);
  }

  /** A plateau of lavender fields round the town, in rows, falling to the sea. */
  private buildCountry(zoneLook: ZoneLook): void {
    const level = this.zone.groundLevel;
    const { bounds } = this.ground;
    const centre = { x: (bounds.minX + bounds.maxX) / 2, z: (bounds.minZ + bounds.maxZ) / 2 };
    const land = new Mesh(
      this.keep.keep(new CylinderGeometry(COUNTRY.radius, COUNTRY.rim, COUNTRY.depth, 48)),
      this.keep.keep(new MeshPhongMaterial({ color: zoneLook.highland, flatShading: true })),
    );
    land.position.set(centre.x, level - COUNTRY.depth / 2 - 0.02, centre.z);
    land.receiveShadow = true;
    this.scene.add(land);

    const rows: Point[] = [];
    for (let z = centre.z - COUNTRY.reach; z <= centre.z + COUNTRY.reach; z += COUNTRY.rows) {
      for (let x = centre.x - COUNTRY.reach; x <= centre.x + COUNTRY.reach; x += COUNTRY.along) {
        const inside = x > bounds.minX - COUNTRY.clear && x < bounds.maxX + COUNTRY.clear && z > bounds.minZ - COUNTRY.clear && z < bounds.maxZ + COUNTRY.clear;
        if (inside || Math.hypot(x - centre.x, z - centre.z) > COUNTRY.reach) continue;
        // The road out of the gate stays clear.
        if (this.zone.gates.some((gate) => Math.abs(x - gate.x) < 7 && z > gate.z)) continue;
        rows.push({ x, z });
      }
    }
    const geometry = this.keep.keep(painted(new DodecahedronGeometry(1, 0).scale(1.3, 0.7, 1.1).translate(0, 0.4, 0), this.look.lavender));
    const material = this.keep.keep(new MeshPhongMaterial({ vertexColors: true, flatShading: true }));
    const mesh = this.keep.keep(new InstancedMesh(geometry, material, rows.length));
    const dummy = new Object3D();
    rows.forEach(({ x, z }, index) => {
      dummy.position.set(x, level, z);
      dummy.scale.setScalar(0.8 + hash(x, z) * 0.4);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.receiveShadow = true;
    this.scene.add(mesh);
  }
}
