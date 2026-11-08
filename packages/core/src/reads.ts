import { SPELLS } from '../data/spells';
import { characterOf, classOf } from './family';
import { SLOTS } from '../data/items';
import { applyEquip, applyUnequip, inFight, itemType, spellsKnown, weaponOf, whyNot } from './items';
import type { Grid } from './grid';
import { recalculate, xpToNextLevel } from './stats';
import type {
  Body,
  CategoryId,
  ClassId,
  EquipCommand,
  GameEvent,
  GameState,
  GameView,
  GearSlot,
  Obstacle,
  Point,
  RefusalReason,
  SpellId,
  UnequipCommand,
} from './state';
import { secondsToTicks } from './time';
import { gridOf, obstaclesOf, zoneOf, type Ground, type Lot, type ZoneKind } from './world';

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
  /** Places kept for systems to come, such as the smithy (S3d). Only towns have any. */
  readonly lots: readonly Lot[];
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
    lots: zone.lots,
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
  const unit = view.bodies.find(({ id }) => id === unitId);
  return unit ? spellsKnown(characterOf(view, unit.id)) : [];
}

/** What a character's HUD card needs beyond its state (S2.3b). */
export interface CardView {
  readonly name: string;
  /** For the character's looks only (decision 1). */
  readonly classId: ClassId;
  readonly level: number;
  readonly xp: number;
  /** 0 for a character with no mana. */
  readonly maxMana: number;
  /** XP needed to reach the next level. */
  readonly xpToNext: number;
}

export function cardOf(view: GameView, unitId: number): CardView | null {
  const unit = view.bodies.find(({ id }) => id === unitId);
  if (!unit) return null;
  const { name, classId, level, xp } = characterOf(view, unit.id);
  return { name, classId, level, xp, maxMana: classOf(view, unit.id).mana, xpToNext: xpToNextLevel(level) };
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

/** An item as the screen needs it (S3b decision 20). Names and looks are in `render`. */
export interface ItemView {
  readonly id: number;
  readonly typeId: string;
  readonly category: CategoryId;
  readonly upgrade: number;
  readonly fits: readonly GearSlot[];
  /** Other slots it empties, as a two-handed weapon empties the off hand. */
  readonly fills: readonly GearSlot[];
  /** The smith's spare (D-005). */
  readonly spare: boolean;
  /** The level it needs, if any. */
  readonly level: number | null;
}

export function itemInfo(item: { readonly id: number; readonly typeId: string; readonly upgrade: number }): ItemView {
  const type = itemType(item.typeId);
  return {
    id: item.id,
    typeId: item.typeId,
    category: type.category,
    upgrade: item.upgrade,
    fits: type.fits,
    fills: type.fills,
    spare: type.quality < 1,
    level: type.requires.reduce<number | null>((most, need) => (need.kind === 'level' ? Math.max(most ?? 0, need.level) : most), null),
  };
}

/** The seven slots, in the order the screen shows them (D-028). */
export const GEAR_SLOTS: readonly GearSlot[] = SLOTS;

/** A character's key stats, worked out from its items (decision 14). */
export interface StatSheet {
  readonly maxHealth: number;
  readonly attack: number;
  readonly ar: number;
  readonly crit: number;
  readonly defence: number;
  readonly dr: number;
  readonly range: number;
}

function sheetOf(state: GameState, characterId: number): StatSheet {
  const character = characterOf(state, characterId);
  const body = state.bodies.find(({ id }) => id === characterId);
  const scratch = { ...(body ?? state.bodies[0]), health: 0, maxHealth: 0 } as Body;
  recalculate(character, scratch);
  const { maxHealth, attack, ar, crit, defence, dr } = scratch;
  return { maxHealth, attack, ar, crit, defence, dr, range: weaponOf(character).weapon.range };
}

/** What an equip or unequip would do, without doing it: the stats before and after, or why not. */
export interface ChangePreview {
  readonly reason: RefusalReason | null;
  readonly before: StatSheet;
  readonly after: StatSheet;
  /** Items it would send back to the inventory, a two-handed weapon's off hand among them. */
  readonly displaced: readonly ItemView[];
}

/** Plays a command on a copy of the game, so the screen can show its result. */
export function previewChange(view: GameView, command: EquipCommand | UnequipCommand): ChangePreview {
  const copy = JSON.parse(JSON.stringify(view)) as GameState;
  const before = sheetOf(copy, command.unitId);
  const events: GameEvent[] = [];
  const reason = command.type === 'equip' ? applyEquip(copy, command, events) : applyUnequip(copy, command, events);
  const displaced = events.flatMap((event) => {
    if (event.type !== 'unequipped') return [];
    const item = copy.family.inventory.find(({ id }) => id === event.itemId);
    return item && (command.type === 'unequip' || event.slot !== command.slot) ? [itemInfo(item)] : [];
  });
  return { reason, before, after: reason ? before : sheetOf(copy, command.unitId), displaced };
}

/** Why a character may not use an item type, or null if it may, for the screen to say. */
export function whyNotUse(view: GameView, characterId: number, typeId: string): RefusalReason | null {
  return whyNot(characterOf(view, characterId), typeId);
}

/** Whether a fight is on, which stops equipping (decision 17). */
export function fightOn(view: GameView): boolean {
  return inFight(view);
}
