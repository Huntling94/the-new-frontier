import { createGame, currentZone, ISLAND_SCENARIO, step, type GameState } from '@new-frontier/core';
import { Sprite, type Mesh, type Texture } from 'three';
import { describe, expect, it } from 'vitest';
import { Effects } from '../src/effects';
import { EntityLayer } from '../src/entities';
import { characterLook, monsterLook, spellLook, zoneLook } from '../src/looks';
import { ZoneScene } from '../src/zone-scene';

const NONE = { selected: new Set<number>(), move: null };

function build(state: GameState): { scene: ZoneScene; effects: Effects; entities: EntityLayer } {
  const scene = new ZoneScene(state, currentZone(state));
  const effects = new Effects(scene);
  return { scene, effects, entities: new EntityLayer(scene, effects) };
}

/** A family of three Fighters (D-025). The core cannot build one until S3, so the test does. */
function threeFighters(): GameState {
  const state = createGame(3, ISLAND_SCENARIO);
  return { ...state, units: state.units.map((unit) => ({ ...unit, classId: 'fighter' as const })) };
}

describe('looks', () => {
  it('has a plain default for any type the data adds', () => {
    expect(characterLook('wizard').name).toBe('Adventurer');
    expect(monsterLook('kraken').body).toBe('blob');
    expect(zoneLook('far-isle')).toBe(zoneLook('lande'));
    expect(spellLook('fireball')).toBeNull();
  });

  it('names the Sniper (D-020)', () => {
    expect(characterLook('sniper').name).toBe('Sniper');
  });
});

describe('entities', () => {
  it('draws each character by ID, whatever its class: three Fighters each get a body and a ring', () => {
    const state = threeFighters();
    const { entities } = build(state);
    const ids = state.units.map(({ id }) => id);
    entities.draw(state, 1, 1 / 60, { selected: new Set(ids), move: null });
    expect(entities.counts().units).toBe(3);
    expect(entities.counts().rings).toBe(3);
    entities.draw(state, 1, 1 / 60, { selected: new Set([ids[1] ?? 0]), move: null });
    expect(entities.counts().rings).toBe(1);
    expect(entities.drawnUnits().map(({ id }) => id)).toEqual(ids);
  });

  it('copes with every enemy vanishing at once, as a gate will drop them (D-021)', () => {
    const state = createGame(4, ISLAND_SCENARIO);
    const { entities } = build(state);
    entities.draw(state, 1, 1 / 60, NONE);
    expect(entities.counts().enemies).toBe(state.live.enemies.length);
    state.live.enemies = [];
    entities.draw(state, 1, 1 / 60, NONE);
    expect(entities.counts().enemies).toBe(0);
  });

  it('draws between ticks from positions copied before each tick (decision 2)', () => {
    const state = createGame(5, ISLAND_SCENARIO);
    const { entities } = build(state);
    const unit = state.units[0];
    if (!unit) throw new Error('No unit.');
    step(state, [{ type: 'move', unitIds: [unit.id], x: unit.x + 30, z: unit.z, attack: false }]);
    entities.snapshot(state);
    const before = unit.x;
    step(state, []);
    entities.draw(state, 0.5, 1 / 60, NONE);
    const drawn = entities.drawnUnits().find(({ id }) => id === unit.id);
    expect(drawn?.x).toBeCloseTo((before + unit.x) / 2, 6);
  });
});

describe('zone scene', () => {
  it('can be dropped and built again, freeing everything it drew (decision 10)', () => {
    const state = createGame(6, ISLAND_SCENARIO);
    const made: number[] = [];
    for (let round = 0; round < 3; round += 1) {
      const { scene, effects, entities } = build(state);
      entities.draw(state, 1, 1 / 60, { selected: new Set([1]), move: { x: 0, z: 60, attack: false, age: 0 } });
      effects.shock(0, 60, 5);
      effects.flash(0, 4, 60, 0xffffff, 3);
      effects.update(1 / 60);

      // Every geometry, material and texture on screen must report being freed.
      const live = new Set<{ addEventListener(type: 'dispose', listener: () => void): void }>();
      scene.scene.traverse((object) => {
        const { geometry, material } = object as Partial<Mesh>;
        // three.js shares one plane between all sprites, for the life of the page.
        if (geometry && !(object instanceof Sprite)) live.add(geometry);
        for (const one of [material ?? []].flat()) {
          live.add(one);
          const map = (one as { map?: Texture | null }).map;
          if (map) live.add(map);
        }
      });
      made.push(live.size);
      const freed = new Set<unknown>();
      for (const resource of live) resource.addEventListener('dispose', () => freed.add(resource));
      entities.dispose();
      effects.dispose();
      scene.dispose();
      expect(freed.size).toBe(live.size);
      expect(scene.scene.children).toHaveLength(0);
    }
    expect(new Set(made).size).toBe(1);
  });

  it('builds from the zone the core reads, not a fixed island (decision 9)', () => {
    const state = createGame(7, ISLAND_SCENARIO);
    const { scene } = build(state);
    expect(scene.zone.id).toBe('lande');
    expect(scene.heightAt(0, 60)).toBeGreaterThan(0);
  });

  it('builds a walled zone, with no sea, and frees all of it again', () => {
    const state = createGame(7, { ...ISLAND_SCENARIO, zone: 'lande-cave', squadStart: { x: -30, z: 16 } });
    const { scene, effects, entities } = build(state);
    expect(scene.zone.ground.shape).toBe('walled');
    expect(scene.heightAt(0, 0)).toBe(scene.zone.groundLevel);
    entities.draw(state, 1, 1 / 60, NONE);
    expect(entities.counts().enemies).toBe(state.live.enemies.length);
    entities.dispose();
    effects.dispose();
    scene.dispose();
    expect(scene.scene.children).toHaveLength(0);
  });
});
