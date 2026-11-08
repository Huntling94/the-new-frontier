import {
  zoneGrid,
  type GameView,
  type Point,
  type ZoneView,
} from '@new-frontier/core';
import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  Float32BufferAttribute,
  IcosahedronGeometry,
  InstancedMesh,
  Mesh,
  MeshPhongMaterial,
  Object3D,
  PlaneGeometry,
  ShaderMaterial,
  Shape,
  ShapeGeometry,
  Vector2,
  Vector3,
  type Scene,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { basinSetting, type BasinSetting } from './basin-setting';
import { insideRing, landHeight, lineDistance, ringDistance, smooth, UNDER_FLOOR, type BasinPlan, type Strip } from './basin-shape';
import type { Resources } from './kit';
import { basinLook, type BasinLook, type ZoneLook } from './looks';
import { hash, painted, type Seen } from './town';

type Ground = Extract<ZoneView['ground'], { readonly shape: 'basin' }>;

/** The portal stands this far west of the door's point, cut into the range. */
const DOOR_SET_BACK = 6;

/** Land near the play area is cut finely, land far off coarsely under it. */
const LAND = { reach: 126, step: 2, wobble: 0.34, wobbleFrom: 3 };
const FAR_LAND = { reach: 430, step: 12, sink: 3 };
const FLOOR_TEXTURE_WIDTH = 2048;
const FLOOR_LIFT = 0;
const WATER_LIFT = 0.05;
const LAKE_SURFACE = -1.2;
const PLATEAU_HEIGHT = 9.5;
const RIDGE_HEIGHT = 4.6;
const CRAG = { spacing: 0.72, swell: 1.12 };
const LAVENDER = { step: 1.9, roadClear: 4.5 };
const SCRUB = { step: 3.1, share: 0.42 };
const PEBBLE = { step: 7, share: 0.5 };

const CUT = { inner: 4.5, outer: 9, maxSeen: 3 };
const CUT_HEAD = `uniform vec3 tnfEye;uniform vec3 tnfSeen[${CUT.maxSeen}];uniform int tnfCount;uniform float tnfFloor;varying vec3 vTnfWorld;\n`;
const CUT_BODY = `
{float f=0.;if(vTnfWorld.y>tnfFloor){for(int i=0;i<tnfCount;i++){vec3 ab=tnfSeen[i]-tnfEye;vec3 ap=vTnfWorld-tnfEye;float t=dot(ap,ab)/dot(ab,ab);if(t>0.&&t<.97){float d=length(ap-ab*t);f=max(f,1.-smoothstep(${CUT.inner.toFixed(1)},${CUT.outer.toFixed(1)},d));}}}
if(f>0.){float b=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));if(b<f*.9)discard;}}
`;
const WATER_VERTEX = `varying vec3 vP;void main(){vec4 w=modelMatrix*vec4(position,1.);vP=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`;
const WATER_FRAGMENT = `uniform vec3 deep,pale,fogC,glint;uniform float t;varying vec3 vP;void main(){float a=sin(vP.x*.21+t*.5+1.6*sin(vP.z*.13+t*.2));float b=sin(vP.z*.33-t*.42+1.3*sin(vP.x*.11));float f=.5+.26*a+.24*b;vec3 c=mix(deep,pale,f);float s=pow(max(0.,sin(vP.x*.9+t*.8+2.*sin(vP.z*.37))*sin(vP.z*1.1-t*.6+2.*sin(vP.x*.29))),60.);c+=glint*s*.12;float k=smoothstep(110.,430.,distance(vP,cameraPosition));gl_FragColor=vec4(mix(c,fogC,k),1.);}`;

interface Placed {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Width across, height and length, as a scale. */
  readonly sx: number;
  readonly sy: number;
  readonly sz: number;
  readonly ry: number;
  readonly colour: number;
}

const css = (colour: number, alpha = 1): string => {
  const c = new Color(colour);
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${alpha})`;
};

/** A jagged stone: a tapering column with its corners pushed about. */
function cragGeometry(seed: number): BufferGeometry {
  const geometry = new CylinderGeometry(0.58, 1, 1, 7, 2).translate(0, 0.5, 0);
  const positions = geometry.getAttribute('position');
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    const key = Math.round(x * 50) + Math.round(z * 37) * 3 + Math.round(y * 29) * 7 + seed;
    const push = y < 0.01 ? 0 : 0.22;
    positions.setXYZ(index, x * (1 + (hash(key, 1) - 0.5) * push * 2), y * (1 + (hash(key, 2) - 0.5) * 0.25), z * (1 + (hash(key, 3) - 0.5) * push * 2));
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** A lavender bush: a grey-green mound with purple spikes standing out of it. */
function sprigGeometry(mound: number, flower: number): BufferGeometry {
  const parts: BufferGeometry[] = [painted(new IcosahedronGeometry(0.46, 0).scale(1, 0.5, 1).translate(0, 0.18, 0), mound)];
  for (let spike = 0; spike < 10; spike += 1) {
    const angle = (spike / 10) * Math.PI * 2 + hash(spike, 3);
    const reach = spike === 0 ? 0 : 0.34 + hash(spike, 4) * 0.2;
    const tall = 0.65 + hash(spike, 5) * 0.4;
    parts.push(painted(new ConeGeometry(0.15, tall, 4).translate(Math.cos(angle) * reach, 0.42 + tall / 2, Math.sin(angle) * reach), flower));
  }
  const merged = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  return merged;
}

/** Points along a line, about `spacing` apart, with each stretch's heading. */
function along(points: readonly Point[], spacing: number): { x: number; z: number; at: number }[] {
  const out: { x: number; z: number; at: number }[] = [];
  let walked = 0;
  for (let index = 0; index + 1 < points.length; index += 1) {
    const a = points[index] as Point;
    const b = points[index + 1] as Point;
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    const count = Math.max(1, Math.round(length / spacing));
    for (let step = 0; step < count; step += 1) {
      const share = step / count;
      out.push({ x: a.x + (b.x - a.x) * share, z: a.z + (b.z - a.z) * share, at: walked + length * share });
    }
    walked += length;
  }
  const last = points[points.length - 1] as Point;
  out.push({ x: last.x, z: last.z, at: walked });
  return out;
}

/**
 * A basin's look, from its setting (M1 decisions 5 to 7 and 11): a dry limestone floor with lavender
 * thinning out from the east, grey ranges highest beside a pale lake, rock walls and a
 * plateau given height, the river and pool, a closed door and a blocked road. It reads the
 * layout and changes nothing in the rules.
 */
export class Basin {
  private readonly look: BasinLook = basinLook();
  private readonly setting: BasinSetting;
  private readonly plan: BasinPlan;
  private readonly level: number;
  private readonly waterUniforms;
  private readonly cut = {
    tnfEye: { value: new Vector3() },
    tnfSeen: { value: Array.from({ length: CUT.maxSeen }, () => new Vector3()) },
    tnfCount: { value: 0 },
    tnfFloor: { value: 0 },
  };
  private readonly grid: ReturnType<typeof zoneGrid>;
  private readonly zone: ZoneView;
  private readonly ground: Ground;
  private readonly keep: Resources;
  private readonly scene: Scene;
  private readonly rockMaterial: MeshPhongMaterial;

  constructor(view: GameView, zone: ZoneView, ground: Ground, keep: Resources, zoneLook: ZoneLook, scene: Scene) {
    this.setting = basinSetting(zone.id);
    this.zone = zone;
    this.ground = ground;
    this.keep = keep;
    this.scene = scene;
    this.level = zone.groundLevel;
    this.grid = zoneGrid(view);
    this.cut.tnfFloor.value = this.level + 0.3;
    this.waterUniforms = {
      t: { value: 0 },
      deep: { value: new Color(this.look.waterDeep) },
      pale: { value: new Color(this.look.waterPale) },
      glint: { value: new Color(this.look.waterGlint) },
      fogC: { value: new Color(zoneLook.sunrise.fog) },
    };
    const { door, closedRoad, lake, waterIds, waterOnward } = this.setting;
    const water: Strip[] = [
      ...ground.walls.filter(({ id }) => waterIds.includes(id)).map(({ points, width }) => ({ points, half: width / 2 })),
      ...waterOnward,
    ];
    const doorPass = [door, { x: door.x - DOOR_SET_BACK, z: door.z }];
    const gate = zone.gates[0];
    const eastPass = gate ? [{ x: gate.x, z: gate.z }, { x: gate.x + 110, z: gate.z - 6 }] : [];
    this.plan = {
      outline: ground.outline,
      lake,
      water,
      passes: [
        { points: doorPass, half: 6.5, shoulder: 4 },
        { points: eastPass, half: 9 },
        { points: [closedRoad.end, closedRoad.onward], half: 8 },
      ].filter(({ points }) => points.length > 0),
    };
    this.rockMaterial = this.cutAway(keep.keep(new MeshPhongMaterial({ flatShading: true, shininess: 4 })));

    this.buildLand();
    this.buildFloor();
    this.buildWater(water);
    this.buildRock();
    this.buildPlants();
    this.buildDoor();
    this.buildClosedRoad();
  }

  update(dt: number): void {
    this.waterUniforms.t.value += dt;
  }

  /** Cuts a soft hole in any rock between the eye and the squad, so a high range never hides it. */
  occlude(eye: Vector3, seen: readonly Seen[]): void {
    this.cut.tnfEye.value.copy(eye);
    const count = Math.min(seen.length, CUT.maxSeen);
    this.cut.tnfCount.value = count;
    for (let index = 0; index < count; index += 1) {
      const point = seen[index] as Seen;
      (this.cut.tnfSeen.value[index] as Vector3).set(point.x, point.y, point.z);
    }
  }

  /** Teaches a material to dissolve between the eye and the squad, in a screen-door pattern. */
  private cutAway<T extends MeshPhongMaterial>(material: T): T {
    material.onBeforeCompile = (shader): void => {
      Object.assign(shader.uniforms, this.cut);
      shader.vertexShader = `varying vec3 vTnfWorld;\n${shader.vertexShader.replace(
        '#include <project_vertex>',
        '#include <project_vertex>\nvec4 tnfW=vec4(transformed,1.);\n#ifdef USE_INSTANCING\ntnfW=instanceMatrix*tnfW;\n#endif\nvTnfWorld=(modelMatrix*tnfW).xyz;',
      )}`;
      shader.fragmentShader = `${CUT_HEAD}${shader.fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n${CUT_BODY}`)}`;
    };
    material.customProgramCacheKey = (): string => 'basin-cut-away';
    return material;
  }

  /** One colour for a facet of the land, from how high and how steep it is. */
  private landColour(height: number, drop: number, z: number, x: number, out: Color): void {
    const { look } = this;
    if (height < 0.5) {
      out.set(look.scree);
    } else {
      const south = smooth((z + 20) / 90);
      const steep = smooth((drop - 0.7) / 1.8);
      const up = smooth((height - 8) / 22);
      out.set(south > 0.6 && height < 7 ? look.rangeWarm : look.scree)
        .lerp(new Color(look.rangeLow), Math.max(steep, smooth(height / 6) * 0.8))
        .lerp(new Color(look.rangeHigh), up * 0.85);
    }
    // Faint bands of strata, so a slope reads as layered limestone.
    const band = height > 2 ? Math.sin(height * 1.15 + x * 0.015) * 0.035 : 0;
    out.multiplyScalar(0.96 + hash(Math.floor(x * 3), Math.floor(z * 3)) * 0.08 + band);
  }

  /** One sheet of land, every triangle its own colour so the facets read. */
  private landSheet(reach: number, step: number, sink: number, skipInside: number): BufferGeometry {
    const count = Math.round((reach * 2) / step);
    const size = count + 1;
    const heights = new Float32Array(size * size);
    const xs = new Float32Array(size * size);
    const zs = new Float32Array(size * size);
    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        const px = -reach + col * step;
        const pz = -reach + row * step;
        // Land well off the floor gets its corners pushed about, so the slopes are not ruled lines.
        const far = ringDistance(px, pz, this.plan.outline) > LAND.wobbleFrom && !insideRing(px, pz, this.plan.outline);
        const wx = far ? (hash(col, row) - 0.5) * step * LAND.wobble * 2 : 0;
        const wz = far ? (hash(row, col) - 0.5) * step * LAND.wobble * 2 : 0;
        const index = row * size + col;
        xs[index] = px + wx;
        zs[index] = pz + wz;
        heights[index] = landHeight(this.plan, px + wx, pz + wz);
      }
    }
    const positions: number[] = [];
    const colours: number[] = [];
    const colour = new Color();
    const corner = (i: number): [number, number, number] => [xs[i] ?? 0, heights[i] ?? 0, zs[i] ?? 0];
    const triangle = (a: number, b: number, c: number): void => {
      const [ax, ay, az] = corner(a);
      const [bx, by, bz] = corner(b);
      const [cx, cy, cz] = corner(c);
      const top = Math.max(ay, by, cy);
      const low = Math.min(ay, by, cy);
      const height = (ay + by + cy) / 3;
      this.landColour(height, (top - low) / step, (az + bz + cz) / 3, (ax + bx + cx) / 3, colour);
      for (const [x, y, z] of [[ax, ay, az], [bx, by, bz], [cx, cy, cz]] as const) {
        positions.push(x, this.level + y - sink, z);
        colours.push(colour.r, colour.g, colour.b);
      }
    };
    for (let row = 0; row < count; row += 1) {
      for (let col = 0; col < count; col += 1) {
        const a = row * size + col;
        const b = a + 1;
        const c = a + size;
        const d = c + 1;
        const quad = [a, b, c, d];
        // Under the floor no one sees it; under the fine sheet the coarse one is not needed.
        if (quad.every((i) => (heights[i] ?? 0) === UNDER_FLOOR)) continue;
        if (skipInside > 0 && quad.every((i) => Math.max(Math.abs(xs[i] ?? 0), Math.abs(zs[i] ?? 0)) < skipInside)) continue;
        triangle(a, c, b);
        triangle(b, c, d);
      }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new Float32BufferAttribute(colours, 3));
    geometry.computeVertexNormals();
    return geometry;
  }

  /** The ranges, the lake's bed and the land beyond them. */
  private buildLand(): void {
    const material = this.cutAway(this.keep.keep(new MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 0, specular: 0 })));
    const near = new Mesh(this.keep.keep(this.landSheet(LAND.reach, LAND.step, 0, 0)), material);
    near.castShadow = true;
    near.receiveShadow = true;
    const far = new Mesh(this.keep.keep(this.landSheet(FAR_LAND.reach, FAR_LAND.step, FAR_LAND.sink, LAND.reach - 1)), material);
    this.scene.add(near, far);
  }

  /** The dry floor, one sheet to the outline's exact edge, painted once on a canvas. */
  private buildFloor(): void {
    const { bounds, outline } = this.ground;
    const shape = new Shape(outline.map(({ x, z }) => new Vector2(x, -z)));
    const geometry = new ShapeGeometry(shape).rotateX(-Math.PI / 2);
    const positions = geometry.getAttribute('position');
    const uvs = new Float32Array(positions.count * 2);
    for (let index = 0; index < positions.count; index += 1) {
      uvs[index * 2] = (positions.getX(index) - bounds.minX) / (bounds.maxX - bounds.minX);
      uvs[index * 2 + 1] = 1 - (positions.getZ(index) - bounds.minZ) / (bounds.maxZ - bounds.minZ);
    }
    geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
    const texture = this.paintFloor();
    const material = this.keep.keep(new MeshPhongMaterial({ shininess: 0, specular: 0, ...(texture ? { map: texture } : { color: this.look.floor }) }));
    const floor = new Mesh(this.keep.keep(geometry), material);
    floor.position.y = this.level + FLOOR_LIFT;
    floor.receiveShadow = true;
    this.scene.add(floor);
  }

  /** Stroke a line from its midpoints, so a road bends instead of kinking. */
  private curve(context: CanvasRenderingContext2D, points: readonly Point[]): void {
    const first = points[0] as Point;
    context.beginPath();
    context.moveTo(first.x, first.z);
    for (let index = 1; index + 1 < points.length; index += 1) {
      const p = points[index] as Point;
      const n = points[index + 1] as Point;
      context.quadraticCurveTo(p.x, p.z, (p.x + n.x) / 2, (p.z + n.z) / 2);
    }
    const last = points[points.length - 1] as Point;
    context.lineTo(last.x, last.z);
  }

  /** A soft dark edge at the foot of anything standing, or a damp edge beside water. */
  private softEdge(context: CanvasRenderingContext2D, stroke: () => void, widest: number, colour: number, alpha: number): void {
    context.strokeStyle = css(colour, alpha / 3.2);
    for (let width = widest; width > 0.6; width *= 0.86) {
      context.lineWidth = width;
      stroke();
      context.stroke();
    }
  }

  private paintFloor(): CanvasTexture | null {
    if (typeof document === 'undefined') return null;
    const { look } = this;
    const { bounds, outline, walls, blocked } = this.ground;
    const spanX = bounds.maxX - bounds.minX;
    const spanZ = bounds.maxZ - bounds.minZ;
    const canvas = document.createElement('canvas');
    canvas.width = FLOOR_TEXTURE_WIDTH;
    canvas.height = Math.round((FLOOR_TEXTURE_WIDTH * spanZ) / spanX);
    const context = canvas.getContext('2d');
    if (!context) return null;
    const scale = canvas.width / spanX;
    context.setTransform(scale, 0, 0, scale, -bounds.minX * scale, -bounds.minZ * scale);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.fillStyle = css(look.floor);
    context.fillRect(bounds.minX, bounds.minZ, spanX, spanZ);

    // Broad patches of paler stone and ochre dust.
    for (let index = 0; index < 340; index += 1) {
      const x = bounds.minX + hash(index, 1) * spanX;
      const z = bounds.minZ + hash(index, 2) * spanZ;
      const radius = 4 + hash(index, 3) * 15;
      const colour = hash(index, 4) < 0.5 ? look.floorPale : look.floorOchre;
      const blot = context.createRadialGradient(x, z, 0, x, z, radius);
      blot.addColorStop(0, css(colour, 0.34));
      blot.addColorStop(1, css(colour, 0));
      context.fillStyle = blot;
      context.fillRect(x - radius, z - radius, radius * 2, radius * 2);
    }
    // The mauve of the heath, carried in from the east and thinning west.
    const east = context.createLinearGradient(this.setting.lavender.to, 0, this.setting.lavender.from, 0);
    east.addColorStop(0, css(look.floorMauve, 0.5));
    east.addColorStop(1, css(look.floorMauve, 0));
    context.fillStyle = east;
    context.fillRect(bounds.minX, bounds.minZ, spanX, spanZ);

    // Cracks in the limestone.
    context.strokeStyle = css(look.crack, 0.26);
    context.lineWidth = 0.09;
    for (let index = 0; index < 190; index += 1) {
      let x = bounds.minX + hash(index, 21) * spanX;
      let z = bounds.minZ + hash(index, 22) * spanZ;
      let heading = hash(index, 23) * Math.PI * 2;
      context.beginPath();
      context.moveTo(x, z);
      for (let step = 0; step < 5; step += 1) {
        heading += (hash(index, 30 + step) - 0.5) * 1.6;
        const stride = 0.8 + hash(index, 40 + step) * 1.8;
        x += Math.cos(heading) * stride;
        z += Math.sin(heading) * stride;
        context.lineTo(x, z);
      }
      context.stroke();
    }
    // Grit, so the ground has grain up close.
    for (let index = 0; index < 11000; index += 1) {
      const x = bounds.minX + hash(index, 51) * spanX;
      const z = bounds.minZ + hash(index, 52) * spanZ;
      const size = 0.06 + hash(index, 53) * 0.14;
      context.fillStyle = hash(index, 54) < 0.5 ? css(look.crack, 0.28) : css(look.floorPale, 0.5);
      context.fillRect(x, z, size, size);
    }

    // The worn road, then the fainter ways off it.
    const worn = (points: readonly Point[], width: number, strength: number): void => {
      this.softEdge(context, () => this.curve(context, points), width + 5, look.road, 0.34 * strength);
      for (const side of [-1, 1]) {
        context.strokeStyle = css(look.crack, 0.09 * strength);
        context.lineWidth = 0.5;
        context.beginPath();
        along(points, 4).forEach(({ x, z }, index, all) => {
          const next = all[Math.min(index + 1, all.length - 1)] ?? { x, z };
          const previous = all[Math.max(index - 1, 0)] ?? { x, z };
          const length = Math.hypot(next.x - previous.x, next.z - previous.z) || 1;
          const off = side * 1.5;
          const px = x + ((next.z - previous.z) / length) * off;
          const pz = z - ((next.x - previous.x) / length) * off;
          if (index === 0) context.moveTo(px, pz);
          else context.lineTo(px, pz);
        });
        context.stroke();
      }
    };
    worn(this.setting.road, 7, 1);
    for (const way of this.setting.ways) worn(way, 3.6, 0.55);

    // Damp ground by the water, and shade at the foot of every wall.
    for (const { id, points, width } of walls) {
      const isWater = this.setting.waterIds.includes(id);
      if (isWater) this.softEdge(context, () => this.curve(context, points), width + 6, look.damp, 0.16);
      else this.softEdge(context, () => this.curve(context, points), width + 4.5, look.shade, 0.1);
    }
    const ring = (points: readonly Point[]): (() => void) => () => {
      context.beginPath();
      points.forEach(({ x, z }, index) => (index === 0 ? context.moveTo(x, z) : context.lineTo(x, z)));
      context.closePath();
    };
    for (const { outline: points } of blocked) this.softEdge(context, ring(points), 6, look.shade, 0.1);
    this.softEdge(context, ring(outline), 9, look.shade, 0.13);

    const texture = this.keep.keep(new CanvasTexture(canvas));
    texture.anisotropy = 4;
    return texture;
  }

  /** The lake, the river and the pool, on one water surface. */
  private buildWater(water: readonly Strip[]): void {
    const keep = this.keep;
    const material = keep.keep(new ShaderMaterial({ uniforms: this.waterUniforms, vertexShader: WATER_VERTEX, fragmentShader: WATER_FRAGMENT }));
    const lakeShape = new Shape(this.setting.lake.map(({ x, z }) => new Vector2(x, -z)));
    const lake = new Mesh(keep.keep(new ShapeGeometry(lakeShape).rotateX(-Math.PI / 2)), material);
    lake.position.y = this.level + LAKE_SURFACE;
    this.scene.add(lake);

    const pieces: BufferGeometry[] = [];
    for (const { points, half } of water) {
      points.forEach((point, index) => {
        pieces.push(new CircleGeometry(half, 14).rotateX(-Math.PI / 2).translate(point.x, 0, point.z).toNonIndexed());
        const next = points[index + 1];
        if (!next) return;
        const length = Math.hypot(next.x - point.x, next.z - point.z);
        pieces.push(
          new PlaneGeometry(length, half * 2)
            .rotateX(-Math.PI / 2)
            .rotateY(-Math.atan2(next.z - point.z, next.x - point.x))
            .translate((point.x + next.x) / 2, 0, (point.z + next.z) / 2)
            .toNonIndexed(),
        );
      });
    }
    if (pieces.length > 0) {
      const merged = keep.keep(mergeGeometries(pieces));
      for (const piece of pieces) piece.dispose();
      const streams = new Mesh(merged, material);
      streams.position.y = this.level + WATER_LIFT;
      this.scene.add(streams);
    }
  }

  private colourOf(list: readonly number[], value: number, spread = 0.14): number {
    const base = list[Math.min(list.length - 1, Math.floor(value * list.length))] ?? 0x999999;
    return new Color(base).multiplyScalar(1 - spread + value * spread * 2).getHex();
  }

  /** Walls as runs of crags, each stone a little different, tapering at the ends. */
  private wallCrags(points: readonly Point[], width: number, height: number, salt: number, into: Placed[]): void {
    const radius = (width / 2) * CRAG.swell;
    const stops = along(points, radius * CRAG.spacing);
    const total = stops[stops.length - 1]?.at ?? 1;
    stops.forEach(({ x, z, at }, index) => {
      const taper = 0.55 + 0.45 * smooth(Math.min(at, total - at) / 2.5);
      const rise = height * taper * (0.72 + hash(index, salt) * 0.5);
      into.push({
        x,
        y: this.level - 0.1,
        z,
        sx: radius * (0.9 + hash(salt, index) * 0.35),
        sy: rise,
        sz: radius * (0.9 + hash(salt + 1, index) * 0.35),
        ry: hash(index, salt + 2) * 6.28,
        colour: this.colourOf(this.look.rock, hash(index, salt + 3)),
      });
    });
  }

  /** Scattered stones and the walls, in two shapes so the runs do not look stamped. */
  private buildRock(): void {
    const crags: Placed[] = [];
    this.ground.walls.forEach(({ id, points, width }, index) => {
      const height = this.setting.wallHeights[id];
      if (height !== undefined) this.wallCrags(points, width, height, 61 + index * 11, crags);
    });
    this.zone.obstacles.forEach(({ kind, x, z, radius }, index) => {
      if (kind !== 'rock') return;
      for (let stone = 0; stone < 4; stone += 1) {
        const angle = hash(index, stone) * 6.28;
        const off = stone === 0 ? 0 : radius * 0.45;
        crags.push({
          x: x + Math.cos(angle) * off,
          y: this.level - 0.1,
          z: z + Math.sin(angle) * off,
          sx: radius * (stone === 0 ? 1 : 0.62),
          sy: (2.2 + radius * 0.9) * (stone === 0 ? 1 : 0.55 + hash(stone, index) * 0.3),
          sz: radius * (stone === 0 ? 1 : 0.62),
          ry: hash(stone, index + 3) * 6.28,
          colour: this.colourOf(this.look.rock, hash(index + stone, 73)),
        });
      }
    });
    for (const { id, outline } of this.ground.blocked) {
      if (id === this.setting.plateauId) this.buildPlateau(outline);
      else this.fillRidge(outline, crags);
    }
    this.dressPlateau(crags);
    this.instance(cragGeometry(1), crags.filter((_, index) => index % 2 === 0), this.rockMaterial, true);
    this.instance(cragGeometry(2), crags.filter((_, index) => index % 2 === 1), this.rockMaterial, true);
  }

  /** Loose stones on the plateau's top, so it is not a bare lid. */
  private dressPlateau(into: Placed[]): void {
    const top = this.ground.blocked.find(({ id }) => id === this.setting.plateauId);
    if (!top) return;
    const west = Math.min(...top.outline.map(({ x }) => x)) - 1;
    const north = Math.min(...top.outline.map(({ z }) => z)) - 1;
    const wide = Math.max(...top.outline.map(({ x }) => x)) + 1 - west;
    const deep = Math.max(...top.outline.map(({ z }) => z)) + 1 - north;
    for (let index = 0; index < 90; index += 1) {
      const x = west + hash(index, 101) * wide;
      const z = north + hash(index, 102) * deep;
      if (!insideRing(x, z, top.outline) || ringDistance(x, z, top.outline) < 4.5) continue;
      const size = 0.25 + hash(index, 103) * 0.55;
      into.push({ x, y: this.level + PLATEAU_HEIGHT + 0.05, z, sx: size, sy: size * (1 + hash(index, 104)), sz: size, ry: hash(index, 105) * 6.28, colour: this.colourOf(this.look.rock, hash(index, 106)) });
    }
  }

  /** A narrow rock outcrop: stones across all of it, its rim as tall as its middle. */
  private fillRidge(outline: readonly Point[], into: Placed[]): void {
    const xs = outline.map(({ x }) => x);
    const zs = outline.map(({ z }) => z);
    const step = 1.5;
    let index = 0;
    for (let z = Math.min(...zs); z <= Math.max(...zs); z += step) {
      for (let x = Math.min(...xs); x <= Math.max(...xs); x += step) {
        index += 1;
        if (!insideRing(x, z, outline)) continue;
        const edge = ringDistance(x, z, outline);
        into.push({
          x: x + (hash(index, 81) - 0.5) * 0.6,
          y: this.level - 0.1,
          z: z + (hash(index, 82) - 0.5) * 0.6,
          sx: 1.3,
          sy: RIDGE_HEIGHT * (0.7 + smooth(edge / 1.5) * 0.3 + hash(index, 83) * 0.4),
          sz: 1.3,
          ry: hash(index, 84) * 6.28,
          colour: this.colourOf(this.look.rock, hash(index, 85)),
        });
      }
    }
  }

  /** The central plateau: banded limestone cliffs round a flat, scrubby top. */
  private buildPlateau(outline: readonly Point[]): void {
    const centre = outline.reduce((sum, { x, z }) => ({ x: sum.x + x / outline.length, z: sum.z + z / outline.length }), { x: 0, z: 0 });
    const closed = [...outline, outline[0] as Point];
    const rim = along(closed, 2.2).slice(0, -1);
    // Height above the floor, and how far in from the rules' outline each band sits.
    const bands = [
      { h: -0.1, inset: 0, colour: this.look.rock[1] ?? 0x8a8478 },
      { h: PLATEAU_HEIGHT * 0.34, inset: 0.05, colour: this.look.rock[2] ?? 0xa89f8c },
      { h: PLATEAU_HEIGHT * 0.38, inset: 0.1, colour: this.look.rock[0] ?? 0x9a9384 },
      { h: PLATEAU_HEIGHT * 0.78, inset: 0.14, colour: this.look.rock[2] ?? 0xa89f8c },
      { h: PLATEAU_HEIGHT * 0.82, inset: 0.19, colour: this.look.rock[0] ?? 0x9a9384 },
      { h: PLATEAU_HEIGHT, inset: 0.24, colour: this.look.rock[3] ?? 0xb7ad98 },
    ];
    const positions: number[] = [];
    const colours: number[] = [];
    const point = (stop: number, band: number): [number, number, number] => {
      const at = rim[(stop + rim.length) % rim.length] as Point;
      const b = bands[band] as (typeof bands)[number];
      const seed = (stop + rim.length) % rim.length;
      const wobble = band === 0 ? 0 : (hash(seed, band) - 0.5) * 0.05;
      const inset = b.inset + wobble;
      return [at.x + (centre.x - at.x) * inset, this.level + b.h + (band === 0 || band === bands.length - 1 ? 0 : (hash(band, seed) - 0.5) * 0.5), at.z + (centre.z - at.z) * inset];
    };
    const colour = new Color();
    const face = (a: readonly number[], b: readonly number[], c: readonly number[], tint: number, shade: number): void => {
      colour.set(tint).multiplyScalar(shade);
      positions.push(...a, ...b, ...c);
      for (let i = 0; i < 3; i += 1) colours.push(colour.r, colour.g, colour.b);
    };
    for (let band = 0; band + 1 < bands.length; band += 1) {
      for (let stop = 0; stop < rim.length; stop += 1) {
        const a = point(stop, band);
        const b = point(stop + 1, band);
        const c = point(stop, band + 1);
        const d = point(stop + 1, band + 1);
        const tint = (bands[band] as (typeof bands)[number]).colour;
        const shade = 0.9 + hash(stop, band + 9) * 0.2;
        face(a, c, b, tint, shade);
        face(b, c, d, tint, shade);
      }
    }
    const top: readonly number[] = [centre.x, this.level + PLATEAU_HEIGHT, centre.z];
    for (let stop = 0; stop < rim.length; stop += 1) {
      face(point(stop, bands.length - 1), top, point(stop + 1, bands.length - 1), this.look.plateauTop, 0.99 + hash(stop, 77) * 0.02);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new Float32BufferAttribute(colours, 3));
    geometry.computeVertexNormals();
    const material = this.cutAway(this.keep.keep(new MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 2 })));
    const mesh = new Mesh(this.keep.keep(geometry), material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
  }

  private instance(geometry: BufferGeometry, list: readonly Placed[], material: MeshPhongMaterial, shadow: boolean): void {
    this.keep.keep(geometry);
    if (list.length === 0) return;
    const mesh = this.keep.keep(new InstancedMesh(geometry, material, list.length));
    const dummy = new Object3D();
    const colour = new Color();
    list.forEach((item, index) => {
      dummy.position.set(item.x, item.y, item.z);
      dummy.rotation.set(0, item.ry, 0);
      dummy.scale.set(item.sx, item.sy, item.sz);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      mesh.setColorAt(index, colour.set(item.colour));
    });
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    this.scene.add(mesh);
  }

  /** Whether a character may stand at a point: plants grow only where they cannot sit in a rock. */
  private open(x: number, z: number): boolean {
    const { minX, minZ, cols, rows, cell, flags } = this.grid;
    const col = Math.floor((x - minX) / cell);
    const row = Math.floor((z - minZ) / cell);
    return col >= 0 && row >= 0 && col < cols && row < rows && (flags[row * cols + col] ?? 0) % 2 === 1;
  }

  /** Lavender drifts thinning out westward, dry grass everywhere, and loose stones. */
  private buildPlants(): void {
    const { look } = this;
    const { bounds } = this.ground;
    const lavender: Placed[] = [];
    const scrub: Placed[] = [];
    const pebbles: Placed[] = [];
    for (let z = bounds.minZ; z < bounds.maxZ; z += LAVENDER.step) {
      for (let x = bounds.minX; x < bounds.maxX; x += LAVENDER.step) {
        const px = x + hash(x, z) * LAVENDER.step;
        const pz = z + hash(z, x) * LAVENDER.step;
        if (!this.open(px, pz)) continue;
        const share = smooth((px - this.setting.lavender.from) / (this.setting.lavender.to - this.setting.lavender.from));
        const drift = hash(Math.floor(px / 7), Math.floor(pz / 7));
        if (hash(px + 7, pz) > share * (0.35 + drift) * 1.05) continue;
        if (lineDistance(px, pz, this.setting.road) < LAVENDER.roadClear) continue;
        const size = 0.8 + hash(pz, px + 3) * 0.6;
        const tint = new Color(1, 1, 1).multiplyScalar(0.88 + hash(px + 2, pz + 5) * 0.2).getHex();
        lavender.push({ x: px, y: this.level, z: pz, sx: size, sy: size, sz: size, ry: hash(px, pz + 9) * 6.28, colour: tint });
      }
    }
    for (let z = bounds.minZ; z < bounds.maxZ; z += SCRUB.step) {
      for (let x = bounds.minX; x < bounds.maxX; x += SCRUB.step) {
        const px = x + hash(x, z + 1) * SCRUB.step;
        const pz = z + hash(z, x + 1) * SCRUB.step;
        if (hash(px, pz + 13) > SCRUB.share || !this.open(px, pz) || lineDistance(px, pz, this.setting.road) < 3) continue;
        const size = 0.5 + hash(px + 1, pz) * 0.6;
        scrub.push({ x: px, y: this.level, z: pz, sx: size, sy: size, sz: size, ry: hash(pz, px) * 6.28, colour: this.colourOf(look.scrub, hash(px + 4, pz + 2), 0.12) });
      }
    }
    for (let z = bounds.minZ; z < bounds.maxZ; z += PEBBLE.step) {
      for (let x = bounds.minX; x < bounds.maxX; x += PEBBLE.step) {
        const px = x + hash(x, z + 2) * PEBBLE.step;
        const pz = z + hash(z, x + 2) * PEBBLE.step;
        if (hash(px, pz + 23) > PEBBLE.share || !this.open(px, pz)) continue;
        const size = 0.3 + hash(px + 3, pz) * 0.55;
        pebbles.push({ x: px, y: this.level + 0.05, z: pz, sx: size * 1.2, sy: size * 0.7, sz: size, ry: hash(pz, px + 5) * 6.28, colour: this.colourOf(look.rock, hash(px + 6, pz + 1)) });
      }
    }
    const material = this.keep.keep(new MeshPhongMaterial({ flatShading: true, shininess: 0, specular: 0 }));
    const bushes = this.keep.keep(new MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 0, specular: 0 }));
    this.instance(sprigGeometry(look.sage, look.lavender[0] ?? 0x9a78c4), lavender, bushes, false);
    this.instance(new ConeGeometry(0.42, 0.75, 5).translate(0, 0.32, 0), scrub, material, false);
    this.instance(new DodecahedronGeometry(1, 0), pebbles, material, true);
  }

  /** Merges painted parts into one mesh, standing at `at`. */
  private solid(parts: BufferGeometry[], at: Point, turn: number): void {
    const merged = this.keep.keep(mergeGeometries(parts));
    for (const part of parts) part.dispose();
    const material = this.cutAway(this.keep.keep(new MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 6 })));
    const mesh = new Mesh(merged, material);
    mesh.position.set(at.x, this.level, at.z);
    mesh.rotation.y = turn;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
  }

  /** The closed dungeon door at the west end (decision 6): a barred portal in a cutting. No gate leads through it. */
  private buildDoor(): void {
    const { door, rock, iron } = this.look.doorParts;
    const stone = rock;
    const dark = new Color(rock).multiplyScalar(0.55).getHex();
    const parts = [
      // Stepped sill, kept outside the ground a character can reach.
      painted(new BoxGeometry(18, 0.4, 3).translate(0, 0.2, 2), stone),
      painted(new BoxGeometry(14, 0.75, 1.8).translate(0, 0.38, 1.1), stone),
      // Jambs, each a heavy pier with a plinth.
      ...[-1, 1].flatMap((side) => [
        painted(new BoxGeometry(2.6, 12, 3.2).translate(side * 6, 6, 0), stone),
        painted(new BoxGeometry(3.4, 1.4, 3.8).translate(side * 6, 0.7, 0.2), dark),
        painted(new BoxGeometry(3.4, 1, 3.8).translate(side * 6, 12.2, 0.2), dark),
      ]),
      // Lintel with a keystone.
      painted(new BoxGeometry(17, 2.4, 3.4).translate(0, 13.6, 0), stone),
      painted(new BoxGeometry(3, 3.4, 3.8).translate(0, 13.8, 0.3), dark),
      // The two leaves, barred across.
      painted(new BoxGeometry(4.6, 11, 0.5).translate(-2.35, 5.5, 0.6), door),
      painted(new BoxGeometry(4.6, 11, 0.5).translate(2.35, 5.5, 0.6), door),
      ...[2.2, 5.5, 8.8].map((y) => painted(new BoxGeometry(9.5, 0.4, 0.2).translate(0, y, 0.95), iron)),
      painted(new BoxGeometry(11.4, 0.9, 0.7).translate(0, 5.2, 1.3), iron),
      ...[-1, 1].map((side) => painted(new BoxGeometry(1.1, 1.8, 1).translate(side * 5.2, 5.2, 1), iron)),
      // Unlit iron braziers either side, cold.
      ...[-1, 1].flatMap((side) => [
        painted(new CylinderGeometry(0.28, 0.4, 3.2, 6).translate(side * 9.4, 1.6, 2.2), iron),
        painted(new CylinderGeometry(1, 0.5, 0.7, 7).translate(side * 9.4, 3.4, 2.2), iron),
      ]),
    ];
    this.solid(parts, { x: this.setting.door.x - DOOR_SET_BACK, z: this.setting.door.z }, Math.PI / 2);
  }

  /** The road south, closed for now (decision 7): a rockfall at the basin's edge, and a barrier before it. */
  private buildClosedRoad(): void {
    const { x, z } = this.setting.closedRoad.end;
    const stones: Placed[] = [];
    for (let index = 0; index < 26; index += 1) {
      const across = -9 + (index % 13) * 1.5 + (hash(index, 91) - 0.5);
      const back = 2.4 + Math.floor(index / 13) * 2.6 + hash(index, 92) * 1.2;
      const big = 1.5 + hash(index, 93) * 1.5;
      stones.push({
        x: x + across,
        y: this.level - 0.1,
        z: z + back,
        sx: big,
        sy: (2.5 + hash(index, 94) * 3.5) * (1 - Math.abs(across) / 22),
        sz: big,
        ry: hash(index, 95) * 6.28,
        colour: this.colourOf(this.look.rock, hash(index, 96)),
      });
    }
    this.instance(cragGeometry(3), stones, this.rockMaterial, true);
    const { door: wood, iron } = this.look.doorParts;
    const parts: BufferGeometry[] = [];
    for (const px of [-7.5, -2.5, 2.5, 7.5]) {
      parts.push(painted(new BoxGeometry(0.5, 3, 0.5).rotateX(0.14).translate(px, 1.5, 0), wood));
    }
    for (const py of [1, 1.9, 2.6]) {
      parts.push(painted(new BoxGeometry(17, 0.3, 0.2).rotateZ(py * 0.015).translate(0, py, 0.32), wood));
    }
    parts.push(painted(new BoxGeometry(2, 1.2, 0.1).translate(0, 2.1, 0.5), iron));
    this.solid(parts, { x: x + 0.2, z: z + 1.9 }, -0.08);
  }
}
