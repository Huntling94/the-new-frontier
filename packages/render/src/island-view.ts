import { buildIslandMesh, type IslandData } from '@new-frontier/core';
import {
  CircleGeometry,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  Mesh,
  MeshLambertMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';
import { buildIslandGeometry } from './island-geometry';

const SKY = 0x9fc4dc;
const SEA = 0x2f6f8f;
const SEA_RADIUS = 1800;

export interface IslandView {
  resize(width: number, height: number, pixelRatio: number): void;
}

/** Draws one island, its sea, sky and light. Redraws only when resized. */
export function createIslandView(canvas: HTMLCanvasElement, island: IslandData): IslandView {
  const renderer = new WebGLRenderer({ canvas, antialias: true });

  const scene = new Scene();
  scene.background = new Color(SKY);
  scene.fog = new Fog(SKY, 320, 1100);

  scene.add(new HemisphereLight(0xdfeaf2, 0x3a4a50, 1.6));
  const sun = new DirectionalLight(0xfff2dc, 2);
  sun.position.set(120, 180, 90);
  scene.add(sun);

  const land = new Mesh(
    buildIslandGeometry(island, buildIslandMesh(island)),
    new MeshLambertMaterial({ vertexColors: true, flatShading: true }),
  );
  scene.add(land);

  const sea = new Mesh(new CircleGeometry(SEA_RADIUS, 64), new MeshLambertMaterial({ color: SEA }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(island.x, 0, island.z);
  scene.add(sea);

  const camera = new PerspectiveCamera(40, 1, 1, 2 * SEA_RADIUS);
  camera.position.set(island.x, 75, island.z + 265);
  camera.lookAt(island.x, 0, island.z);

  return {
    resize(width, height, pixelRatio) {
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    },
  };
}
