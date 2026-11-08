import type { NpcData } from '@new-frontier/core';
import { Color, Mesh, MeshBasicMaterial, RingGeometry, type Group } from 'three';
import { buildCharacter, type Figure } from './figures';
import { npcLook, MARKS } from './looks';
import type { ZoneScene } from './zone-scene';

/** How brightly a hovered figure glows, and how wide its ring is, in world units. */
const HIGHLIGHT = { glow: 0x5a4418, inner: 1.5, outer: 1.95, lift: 0.25 };

interface Drawn {
  readonly npc: NpcData;
  readonly figure: Figure;
  readonly ring: Mesh;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * The zone's townspeople (D-044). They stand still and draw no rule. Hovering over one
 * lights it and rings its feet, so it reads as something to click before you click it.
 */
export class NpcLayer {
  private readonly drawn: readonly Drawn[];
  private hovered: number | null = null;

  constructor(scene: ZoneScene) {
    const { resources, shapes, glow } = scene;
    const ringGeometry = resources.keep(new RingGeometry(HIGHLIGHT.inner, HIGHLIGHT.outer, 32).rotateX(-Math.PI / 2));
    const ringMaterial = resources.keep(new MeshBasicMaterial({ color: MARKS.selection, transparent: true, opacity: 0.95, depthWrite: false }));
    this.drawn = scene.zone.npcs.map((npc) => {
      const figure = buildCharacter({ resources, shapes, glow }, npcLook(npc.id));
      const y = scene.heightAt(npc.at.x, npc.at.z);
      figure.root.position.set(npc.at.x, y, npc.at.z);
      // Figures face +z, and `facing` is measured from +x.
      figure.root.rotation.y = Math.PI / 2 - npc.facing;
      const ring = new Mesh(ringGeometry, ringMaterial);
      ring.position.set(npc.at.x, y + HIGHLIGHT.lift, npc.at.z);
      ring.visible = false;
      (scene.world as Group).add(figure.root, ring);
      return { npc, figure, ring, x: npc.at.x, y, z: npc.at.z };
    });
  }

  /** Where each NPC is drawn, for picking. An NPC's ID on screen is its place in the zone's list. */
  positions(): readonly { readonly id: number; readonly x: number; readonly y: number; readonly z: number }[] {
    return this.drawn.map(({ x, y, z }, id) => ({ id, x, y, z }));
  }

  /** Lights the NPC at this place in the zone's list, or none. */
  highlight(index: number | null): void {
    if (index === this.hovered) return;
    this.hovered = index;
    const lit = new Color(HIGHLIGHT.glow);
    this.drawn.forEach(({ figure, ring }, place) => {
      const on = place === index;
      ring.visible = on;
      figure.flashing.forEach((material, part) => {
        material.emissive.copy(on ? lit : (figure.restGlow[part] ?? new Color(0)));
      });
    });
  }

  /** The NPC lit now, for tests. */
  get highlighted(): number | null {
    return this.hovered;
  }
}
