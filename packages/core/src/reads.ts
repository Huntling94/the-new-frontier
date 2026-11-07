import { CLASSES } from '../data/squad';
import type { IslandData } from './island';
import type { GameView, Obstacle, Point, SpellId } from './state';
import { nearestZone } from './world';

/** What the screen needs to build a zone's scene (D-021, S2.3a). Nothing here is a look. */
export interface ZoneView {
  readonly id: string;
  /** The zone's centre, in the shared world frame. */
  readonly x: number;
  readonly z: number;
  /** How far the zone's ground reaches from its centre. */
  readonly size: number;
  /** The ground's shape. Every zone is an island for now. */
  readonly ground: IslandData;
  readonly anvil: Point;
  /** Placed by the seed until S3 freezes layouts (D-022). */
  readonly obstacles: readonly Obstacle[];
}

/** The zone holding the squad. Only one zone runs at a time (D-021). */
export function currentZone(view: GameView): ZoneView {
  const zone = nearestZone(view.anchor.x, view.anchor.z);
  const obstacles = view.zones.find(({ id }) => id === zone.id)?.obstacles ?? [];
  return {
    id: zone.id,
    x: zone.island.x,
    z: zone.island.z,
    size: zone.island.radius,
    ground: zone.island,
    anvil: zone.anvil,
    obstacles,
  };
}

/** A character's spells, in the order its keys follow (D-027, D-031). */
export function spellsOf(view: GameView, unitId: number): readonly SpellId[] {
  const unit = view.units.find(({ id }) => id === unitId);
  return unit ? CLASSES[unit.classId].spells : [];
}
