import { describe, expect, it } from 'vitest';
import {
  clampToZone,
  createCamera,
  easeZoom,
  followSquad,
  orbit,
  pan,
  poseOf,
  resetView,
  rotate,
  zoomBy,
} from '../src/camera';
import { Clock } from '../src/clock';
import { FEEL } from '../src/feel';

const ZONE = { x: 0, z: 0, size: 92 };

describe('camera, with the squad test feel (decision 6)', () => {
  it('starts over the squad at zoom 0.34 with follow on', () => {
    const camera = createCamera({ x: 0, z: 62 });
    expect(camera).toMatchObject({ x: 0, z: 62, zoom: 0.34, yaw: 0, follow: true });
  });

  it('sits 34 to 150 away, tilted 0.82 to 1.2 by zoom', () => {
    const camera = createCamera({ x: 0, z: 0 });
    camera.zoom = 0;
    const near = poseOf(camera, 3);
    expect(Math.hypot(near.eye.x, near.eye.y - 3, near.eye.z)).toBeCloseTo(34, 9);
    expect(Math.atan2(near.eye.y - 3, near.eye.z)).toBeCloseTo(0.82, 9);
    camera.zoom = 1;
    const far = poseOf(camera, 3);
    expect(Math.hypot(far.eye.x, far.eye.y - 3, far.eye.z)).toBeCloseTo(150, 9);
    expect(Math.atan2(far.eye.y - 3, far.eye.z)).toBeCloseTo(1.2, 9);
  });

  it('zooms 0.08 a notch, eases at 9 a second, and stays within 0 to 1', () => {
    const camera = createCamera({ x: 0, z: 0 });
    zoomBy(camera, 120);
    expect(camera.zoomTarget).toBeCloseTo(0.42, 9);
    easeZoom(camera, 0.05);
    expect(camera.zoom).toBeCloseTo(0.34 + 0.08 * 0.45, 9);
    for (let notch = 0; notch < 20; notch += 1) zoomBy(camera, -1);
    expect(camera.zoomTarget).toBe(0);
  });

  it('pans 36 to 125 a second relative to the view, and panning turns follow off', () => {
    const camera = createCamera({ x: 0, z: 0 });
    camera.zoom = 0;
    pan(camera, 0, -1, 1);
    expect(camera).toMatchObject({ x: 0, z: -36, follow: false });
    camera.zoom = 1;
    camera.yaw = Math.PI / 2;
    pan(camera, 0, -1, 1);
    expect(camera.x).toBeCloseTo(-125, 9);
  });

  it('turns 1.7 a second by key, and middle drag rotates and tilts within its limits', () => {
    const camera = createCamera({ x: 0, z: 0 });
    rotate(camera, 1, 1);
    expect(camera.yaw).toBeCloseTo(1.7, 9);
    orbit(camera, 100, 0);
    expect(camera.yaw).toBeCloseTo(1.1, 9);
    orbit(camera, 0, 1000);
    expect(camera.tiltAdjust).toBe(0.4);
    orbit(camera, 0, -1000);
    expect(camera.tiltAdjust).toBe(-0.5);
    resetView(camera);
    expect(camera).toMatchObject({ yaw: 0, tiltAdjust: 0 });
  });

  it('holds the total tilt between 0.5 and 1.4', () => {
    const camera = createCamera({ x: 0, z: 0 });
    camera.zoom = 1;
    camera.tiltAdjust = 0.4;
    const pose = poseOf(camera, 0);
    expect(Math.atan2(pose.eye.y, pose.eye.z)).toBeCloseTo(1.4, 9);
  });

  it('follows at 4 a second', () => {
    const camera = createCamera({ x: 0, z: 0 });
    followSquad(camera, { x: 10, z: 0 }, 0.1);
    expect(camera.x).toBeCloseTo(4, 9);
  });

  it('stops 20 beyond the zone, which is 112 on the test island (decision 7)', () => {
    const camera = createCamera({ x: 0, z: 0 });
    camera.x = 300;
    clampToZone(camera, ZONE);
    expect(camera.x).toBeCloseTo(112, 9);
    expect(FEEL.camera.margin).toBe(20);
  });
});

describe('slow time (decision 5)', () => {
  it('runs at 30% for at most 6 seconds, and recharges at 0.45 a second', () => {
    const clock = new Clock();
    let ticks = 0;
    for (let frame = 0; frame < 250; frame += 1) ticks += clock.advance(0.02, true);
    // Five seconds at 30% is 45 ticks.
    expect(ticks).toBeGreaterThanOrEqual(44);
    expect(ticks).toBeLessThanOrEqual(45);
    expect(clock.meter).toBeCloseTo(1, 9);
    for (let frame = 0; frame < 50; frame += 1) clock.advance(0.02, true);
    expect(clock.meter).toBeCloseTo(0, 9);
    clock.advance(0.05, false);
    expect(clock.meter).toBeCloseTo(0.0225, 6);
    expect(clock.slowed).toBe(false);
  });

  it('runs 30 ticks a second at full speed', () => {
    const clock = new Clock();
    let ticks = 0;
    for (let frame = 0; frame < 60; frame += 1) ticks += clock.advance(1 / 60, false);
    expect(ticks).toBeGreaterThanOrEqual(29);
    expect(ticks).toBeLessThanOrEqual(30);
  });
});
