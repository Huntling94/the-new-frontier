import {
  buildIslandMesh,
  groundHeightAt,
  rimRadiusAt,
  type GameView,
  type IslandData,
  type ZoneView,
} from '@new-frontier/core';
import {
  AdditiveBlending,
  BackSide,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DodecahedronGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Fog,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshPhongMaterial,
  Object3D,
  PlaneGeometry,
  PointLight,
  Points,
  PointsMaterial,
  RingGeometry,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  type Sprite,
  type Texture,
} from 'three';
import { Basin } from './basin';
import { buildGroundGeometry } from './ground-geometry';
import { basicMaterial, glowSprite, makeGlowTexture, makeShapes, Resources, type Shapes } from './kit';
import { zoneLook, type Light, type ZoneLook } from './looks';
import { Town, type Seen } from './town';

const TAU = 2 * Math.PI;

/**
 * three.js r155 moved to physical light units. The squad test ran on r128, so
 * every light is scaled by π to give the same brightness (decision 8).
 */
const LEGACY_LIGHT = Math.PI;

/**
 * The lantern over the squad. Physical light falls off faster than r128's, so a
 * gentler decay and a lift keep the squad test's pool of light within 15 units.
 */
const LANTERN = { reach: 34, decay: 1, lift: 3.2 };

const SEA_SIZE = 2600;
const SEA_DETAIL = 200;
const SKY_RADIUS = 1900;
const MOTES = 170;
const MOTE_SPREAD = 50;
const MOTE_HEIGHT = 26;
const TUFTS = 320;
const DUSK = 0.12;

/** Model sizes: the core's obstacle radius divided by these gives each prop's scale. */
const STONE_RADIUS = 1.25;
const ROCK_RADIUS = 1.3;
/** A walled zone's walls rise this high, and its outer walls are this thick. */
const WALL_HEIGHT = 7;
const OUTER_WALL = 3;
/** A walled zone's floor is cut into squares this many units across, for its colour patches. */
const FLOOR_STEP = 2;

const SEA_VERTEX = `uniform float t;varying vec3 vP;varying float vH;void main(){vec4 w=modelMatrix*vec4(position,1.);float h=sin(w.x*.07+t*.9)*.42+sin(w.z*.09-t*.7)*.36+sin((w.x+w.z)*.16+t*1.4)*.16;w.y+=h;vH=h;vP=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`;
const SEA_FRAGMENT = `uniform vec3 deep,shallow,fogC,glint;uniform float t;varying vec3 vP;varying float vH;void main(){float f=clamp(.45+vH*.75,0.,1.);vec3 c=mix(deep,shallow,f);float s=pow(max(0.,sin(vP.x*.31+t*.8+2.*sin(vP.z*.13+t*.3))*sin(vP.z*.37-t*.6+2.*sin(vP.x*.17))),24.);c+=glint*s*.2;float k=smoothstep(170.,780.,distance(vP,cameraPosition));gl_FragColor=vec4(mix(c,fogC,k),1.);}`;
const SKY_VERTEX = `varying vec3 vD;void main(){vD=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const SKY_FRAGMENT = `uniform vec3 top,hor,sunC,sunD;varying vec3 vD;void main(){vec3 d=normalize(vD);float g=pow(1.-max(d.y,0.),3.);vec3 c=mix(top,hor,g);float a=max(dot(d,sunD),0.);c+=sunC*(pow(a,900.)*2.+pow(a,14.)*.32);gl_FragColor=vec4(c,1.);}`;

/** A repeatable pseudo-random value from 0 to 1, so dressing is the same on every visit. */
function hash(a: number, b: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

interface Beacon {
  readonly coal: Mesh;
  readonly halo: Sprite;
  readonly beam: Mesh;
  readonly lit: MeshBasicMaterial;
}

/**
 * Everything one zone draws that does not move with the game: ground, sea, sky,
 * light and props. It can be dropped and another built (decision 10, D-021).
 */
export class ZoneScene {
  readonly scene = new Scene();
  readonly resources = new Resources();
  readonly shapes: Shapes;
  readonly glow: Texture;
  readonly zone: ZoneView;
  readonly look: ZoneLook;
  /** Entities and effects are added here by their own layers. */
  readonly world = new Group();

  private readonly hemisphere = new HemisphereLight(0xbfd4e8, 0x2a2a30, 0.7);
  private readonly sun = new DirectionalLight(0xffffff, 1);
  private readonly lantern = new PointLight(0xffb648, 1, LANTERN.reach, LANTERN.decay);
  private readonly fog = new Fog(0x2a3a4a, 110, 430);
  private readonly sea: { readonly t: { value: number }; readonly deep: { value: Color }; readonly shallow: { value: Color }; readonly fogC: { value: Color }; readonly glint: { value: Color } };
  private readonly sky: { readonly top: { value: Color }; readonly hor: { value: Color }; readonly sunC: { value: Color }; readonly sunD: { value: Vector3 } };
  private readonly motes: Points;
  private readonly beacons: Beacon[] = [];
  /** A town's buildings and dressing (S3d), or null for any other ground. */
  private readonly town: Town | null = null;
  /** A basin's land, water and rock (M1), or null for any other ground. */
  private readonly basin: Basin | null = null;
  private dawn = DUSK;
  private time = 0;

  constructor(view: GameView, zone: ZoneView) {
    this.zone = zone;
    this.look = zoneLook(zone.id);
    const keep = this.resources;
    this.shapes = makeShapes(keep);
    this.glow = makeGlowTexture(keep);

    this.scene.fog = this.fog;
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1536, 1536);
    Object.assign(this.sun.shadow.camera, { left: -90, right: 90, top: 90, bottom: -90, near: 10, far: 320 });
    this.sun.shadow.bias = -0.0012;
    this.sun.shadow.normalBias = 0.4;
    this.scene.add(this.hemisphere, this.sun, this.sun.target, this.lantern, this.world);

    const groundMaterial = keep.keep(new MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 0, specular: 0 }));
    if (zone.ground.shape === 'island') {
      const island = zone.ground.island;
      const ground = new Mesh(keep.keep(buildGroundGeometry(island, buildIslandMesh(island), this.look)), groundMaterial);
      ground.receiveShadow = true;
      this.scene.add(ground, this.buildFoam(island));
    } else if (zone.ground.shape === 'walled') {
      this.buildCave(zone.ground, groundMaterial);
    } else if (zone.ground.shape === 'streets') {
      this.town = new Town(view, zone, zone.ground, keep, this.look, this.scene);
    } else {
      this.basin = new Basin(view, zone, zone.ground, keep, this.look, this.scene);
    }

    this.sea = {
      t: { value: 0 },
      deep: { value: new Color() },
      shallow: { value: new Color() },
      fogC: { value: new Color() },
      glint: { value: new Color() },
    };
    const sea = new Mesh(
      keep.keep(new PlaneGeometry(SEA_SIZE, SEA_SIZE, SEA_DETAIL, SEA_DETAIL).rotateX(-Math.PI / 2)),
      keep.keep(new ShaderMaterial({ uniforms: this.sea, vertexShader: SEA_VERTEX, fragmentShader: SEA_FRAGMENT })),
    );
    sea.position.set(zone.x, 0, zone.z);
    this.sky = {
      top: { value: new Color() },
      hor: { value: new Color() },
      sunC: { value: new Color() },
      sunD: { value: new Vector3(0.4, 0.15, -0.9).normalize() },
    };
    const sky = new Mesh(
      keep.keep(new SphereGeometry(SKY_RADIUS, 24, 16)),
      keep.keep(
        new ShaderMaterial({
          side: BackSide,
          depthWrite: false,
          fog: false,
          uniforms: this.sky,
          vertexShader: SKY_VERTEX,
          fragmentShader: SKY_FRAGMENT,
        }),
      ),
    );
    sky.frustumCulled = false;
    // A walled zone is underground: no sea and no sky, only the dark.
    // A basin is ringed by land, so it has the sky and no sea.
    if (zone.ground.shape === 'walled') this.scene.background = new Color(this.look.dusk.fog);
    else if (zone.ground.shape === 'basin') this.scene.add(sky);
    else this.scene.add(sea, sky);

    this.buildProps();
    for (const gate of zone.gates) this.buildGate(gate.x, gate.z, gate.radius);
    this.motes = this.buildMotes();
    // Underground, motes against the dark read as stars, so only open ground has them.
    if (zone.ground.shape === 'island' || zone.ground.shape === 'basin') this.scene.add(this.motes);
    this.applyLight(this.dawn);
  }

  heightAt(x: number, z: number): number {
    const { ground } = this.zone;
    return ground.shape === 'island' ? groundHeightAt(ground.island, x, z) : ground.level;
  }

  /** Moves light and dressing on. `focus` is where the camera looks. */
  update(dt: number, focus: { x: number; z: number }, squad: { x: number; z: number }): void {
    this.time += dt;
    this.sea.t.value = this.time;
    this.basin?.update(dt);

    this.sun.position.set(focus.x + 60, 130, focus.z + 70);
    this.sun.target.position.set(focus.x, 0, focus.z);
    this.lantern.position.set(squad.x, this.zone.groundLevel + 3, squad.z);

    const positions = this.motes.geometry.getAttribute('position') as BufferAttribute;
    for (let index = 0; index < MOTES; index += 1) {
      let y = positions.getY(index) + dt * 0.9;
      if (y > MOTE_HEIGHT) y = 0;
      positions.setY(index, y);
    }
    positions.needsUpdate = true;
    this.motes.position.set(focus.x, 3, focus.z);
  }

  /** Fades any building between the camera and the squad (S3d decision 9). Only towns have buildings. */
  occlude(eye: Vector3, seen: readonly Seen[], dt: number): void {
    this.town?.occlude(eye, seen, dt);
    this.basin?.occlude(eye, seen);
  }

  /** How many buildings are faded, for tests. */
  fadedBuildings(): number {
    return this.town?.fadedCount() ?? 0;
  }

  dispose(): void {
    // The renderer makes the sun's shadow map, and only the light can free it.
    this.sun.dispose();
    this.scene.clear();
    this.resources.dispose();
  }

  private applyLight(t: number): void {
    const { dusk, sunrise } = this.look;
    const mix = (out: Color, key: keyof Light): void => {
      out.set(dusk[key]).lerp(new Color(sunrise[key]), t);
    };
    mix(this.sky.top.value, 'skyTop');
    mix(this.sky.hor.value, 'horizon');
    mix(this.sea.deep.value, 'deep');
    mix(this.sea.shallow.value, 'shallow');
    mix(this.sea.glint.value, 'glint');
    mix(this.fog.color, 'fog');
    this.sea.fogC.value.copy(this.fog.color);
    mix(this.sun.color, 'sun');
    this.sky.sunC.value.copy(this.sun.color).multiplyScalar(0.25 + t * 0.9);
    this.sun.intensity = (dusk.sunIntensity + (sunrise.sunIntensity - dusk.sunIntensity) * t) * LEGACY_LIGHT;
    this.hemisphere.intensity = (dusk.hemisphere + (sunrise.hemisphere - dusk.hemisphere) * t) * LEGACY_LIGHT;
    this.lantern.intensity = (1.1 + (0.2 - 1.1) * t) * LEGACY_LIGHT * LANTERN.lift * (this.look.lantern ?? 1);
  }

  private buildFoam(ground: IslandData): Mesh {
    const segments = ground.mesh.segments;
    const positions: number[] = [];
    const indices: number[] = [];
    for (let segment = 0; segment <= segments; segment += 1) {
      const angle = (segment / segments) * TAU;
      const rim = rimRadiusAt(ground, angle);
      const inner = rim * 1.03;
      const outer = rim * (1.09 + 0.03 * Math.sin(angle * 11 + 1));
      positions.push(ground.x + Math.cos(angle) * inner, 0.18, ground.z + Math.sin(angle) * inner);
      positions.push(ground.x + Math.cos(angle) * outer, 0.18, ground.z + Math.sin(angle) * outer);
    }
    for (let segment = 0; segment < segments; segment += 1) {
      const i = segment * 2;
      indices.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
    }
    const geometry = this.resources.keep(new BufferGeometry());
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    return new Mesh(
      geometry,
      this.resources.keep(
        new MeshBasicMaterial({ color: 0xcfeee8, transparent: true, opacity: 0.22, side: DoubleSide, depthWrite: false }),
      ),
    );
  }

  private buildProps(): void {
    const keep = this.resources;
    const look = this.look;
    const parts = {
      // A rough four-sided standing stone, a little wider at the foot.
      stone: keep.keep(new CylinderGeometry(0.62, 0.95, 4.6, 4).translate(0, 2.1, 0)),
      cap: keep.keep(new DodecahedronGeometry(0.55, 0).scale(1, 0.5, 1).translate(0, 4.5, 0)),
      rock: keep.keep(new DodecahedronGeometry(1.4, 0).translate(0, 0.6, 0)),
      tuft: keep.keep(new ConeGeometry(0.28, 1, 3).translate(0, 0.4, 0)),
    };
    type Part = keyof typeof parts;
    const placed: Record<Part, { x: number; y: number; z: number; s: number; ry: number; c: number }[]> = {
      stone: [],
      cap: [],
      rock: [],
      tuft: [],
    };
    const { ground } = this.zone;
    this.zone.obstacles.forEach((obstacle, index) => {
      const { x, z } = obstacle;
      const y = this.heightAt(x, z);
      const ry = hash(index, 1) * TAU;
      if (obstacle.kind === 'stone') {
        const s = obstacle.radius / STONE_RADIUS;
        const shade = new Color(look.stone).multiplyScalar(0.85 + hash(index, 2) * 0.3).getHex();
        placed.stone.push({ x, y, z, s, ry, c: shade });
        placed.cap.push({ x, y, z, s, ry, c: look.rock });
      } else if (obstacle.kind === 'rock') {
        // A basin draws its own rocks, as runs of crags.
        if (ground.shape === 'basin') return;
        placed.rock.push({ x, y, z, s: obstacle.radius / ROCK_RADIUS, ry, c: look.rock });
      } else if (obstacle.kind === 'beacon') {
        this.buildBeacon(x, y, z);
      } else {
        this.town?.buildFountain(obstacle, y);
      }
    });
    for (let index = 0; ground.shape === 'island' && index < TUFTS; index += 1) {
      const angle = hash(index, 5) * TAU;
      const share = Math.sqrt(0.002 + hash(index, 6) * 0.778);
      const radius = rimRadiusAt(ground.island, angle) * share;
      const x = ground.island.x + Math.cos(angle) * radius;
      const z = ground.island.z + Math.sin(angle) * radius;
      placed.tuft.push({ x, y: this.heightAt(x, z), z, s: 0.7 + hash(index, 7) * 0.8, ry: hash(index, 8) * TAU, c: look.tuft });
    }

    const material = keep.keep(new MeshPhongMaterial({ flatShading: true }));
    const dummy = new Object3D();
    const colour = new Color();
    for (const key of Object.keys(parts) as Part[]) {
      const list = placed[key];
      if (list.length === 0) continue;
      const mesh = new InstancedMesh(parts[key], material, list.length);
      list.forEach((item, index) => {
        dummy.position.set(item.x, item.y, item.z);
        dummy.rotation.set(0, item.ry, 0);
        dummy.scale.setScalar(item.s);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
        mesh.setColorAt(index, colour.set(item.c));
      });
      mesh.castShadow = key !== 'tuft';
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      // An instanced mesh owns its instance buffers, so it is freed with the scene.
      keep.keep(mesh);
      this.scene.add(mesh);
    }
  }

  /** A walled zone: a flat floor in colour patches, its outer walls, and the walls inside it. */
  private buildCave(ground: Extract<ZoneView['ground'], { shape: 'walled' }>, material: MeshPhongMaterial): void {
    const keep = this.resources;
    const { bounds, level } = ground;
    const width = bounds.maxX - bounds.minX;
    const depth = bounds.maxZ - bounds.minZ;
    const floor = keep.keep(
      new PlaneGeometry(width, depth, Math.ceil(width / FLOOR_STEP), Math.ceil(depth / FLOOR_STEP)).rotateX(-Math.PI / 2),
    );
    const positions = floor.getAttribute('position') as BufferAttribute;
    const low = new Color(this.look.lowland);
    const high = new Color(this.look.highland);
    const colour = new Color();
    const colours: number[] = [];
    for (let index = 0; index < positions.count; index += 1) {
      const x = positions.getX(index);
      const z = positions.getZ(index);
      positions.setY(index, (hash(x, z) - 0.5) * 0.25);
      colour.copy(low).lerp(high, hash(Math.floor(x / 6), Math.floor(z / 6)) * 0.8);
      colours.push(colour.r, colour.g, colour.b);
    }
    floor.setAttribute('color', new Float32BufferAttribute(colours, 3));
    floor.computeVertexNormals();
    const mesh = new Mesh(floor, material);
    mesh.position.set((bounds.minX + bounds.maxX) / 2, level, (bounds.minZ + bounds.maxZ) / 2);
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    const wallMaterial = keep.keep(new MeshPhongMaterial({ color: this.look.stone, flatShading: true }));
    const outer = [
      { minX: bounds.minX - OUTER_WALL, maxX: bounds.maxX + OUTER_WALL, minZ: bounds.minZ - OUTER_WALL, maxZ: bounds.minZ },
      { minX: bounds.minX - OUTER_WALL, maxX: bounds.maxX + OUTER_WALL, minZ: bounds.maxZ, maxZ: bounds.maxZ + OUTER_WALL },
      { minX: bounds.minX - OUTER_WALL, maxX: bounds.minX, minZ: bounds.minZ, maxZ: bounds.maxZ },
      { minX: bounds.maxX, maxX: bounds.maxX + OUTER_WALL, minZ: bounds.minZ, maxZ: bounds.maxZ },
    ];
    for (const wall of [...outer, ...ground.walls]) {
      const box = new Mesh(keep.keep(new BoxGeometry(wall.maxX - wall.minX, WALL_HEIGHT, wall.maxZ - wall.minZ)), wallMaterial);
      box.position.set((wall.minX + wall.maxX) / 2, level + WALL_HEIGHT / 2, (wall.minZ + wall.maxZ) / 2);
      box.castShadow = true;
      box.receiveShadow = true;
      this.scene.add(box);
    }
  }

  /** A gate: two rough pillars and a lintel over a glowing ring on the ground (D-021). */
  private buildGate(x: number, z: number, radius: number): void {
    const keep = this.resources;
    const y = this.heightAt(x, z);
    const group = new Group();
    const stone = keep.keep(new MeshPhongMaterial({ color: this.look.rock, flatShading: true }));
    const pillar = keep.keep(new BoxGeometry(1.1, 5.2, 1.1));
    for (const side of [-1, 1]) {
      const post = new Mesh(pillar, stone);
      post.position.set(side * radius, 2.6, 0);
      post.castShadow = true;
      group.add(post);
    }
    const lintel = new Mesh(keep.keep(new BoxGeometry(radius * 2 + 2, 1, 1.4)), stone);
    lintel.position.y = 5.5;
    lintel.castShadow = true;
    const ring = new Mesh(
      keep.keep(new RingGeometry(radius * 0.7, radius, 32).rotateX(-Math.PI / 2)),
      keep.keep(
        new MeshBasicMaterial({
          color: this.look.gate,
          transparent: true,
          opacity: 0.45,
          blending: AdditiveBlending,
          depthWrite: false,
          side: DoubleSide,
        }),
      ),
    );
    ring.position.y = 0.15;
    const halo = glowSprite(keep, this.glow, this.look.gate, radius * 3);
    halo.position.y = 2;
    group.add(lintel, ring, halo);
    // The arch faces the middle of the zone, so the way in is the way the squad comes.
    group.rotation.y = Math.atan2(this.zone.x - x, this.zone.z - z);
    group.position.set(x, y, z);
    this.scene.add(group);
  }

  private buildBeacon(x: number, y: number, z: number): void {
    const keep = this.resources;
    const stone = keep.keep(new MeshPhongMaterial({ color: 0x5c6468, flatShading: true }));
    const group = new Group();
    const base = new Mesh(keep.keep(new CylinderGeometry(3.4, 4.4, 1.2, 7)), stone);
    const pillar = new Mesh(keep.keep(new CylinderGeometry(1.1, 1.7, 8, 6)), stone);
    const bowl = new Mesh(keep.keep(new CylinderGeometry(2.2, 1, 1.3, 7)), stone);
    base.position.y = 0.6;
    pillar.position.y = 5;
    bowl.position.y = 9.4;
    for (const mesh of [base, pillar, bowl]) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
    const coal = new Mesh(keep.keep(new IcosahedronGeometry(1.4, 0)), basicMaterial(keep, 0x2a2320));
    coal.position.y = 10;
    const halo = glowSprite(keep, this.glow, 0xffb648, 34);
    halo.position.y = 11;
    halo.visible = false;
    const beam = new Mesh(
      keep.keep(new CylinderGeometry(1.2, 2.6, 240, 12, 1, true)),
      keep.keep(
        new MeshBasicMaterial({
          color: 0xffc070,
          transparent: true,
          opacity: 0.16,
          blending: AdditiveBlending,
          depthWrite: false,
          side: DoubleSide,
          fog: false,
        }),
      ),
    );
    beam.position.y = 130;
    beam.visible = false;
    group.add(base, pillar, bowl, coal, halo, beam);
    group.position.set(x, y, z);
    this.scene.add(group);
    this.beacons.push({ coal, halo, beam, lit: basicMaterial(keep, 0xffd089) });
  }

  private buildMotes(): Points {
    const positions = new Float32Array(MOTES * 3);
    for (let index = 0; index < MOTES; index += 1) {
      positions[index * 3] = (hash(index, 11) * 2 - 1) * MOTE_SPREAD;
      positions[index * 3 + 1] = hash(index, 12) * MOTE_HEIGHT;
      positions[index * 3 + 2] = (hash(index, 13) * 2 - 1) * MOTE_SPREAD;
    }
    const geometry = this.resources.keep(new BufferGeometry());
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    const motes = new Points(
      geometry,
      this.resources.keep(
        new PointsMaterial({
          size: 0.38,
          map: this.glow,
          color: 0xfff2c0,
          transparent: true,
          depthWrite: false,
          blending: AdditiveBlending,
          opacity: 0.8,
        }),
      ),
    );
    motes.frustumCulled = false;
    return motes;
  }
}
