import { SPELLS } from '../data/spells';
import { CLASSES } from '../data/squad';
import type { IslandData } from './island';
import { xpToNextLevel } from './stats';
import type { GameView, Obstacle, Point, SpellId } from './state';
import { secondsToTicks } from './time';
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

/** What a character's HUD card needs beyond its state (S2.3b). */
export interface CardView {
  /** 0 for a character with no mana. */
  readonly maxMana: number;
  /** XP needed to reach the next level. */
  readonly xpToNext: number;
}

export function cardOf(view: GameView, unitId: number): CardView | null {
  const unit = view.units.find(({ id }) => id === unitId);
  if (!unit) return null;
  return { maxMana: CLASSES[unit.classId].mana, xpToNext: xpToNextLevel(unit.level) };
}

/** A spell's full cooldown and mana cost, for its button (S2.3b). */
export interface SpellView {
  readonly cooldownTicks: number;
  readonly mana: number;
}

export function spellInfo(spell: SpellId): SpellView {
  const { cooldownSeconds, mana } = SPELLS[spell];
  return { cooldownTicks: secondsToTicks(cooldownSeconds), mana };
}
