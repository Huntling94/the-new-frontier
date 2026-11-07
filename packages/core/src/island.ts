/**
 * The island's shape, as pure functions of its data. Nothing here draws: the
 * renderer takes the mesh this file builds and decides how it looks.
 *
 * Coordinates: x and z run across the ground, and y is height. The sea is at
 * y = 0.
 */

const TAU = 2 * Math.PI;

export interface RimWave {
  /** Bumps around the coast. */
  readonly frequency: number;
  /** Size of the bumps, as a share of the radius. */
  readonly amplitude: number;
  readonly phase: number;
}

export interface NoiseOctave {
  readonly scale: number;
  readonly weight: number;
}

export interface NoiseData {
  readonly seedX: number;
  readonly seedZ: number;
  readonly seedScale: number;
  readonly octaves: readonly NoiseOctave[];
}

export interface ReliefData {
  /** Ground height at the island's average, above the sea. */
  readonly groundLevel: number;
  /** Height between the lowest and highest hills. */
  readonly height: number;
  /** Noise value that sits at ground level. */
  readonly midpoint: number;
  readonly noiseScale: number;
  readonly offsetX: number;
  readonly offsetZ: number;
  /** Higher values keep the hills going further towards the coast. */
  readonly edgeFalloff: number;
}

export interface CliffData {
  /** Share of the way to the rim where the land starts to fall away. */
  readonly start: number;
  readonly drop: number;
  /** Row of the noise table that roughens the cliff. */
  readonly noiseRow: number;
}

export interface SkirtData {
  /** Rings of underwater rock around the island. */
  readonly rings: number;
  /** How far the rock spreads past the rim, as a share of the radius. */
  readonly spread: number;
  readonly spreadJitter: number;
  /** How far below ground level the rock begins. */
  readonly topDrop: number;
  readonly depth: number;
  readonly depthJitter: number;
  /** Noise value treated as no change when spreading the rock. */
  readonly jitterMidpoint: number;
}

export interface MeshData {
  readonly rings: number;
  readonly segments: number;
  /** Below 1, this packs rings towards the coast, where detail matters most. */
  readonly ringSpacing: number;
}

export interface IslandData {
  readonly x: number;
  readonly z: number;
  readonly radius: number;
  readonly rimWaves: readonly RimWave[];
  readonly noise: NoiseData;
  readonly relief: ReliefData;
  readonly cliff: CliffData;
  readonly skirt: SkirtData;
  readonly mesh: MeshData;
}

/** Plain arrays, ready for any renderer. Every three positions are a vertex. */
export interface IslandMesh {
  readonly positions: readonly number[];
  readonly indices: readonly number[];
}

function hash(noise: NoiseData, x: number, z: number): number {
  const value = Math.sin(x * noise.seedX + z * noise.seedZ) * noise.seedScale;
  return value - Math.floor(value);
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

/** Smoothstep, 3t² − 2t³, written to use only the allowed numbers. */
function ease(t: number): number {
  return t * t * (1 + 2 * (1 - t));
}

function valueNoise(noise: NoiseData, x: number, z: number): number {
  const cellX = Math.floor(x);
  const cellZ = Math.floor(z);
  const u = ease(x - cellX);
  const v = ease(z - cellZ);
  const near = lerp(hash(noise, cellX, cellZ), hash(noise, cellX + 1, cellZ), u);
  const far = lerp(hash(noise, cellX, cellZ + 1), hash(noise, cellX + 1, cellZ + 1), u);
  return lerp(near, far, v);
}

function layeredNoise(noise: NoiseData, x: number, z: number): number {
  return noise.octaves.reduce(
    (sum, octave) => sum + valueNoise(noise, x * octave.scale, z * octave.scale) * octave.weight,
    0,
  );
}

/** Distance from the island's centre to its coast, in the direction of `angle`. */
export function rimRadiusAt(island: IslandData, angle: number): number {
  const waves = island.rimWaves.reduce(
    (sum, wave) => sum + wave.amplitude * Math.sin(wave.frequency * angle + wave.phase),
    0,
  );
  return island.radius * (1 + waves);
}

/** 0 at the island's centre, 1 on its coast, and more than 1 past it. */
export function coastDistanceAt(island: IslandData, x: number, z: number): number {
  const dx = x - island.x;
  const dz = z - island.z;
  return Math.hypot(dx, dz) / rimRadiusAt(island, Math.atan2(dz, dx));
}

function landHeight(island: IslandData, x: number, z: number, coastDistance: number): number {
  const { relief, noise } = island;
  const hills = layeredNoise(
    noise,
    x * relief.noiseScale + relief.offsetX,
    z * relief.noiseScale + relief.offsetZ,
  );
  const flatten = 1 - Math.pow(Math.min(coastDistance, 1), relief.edgeFalloff);
  return relief.groundLevel + relief.height * (hills - relief.midpoint) * flatten;
}

/** Height of the walkable ground at a point on the island. */
export function groundHeightAt(island: IslandData, x: number, z: number): number {
  return landHeight(island, x, z, coastDistanceAt(island, x, z));
}

function landVertex(island: IslandData, ring: number, segment: number): readonly number[] {
  const { mesh, noise, cliff } = island;
  const angle = (segment / mesh.segments) * TAU;
  const t = ring / mesh.rings;
  const radius = rimRadiusAt(island, angle) * Math.pow(t, mesh.ringSpacing);
  const x = island.x + Math.cos(angle) * radius;
  const z = island.z + Math.sin(angle) * radius;
  const falling = Math.max(t - cliff.start, 0);
  const drop = falling * cliff.drop * (1 + hash(noise, segment, cliff.noiseRow));
  return [x, landHeight(island, x, z, t) - drop, z];
}

function skirtVertex(island: IslandData, ring: number, segment: number): readonly number[] {
  const { mesh, noise, skirt, relief } = island;
  const angle = (segment / mesh.segments) * TAU;
  const t = (ring - mesh.rings) / skirt.rings;
  const roughness = hash(noise, segment, ring);
  const jitter = (roughness - skirt.jitterMidpoint) * skirt.spreadJitter;
  const radius = rimRadiusAt(island, angle) * (1 + t * skirt.spread + jitter);
  const x = island.x + Math.cos(angle) * radius;
  const z = island.z + Math.sin(angle) * radius;
  const y =
    relief.groundLevel - skirt.topDrop - t * t * skirt.depth - roughness * skirt.depthJitter;
  return [x, y, z];
}

/**
 * The island's surface as rings of vertices, from the centre out past the
 * coast and down under the sea.
 */
export function buildIslandMesh(island: IslandData): IslandMesh {
  const { rings, segments } = island.mesh;
  const allRings = rings + island.skirt.rings;
  const positions: number[] = [];
  const indices: number[] = [];

  for (let ring = 0; ring <= allRings; ring += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const vertex =
        ring <= rings ? landVertex(island, ring, segment) : skirtVertex(island, ring, segment);
      positions.push(...vertex);
    }
  }

  for (let ring = 0; ring < allRings; ring += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const next = (segment + 1) % segments;
      const a = ring * segments + segment;
      const b = ring * segments + next;
      const c = (ring + 1) * segments + segment;
      const d = (ring + 1) * segments + next;
      indices.push(a, b, c, b, d, c);
    }
  }

  return { positions, indices };
}
