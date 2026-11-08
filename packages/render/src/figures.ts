import { Color, Group, type Mesh, type MeshPhongMaterial, type Texture } from 'three';
import {
  basicMaterial,
  figureMaterial,
  glowSprite,
  part,
  type Resources,
  type Shapes,
} from './kit';
import type { CharacterLook, MonsterLook } from './looks';

/** A drawn body. Figures face +z, as in the squad test. */
export interface Figure {
  readonly root: Group;
  readonly body: Group;
  readonly arm: Group | null;
  readonly legs: readonly Mesh[];
  /** Materials that flash white on a hit. */
  readonly flashing: readonly MeshPhongMaterial[];
  /** Each flashing material's resting glow. */
  readonly restGlow: readonly Color[];
}

const TAU = 2 * Math.PI;

interface Kit {
  readonly resources: Resources;
  readonly shapes: Shapes;
  readonly glow: Texture;
}

/** A character, from the squad test's model, dressed by its look. */
export function buildCharacter(kit: Kit, look: CharacterLook): Figure {
  const { resources, shapes: G } = kit;
  const coat = figureMaterial(resources, look.coat);
  const dark = figureMaterial(resources, 0x20282c);
  const skin = figureMaterial(resources, 0xe0b58f);
  const trim = figureMaterial(resources, 0xcfa45a);
  const steel = figureMaterial(resources, 0x9aa4a8);
  const wood = figureMaterial(resources, 0x6a4a30);
  const blade = figureMaterial(resources, 0xd5dde0);
  const root = new Group();
  const body = new Group();
  const arm = new Group();
  const legs: Mesh[] = [];

  body.add(
    part(G.cone, coat, [0.8, 2.2, 0.8], [0, 1.45, 0]),
    part(G.cyl, coat, [0.42, 0.9, 0.38], [0, 2.5, 0]),
    part(G.box, trim, [0.9, 0.1, 0.1], [0, 2.3, 0.32]),
    part(G.ico, skin, [0.36, 0.38, 0.36], [0, 3.2, 0]),
  );
  if (look.hat === 'helm') {
    body.add(part(G.ico, steel, [0.42, 0.3, 0.42], [0, 3.5, 0]), part(G.box, steel, [1.25, 0.22, 0.5], [0, 2.85, 0]));
  } else if (look.hat === 'brim') {
    body.add(part(G.cyl, dark, [0.62, 0.06, 0.62], [0, 3.42, 0]), part(G.cyl, dark, [0.33, 0.34, 0.33], [0, 3.6, 0]));
  } else if (look.hat === 'hood') {
    body.add(part(G.cone, coat, [0.42, 0.62, 0.42], [0, 3.72, 0]));
  }
  for (const side of [-1, 1]) {
    const leg = part(G.box, dark, [0.24, 0.95, 0.3], [side * 0.24, 0.48, 0]);
    legs.push(leg);
    body.add(leg);
  }
  arm.position.set(0.56, 2.6, 0);
  arm.add(part(G.box, coat, [0.22, 0.85, 0.26], [0, -0.38, 0.1]));
  if (look.weapon === 'sword') {
    arm.add(part(G.box, blade, [0.12, 0.08, 2.2], [0, -0.8, 1.2]));
    const shield = part(G.cyl, figureMaterial(resources, 0x7a5c3e), [0.6, 0.1, 0.6], [-0.72, 2, 0.2]);
    shield.rotation.z = Math.PI / 2;
    body.add(shield);
  } else if (look.weapon === 'rifle') {
    arm.add(part(G.box, wood, [0.13, 0.17, 1.3], [0, -0.8, 0.3]), part(G.box, blade, [0.08, 0.08, 2], [0, -0.74, 1.5]));
  } else if (look.weapon === 'staff') {
    arm.add(part(G.cyl, wood, [0.07, 3.4, 0.07], [0, -0.1, 1.75]));
    const lamp = part(G.ico, basicMaterial(resources, 0xffd089), [0.24, 0.24, 0.24], [0, 1.1, 1.75], false);
    const halo = glowSprite(resources, kit.glow, 0x8a5a1c, 3);
    halo.position.copy(lamp.position);
    arm.add(lamp, halo);
  }
  body.add(arm);
  root.add(body);
  return { root, body, arm, legs, flashing: [coat], restGlow: [new Color(0)] };
}

/** A monster, from the squad test's builders. Unknown bodies get a plain blob. */
export function buildMonster(kit: Kit, look: MonsterLook): Figure {
  const { resources, shapes: G } = kit;
  const trimGlow = new Color(look.trim).multiplyScalar(0.28);
  const a = figureMaterial(resources, look.colour);
  const b = figureMaterial(resources, look.trim, trimGlow);
  const eyeMaterial = basicMaterial(resources, 0xfff0c0);
  const root = new Group();
  const body = new Group();
  root.add(body);
  const legs: Mesh[] = [];
  const eyes = (y: number, z: number, w = 0.3, s = 1): void => {
    for (const side of [-1, 1]) {
      const eye = part(G.eye, eyeMaterial, [s, s, s], [side * w, y, z], false);
      body.add(eye);
    }
  };

  if (look.body === 'wasp') {
    body.add(
      part(G.sphere, a, [0.42, 0.42, 0.72], [0, 1.15, -0.55]),
      part(G.box, b, [0.84, 0.16, 0.14], [0, 1.15, -0.4]),
      part(G.box, b, [0.74, 0.16, 0.14], [0, 1.15, -0.72]),
      part(G.ico, b, [0.32, 0.32, 0.36], [0, 1.2, 0.1]),
      part(G.ico, a, [0.28, 0.28, 0.28], [0, 1.25, 0.55]),
    );
    const sting = part(G.cone, b, [0.1, 0.5, 0.1], [0, 1.1, -1.45]);
    sting.rotation.x = -Math.PI / 2;
    body.add(sting);
    eyes(1.32, 0.78, 0.16);
    for (const side of [-1, 1]) {
      const wing = part(G.box, basicMaterial(resources, 0xe8eef0), [0.95, 0.03, 0.34], [side * 0.72, 1.6, 0.05]);
      wing.rotation.z = side * 0.35;
      body.add(wing);
      legs.push(wing);
    }
  } else if (look.body === 'rooster') {
    body.add(
      part(G.sphere, a, [0.75, 0.8, 0.95], [0, 1.4, 0]),
      part(G.cyl, a, [0.3, 0.7, 0.3], [0, 2.2, 0.5]),
      part(G.ico, a, [0.38, 0.38, 0.4], [0, 2.7, 0.6]),
      part(G.box, b, [0.1, 0.42, 0.55], [0, 3.15, 0.55]),
      part(G.ico, b, [0.13, 0.26, 0.13], [0, 2.3, 1]),
    );
    const beak = part(G.cone, figureMaterial(resources, 0xe8b040), [0.14, 0.42, 0.14], [0, 2.68, 1.15]);
    beak.rotation.x = Math.PI / 2;
    body.add(beak);
    eyes(2.82, 0.92, 0.22, 0.9);
    [-0.55, 0, 0.55].forEach((spread, index) => {
      const feather = part(G.cone, index === 1 ? b : a, [0.22, 1.5, 0.22], [spread * 0.7, 2.2, -1.05]);
      feather.rotation.set(-0.7, 0, -spread);
      body.add(feather);
    });
    for (const side of [-1, 1]) {
      const leg = part(G.box, figureMaterial(resources, 0xe8b040), [0.12, 0.9, 0.12], [side * 0.34, 0.45, 0]);
      legs.push(leg);
      body.add(leg);
    }
  } else if (look.body === 'viper') {
    for (let index = 0; index < 8; index += 1) {
      const t = (index / 8) * TAU;
      const coil = part(G.sphere, index % 2 === 0 ? a : b, [0.42, 0.3, 0.42], [Math.cos(t) * 0.95, 0.3, Math.sin(t) * 0.95]);
      body.add(coil);
    }
    body.add(
      part(G.cyl, a, [0.28, 1.5, 0.28], [0, 1.15, 0]),
      part(G.sphere, b, [0.5, 0.2, 0.42], [0, 2, 0.05]),
      part(G.ico, a, [0.44, 0.28, 0.62], [0, 2.1, 0.45]),
      part(G.box, b, [0.06, 0.04, 0.5], [0, 2.02, 1.2]),
    );
    eyes(2.25, 0.8, 0.24);
  } else if (look.body === 'boar') {
    body.add(
      part(G.dodeca, a, [1.5, 1.35, 2.3], [0, 2.1, -0.2]),
      part(G.dodeca, a, [0.95, 0.9, 1.05], [0, 2.1, 2]),
      part(G.cyl, figureMaterial(resources, 0x8a6a58), [0.42, 0.3, 0.42], [0, 1.95, 3.1]),
    );
    body.children[body.children.length - 1]?.rotation.set(Math.PI / 2, 0, 0);
    eyes(2.55, 2.75, 0.5, 1.1);
    for (let index = 0; index < 6; index += 1) {
      const bristle = part(G.cone, figureMaterial(resources, 0x2c221c), [0.14, 0.7, 0.14], [0, 3.5, 1.4 - index * 0.75]);
      bristle.rotation.x = -0.35;
      body.add(bristle);
    }
    for (const side of [-1, 1]) {
      const tusk = part(G.cone, b, [0.13, 0.95, 0.13], [side * 0.55, 2, 3]);
      tusk.rotation.set(0.5, 0, side * -0.35);
      body.add(tusk);
      body.add(part(G.cone, a, [0.24, 0.5, 0.16], [side * 0.72, 3.1, 1.75]));
      for (const along of [-1.5, 1.1]) {
        const leg = part(G.box, figureMaterial(resources, 0x2c221c), [0.4, 1.3, 0.45], [side * 0.85, 0.65, along]);
        legs.push(leg);
        body.add(leg);
      }
    }
  } else if (look.body === 'brute') {
    body.add(
      part(G.dodeca, a, [1.4, 1.5, 1.1], [0, 2.5, 0]),
      part(G.ico, a, [0.55, 0.55, 0.55], [0, 4.1, 0.35]),
      part(G.ico, b, [0.5, 0.5, 0.25], [0, 2.7, 1]),
    );
    eyes(4.2, 0.8, 0.22, 1.2);
    for (const side of [-1, 1]) {
      body.add(part(G.ico, a, [0.7, 0.7, 0.7], [side * 1.7, 3.3, 0]));
      body.add(part(G.box, a, [0.6, 1.9, 0.6], [side * 1.85, 2, 0.2]), part(G.dodeca, b, [0.68, 0.68, 0.68], [side * 1.9, 0.85, 0.2]));
      const leg = part(G.box, a, [0.75, 1.4, 0.75], [side * 0.7, 0.7, 0]);
      legs.push(leg);
      body.add(leg);
    }
  } else if (look.body === 'post') {
    body.add(
      part(G.cyl, a, [0.35, 3, 0.35], [0, 1.5, 0]),
      part(G.box, a, [2.2, 0.3, 0.3], [0, 2.4, 0]),
      part(G.sphere, b, [0.6, 0.7, 0.6], [0, 3.4, 0]),
    );
  } else {
    body.add(part(G.dodeca, a, [1, 1, 1], [0, 1, 0]));
    eyes(1.3, 0.75, 0.3);
  }

  if (look.crowned) {
    body.add(glowSprite(resources, kit.glow, look.trim, 7));
    for (let index = 0; index < 9; index += 1) {
      const t = (index / 9) * TAU;
      const spike = part(G.cone, b, [0.16, 1, 0.16], [Math.cos(t) * 0.9, 3.4, Math.sin(t) * 0.7]);
      spike.rotation.set(Math.sin(t) * 0.5, 0, -Math.cos(t) * 0.5);
      body.add(spike);
    }
  }
  return { root, body, arm: null, legs, flashing: [a, b], restGlow: [new Color(0), trimGlow] };
}
