import {
  AdditiveBlending,
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DataTexture,
  DodecahedronGeometry,
  IcosahedronGeometry,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshPhongMaterial,
  RGBAFormat,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  type BufferGeometry,
  type ColorRepresentation,
  type Material,
  type Texture,
} from 'three';

/**
 * Keeps every geometry, material and texture a scene makes, so dropping the
 * scene frees all of them (decision 10). Nothing here is shared between scenes.
 */
export class Resources {
  private readonly owned = new Set<{ dispose(): void }>();

  keep<T extends { dispose(): void }>(resource: T): T {
    this.owned.add(resource);
    return resource;
  }

  get count(): number {
    return this.owned.size;
  }

  dispose(): void {
    for (const resource of this.owned) {
      resource.dispose();
    }
    this.owned.clear();
  }
}

/** Shapes the squad test builds its figures from, all of unit size. */
export interface Shapes {
  readonly sphere: BufferGeometry;
  readonly ico: BufferGeometry;
  readonly box: BufferGeometry;
  readonly cone: BufferGeometry;
  readonly cyl: BufferGeometry;
  readonly eye: BufferGeometry;
  readonly dodeca: BufferGeometry;
}

export function makeShapes(resources: Resources): Shapes {
  return {
    sphere: resources.keep(new IcosahedronGeometry(1, 1)),
    ico: resources.keep(new IcosahedronGeometry(1, 0)),
    box: resources.keep(new BoxGeometry(1, 1, 1)),
    cone: resources.keep(new ConeGeometry(1, 1, 6)),
    cyl: resources.keep(new CylinderGeometry(1, 1, 1, 7)),
    eye: resources.keep(new SphereGeometry(0.14, 6, 5)),
    dodeca: resources.keep(new DodecahedronGeometry(1, 0)),
  };
}

/** The squad test's flat-shaded figure material. */
export function figureMaterial(
  resources: Resources,
  colour: ColorRepresentation,
  emissive?: ColorRepresentation,
): MeshPhongMaterial {
  return resources.keep(
    new MeshPhongMaterial({
      color: colour,
      flatShading: true,
      shininess: 8,
      specular: 0x0a0a0a,
      emissive: emissive ?? 0x000000,
    }),
  );
}

/** One scaled, placed piece of a figure. */
export function part(
  geometry: BufferGeometry,
  material: Material,
  size: readonly [number, number, number],
  at: readonly [number, number, number],
  shadow = true,
): Mesh {
  const mesh = new Mesh(geometry, material);
  mesh.scale.set(...size);
  mesh.position.set(...at);
  mesh.castShadow = shadow;
  return mesh;
}

const GLOW_SIZE = 64;

/** A soft round glow, built in memory so it needs no page (and so tests can run it). */
export function makeGlowTexture(resources: Resources): Texture {
  const data = new Uint8Array(GLOW_SIZE * GLOW_SIZE * 4);
  const middle = (GLOW_SIZE - 1) / 2;
  for (let y = 0; y < GLOW_SIZE; y += 1) {
    for (let x = 0; x < GLOW_SIZE; x += 1) {
      const r = Math.min(Math.hypot(x - middle, y - middle) / middle, 1);
      // The squad test's gradient: white at the centre, 55% at a quarter, clear at the edge.
      const alpha = r < 0.25 ? 1 - (r / 0.25) * 0.45 : 0.55 * (1 - (r - 0.25) / 0.75);
      const index = (y * GLOW_SIZE + x) * 4;
      data.set([255, 255, 255, Math.round(alpha * 255)], index);
    }
  }
  const texture = new DataTexture(data, GLOW_SIZE, GLOW_SIZE, RGBAFormat);
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return resources.keep(texture);
}

/** A glow whose material the caller frees itself, for short-lived effects. */
export function looseGlowSprite(glow: Texture, colour: ColorRepresentation, size: number): Sprite {
  const sprite = new Sprite(
    new SpriteMaterial({
      map: glow,
      color: new Color(colour),
      blending: AdditiveBlending,
      depthWrite: false,
      transparent: true,
      fog: false,
    }),
  );
  sprite.scale.set(size, size, 1);
  return sprite;
}

export function glowSprite(
  resources: Resources,
  glow: Texture,
  colour: ColorRepresentation,
  size: number,
): Sprite {
  const sprite = looseGlowSprite(glow, colour, size);
  resources.keep(sprite.material);
  return sprite;
}

export function basicMaterial(resources: Resources, colour: ColorRepresentation): MeshBasicMaterial {
  return resources.keep(new MeshBasicMaterial({ color: colour }));
}
