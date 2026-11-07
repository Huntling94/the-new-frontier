import { SPELLS } from '../data/spells';
import { CLASSES } from '../data/squad';
import type { Grid } from './grid';
import { xpToNextLevel } from './stats';
import type { GameView, Obstacle, Point, SpellId } from './state';
import { secondsToTicks } from './time';
import { gridOf, obstaclesOf, zoneOf, type Ground, type ZoneKind } from './world';

/** A gate as the screen needs it: where it is, and where it leads. */
export interface GateView {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly radius: number;
  readonly to: string;
}

/** What the screen needs to build a zone's scene (D-021, S2.3a). Nothing here is a look. */
export interface ZoneView {
  readonly id: string;
  readonly kind: ZoneKind;
  /** The middle of the zone's ground, in its own coordinates. */
  readonly x: number;
  readonly z: number;
  /** How far the zone's ground reaches from its middle. */
  readonly size: number;
  /** Height of the ground at its average. */
  readonly groundLevel: number;
  readonly ground: Ground;
  readonly anvil: Point | null;
  /** Baked once, and the same on every run (D-022). */
  readonly obstacles: readonly Obstacle[];
  readonly gates: readonly GateView[];
  /** Where the zone sits in the shared world frame (decision 11). */
  readonly place: Point;
}

/** The zone that runs. Only one runs at a time (D-021). */
export function currentZone(view: GameView): ZoneView {
  const zone = zoneOf(view);
  const { ground } = zone;
  const centre =
    ground.shape === 'island'
      ? { x: ground.island.x, z: ground.island.z, size: ground.island.radius, level: ground.island.relief.groundLevel }
      : {
          x: (ground.bounds.minX + ground.bounds.maxX) / 2,
          z: (ground.bounds.minZ + ground.bounds.maxZ) / 2,
          size: Math.hypot(ground.bounds.maxX - ground.bounds.minX, ground.bounds.maxZ - ground.bounds.minZ) / 2,
          level: ground.level,
        };
  return {
    id: zone.id,
    kind: zone.kind,
    x: centre.x,
    z: centre.z,
    size: centre.size,
    groundLevel: centre.level,
    ground,
    anvil: zone.anvil,
    obstacles: obstaclesOf(view),
    gates: zone.gates.map(({ id, area, to }) => ({ id, x: area.x, z: area.z, radius: area.radius, to })),
    place: zone.place,
  };
}

/**
 * The zone's walkable grid, for the dev viewer's overlay (decision 14). Each cell's
 * first bit says a character may stand there, and its second that an enemy may.
 */
export function zoneGrid(view: GameView): Readonly<Omit<Grid, 'areas'>> {
  return gridOf(view);
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
