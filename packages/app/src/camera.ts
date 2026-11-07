import type { Point } from '@new-frontier/core';
import type { CameraPose } from '@new-frontier/render';
import { FEEL } from './feel';

/** The free camera from the squad test (D-003, D-013). It never touches the game. */
export interface Camera {
  /** The ground point it looks at. */
  x: number;
  z: number;
  zoom: number;
  zoomTarget: number;
  yaw: number;
  tiltAdjust: number;
  follow: boolean;
  /** Shake strength, from 0 to 1 (S2.3b decision 14). */
  shake: number;
}

const C = FEEL.camera;
const clamp = (value: number, low: number, high: number): number => Math.min(Math.max(value, low), high);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** The camera starts over the squad, with follow on (D-013). */
export function createCamera(at: Point): Camera {
  return { x: at.x, z: at.z, zoom: C.startZoom, zoomTarget: C.startZoom, yaw: 0, tiltAdjust: 0, follow: true, shake: 0 };
}

export function poseOf(camera: Camera, groundLevel: number): CameraPose {
  const distance = lerp(C.nearest, C.farthest, camera.zoom);
  const tilt = clamp(lerp(C.tiltIn, C.tiltOut, camera.zoom) + camera.tiltAdjust, C.tiltLeast, C.tiltMost);
  const flat = Math.cos(tilt) * distance;
  return {
    eye: {
      x: camera.x + Math.sin(camera.yaw) * flat,
      y: groundLevel + Math.sin(tilt) * distance,
      z: camera.z + Math.cos(camera.yaw) * flat,
    },
    target: { x: camera.x, y: groundLevel, z: camera.z },
  };
}

/** One wheel notch; positive zooms out. */
export function zoomBy(camera: Camera, notches: number): void {
  camera.zoomTarget = clamp(camera.zoomTarget + Math.sign(notches) * C.zoomStep, 0, 1);
}

export function easeZoom(camera: Camera, dt: number): void {
  camera.zoom += (camera.zoomTarget - camera.zoom) * Math.min(1, dt * C.zoomEasing);
}

/** Pans relative to the view: `right` and `back` are -1, 0 or 1. Panning turns follow off. */
export function pan(camera: Camera, right: number, back: number, dt: number): void {
  if (right === 0 && back === 0) return;
  const length = Math.hypot(right, back);
  const speed = lerp(C.panSlowest, C.panFastest, camera.zoom) * dt;
  const cos = Math.cos(camera.yaw);
  const sin = Math.sin(camera.yaw);
  const x = right / length;
  const z = back / length;
  camera.x += (x * cos + z * sin) * speed;
  camera.z += (-x * sin + z * cos) * speed;
  camera.follow = false;
}

/** Turns by the rotation keys: `direction` is -1 or 1. */
export function rotate(camera: Camera, direction: number, dt: number): void {
  camera.yaw += direction * dt * C.rotateKeys;
}

/** A middle drag rotates and tilts. */
export function orbit(camera: Camera, dx: number, dy: number): void {
  camera.yaw -= dx * C.dragRotate;
  camera.tiltAdjust = clamp(camera.tiltAdjust + dy * C.dragTilt, C.tiltAdjustLeast, C.tiltAdjustMost);
}

export function resetView(camera: Camera): void {
  camera.yaw = 0;
  camera.tiltAdjust = 0;
}

/** Eases towards the squad while following. */
export function followSquad(camera: Camera, centre: Point, dt: number): void {
  const share = Math.min(1, dt * C.followEasing);
  camera.x += (centre.x - camera.x) * share;
  camera.z += (centre.z - camera.z) * share;
}

/** Snaps to the squad and turns follow on (`Home`). */
export function snapTo(camera: Camera, centre: Point): void {
  camera.x = centre.x;
  camera.z = centre.z;
  camera.follow = true;
}

/** Keeps the camera within the zone's size plus the margin (decision 7). */
export function clampToZone(camera: Camera, zone: { readonly x: number; readonly z: number; readonly size: number }): void {
  const limit = zone.size + C.margin;
  const dx = camera.x - zone.x;
  const dz = camera.z - zone.z;
  const distance = Math.hypot(dx, dz);
  if (distance > limit) {
    camera.x = zone.x + (dx * limit) / distance;
    camera.z = zone.z + (dz * limit) / distance;
  }
}

/** Shakes the camera; a stronger shake replaces a weaker one. */
export function addShake(camera: Camera, strength: number): void {
  camera.shake = Math.max(camera.shake, strength);
}

/**
 * Jolts the eye sideways by the shake, and lets the shake fade. `random` gives
 * numbers from 0 to 1, and `still` is true when the player asks for reduced motion.
 */
export function shakePose(camera: Camera, pose: CameraPose, dt: number, random: () => number, still: boolean): CameraPose {
  const { fade, reach } = FEEL.shake;
  const jolt = still ? 0 : camera.shake * camera.shake * reach;
  camera.shake = Math.max(0, camera.shake - dt * fade);
  if (jolt === 0) return pose;
  return {
    eye: { x: pose.eye.x + (random() * 2 - 1) * jolt, y: pose.eye.y, z: pose.eye.z + (random() * 2 - 1) * jolt },
    target: pose.target,
  };
}
