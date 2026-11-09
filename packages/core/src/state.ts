import type { SPELLS } from '../data/spells';

/** Everything the game remembers. All of it is plain data (D-015). */

export interface Point {
  readonly x: number;
  readonly z: number;
}

export type ClassId = 'fighter' | 'sniper' | 'healer';

export type SpellId = keyof typeof SPELLS;

/** The seven gear slots (D-028). Their order is `SLOTS` in `data/items.ts`. */
export type GearSlot = 'main-hand' | 'off-hand' | 'head' | 'chest' | 'gloves' | 'boots' | 'necklace';

/** Every item type has one, from the genre's usual set (decision 9). */
export type CategoryId =
  | 'sword'
  | 'great-sword'
  | 'dagger'
  | 'spear'
  | 'pistol'
  | 'rifle'
  | 'staff'
  | 'shield'
  | 'leather'
  | 'metal'
  | 'coat'
  | 'jewellery';

/** A body of learning that unlocks spells and weapon categories (D-027). */
export type ArtId = 'swordplay' | 'marksmanship' | 'mending';

/**
 * What it takes to use something, in the one shape shared by item types, spells,
 * gates and quests (`docs/DATA-MODEL.md`).
 */
export type Requirement =
  | { readonly kind: 'level'; readonly level: number }
  | { readonly kind: 'art'; readonly art: ArtId }
  | { readonly kind: 'quest'; readonly quest: string };

export interface ArtData {
  readonly spells: readonly SpellId[];
  /** Weapon categories it permits. One category may belong to several arts. */
  readonly categories: readonly CategoryId[];
}

export interface CategoryData {
  readonly kind: 'weapon' | 'armour';
}

/** What a weapon sets (D-028). Times are seconds. */
export interface WeaponData {
  readonly range: number;
  readonly attackSeconds: number;
  readonly knockback: number;
  readonly melee: boolean;
  /** Which attack stat it uses. One attack stat serves all three until D-026's stats arrive. */
  readonly attackStat: 'melee' | 'ranged' | 'magic';
}

/** An item type's numbers. Def is before the class's armour scale (decision 11). */
export interface ItemStats {
  readonly attack: number;
  /** Accuracy, which is set against the target's DR. */
  readonly ar: number;
  /** Chance of a crit, as a percentage. */
  readonly crit: number;
  readonly defence: number;
  readonly dr: number;
}

/** The definition of a piece of gear (D-028, D-029). */
export interface ItemTypeData {
  readonly category: CategoryId;
  /** Slots it may go in. */
  readonly fits: readonly GearSlot[];
  /** Other slots it fills, which must then be empty, as a two-handed weapon fills the off hand. */
  readonly fills: readonly GearSlot[];
  readonly stats: ItemStats;
  /** Only main-hand weapons have this. */
  readonly weapon: WeaponData | null;
  readonly requires: readonly Requirement[];
  /** In marks. Nothing sells yet (D-012). */
  readonly price: number;
}

export interface ClassData {
  /** World units per second. */
  readonly speed: number;
  readonly health: number;
  readonly mana: number;
  /** Multiplies the Def of armour: the class's armour skill (decision 11). */
  readonly armourScale: number;
  readonly autoHeals: boolean;
  /** How near an enemy must be for the unit to start fighting it. */
  readonly aggroRange: number;
  /** How near an enemy must be to stop an attack-move. */
  readonly attackMoveRange: number;
  /** Known from the start (decision 15). Its first art's spells are its three keys. */
  readonly arts: readonly ArtId[];
  /** What a new character of the class wears, by slot (decision 9). */
  readonly startingItems: Partial<Readonly<Record<GearSlot, string>>>;
}

/** One piece of gear: its type plus its upgrade, with its own ID (decision 7). */
export interface Item {
  readonly id: number;
  readonly typeId: string;
  upgrade: number;
  /** Broken by a missed upgrade: cannot be worn until a smith repairs it (D-042). */
  broken: boolean;
}

export type DamageType = 'fire' | 'ice' | 'lightning' | 'mental';

/**
 * The one combat sheet, shared by characters and monsters (D-049, D-056). Evade, block
 * and the resistances are on it and do nothing yet.
 */
export interface CombatSheet {
  maxHealth: number;
  attack: number;
  /** Seconds between attacks. */
  attackSeconds: number;
  /** Accuracy, which is set against the target's DR. */
  ar: number;
  /** Damage reduction, which is set against the attacker's AR. */
  dr: number;
  defence: number;
  /** Chance of a crit, as a percentage. */
  crit: number;
  evade: number;
  block: number;
  resistances: Readonly<Record<DamageType, number>>;
}

/** One of the three places in the triangle (D-025). */
export interface FormationPlace {
  /** Where the body starts, from the scenario's starting point. */
  readonly startOffset: Point;
  /** Its place in the triangle, from the centre, facing the heading. */
  readonly slot: { readonly forward: number; readonly side: number };
}

/** A character as a family starts with it (decision 2). */
export interface CharacterStart {
  readonly classId: ClassId;
  /** A placeholder until names are chosen (decision 3). */
  readonly name: string;
}

/** One member of the family. It lasts, so a save keeps it (D-025). */
export interface Character {
  /** Shared with its body, and with enemies' IDs in events. */
  readonly id: number;
  readonly name: string;
  readonly classId: ClassId;
  level: number;
  xp: number;
  arts: ArtId[];
  /** Every slot, empty or not. A two-handed main hand leaves the off hand empty. */
  items: Record<GearSlot, Item | null>;
}

/** Everything the player owns (D-025, D-029). */
export interface Family {
  characters: Character[];
  /** The IDs of the three in the field. Order sets each one's place in the triangle. */
  active: number[];
  /** Every item not equipped. An item is in exactly one place (rule 1). */
  inventory: Item[];
  marks: number;
  /** A shared count until a second consumable is needed (D-025). */
  potions: number;
}

/**
 * A character's live body in the field. It belongs to the squad, not the zone's
 * live group, so a gate moves it whole (decision 1).
 */
export interface Body extends CombatSheet {
  /** Its character's ID. */
  readonly id: number;
  alive: boolean;
  x: number;
  z: number;
  dest: Point | null;
  /** Holding units stay where they stop until regrouped. */
  hold: boolean;
  /** Fights what it meets on the way. */
  attackMove: boolean;
  /** Shortest the walk left to `dest` has been, along the route. */
  bestDistance: number | null;
  /**
   * Corners still to pass on the way to `routeGoal`, the last being the goal itself.
   * Empty when the unit walks straight or stands (D-023).
   */
  route: Point[];
  routeGoal: Point | null;
  stuckTicks: number;
  dashTicks: number;
  dashX: number;
  dashZ: number;
  invulnerableTicks: number;
  health: number;
  mana: number;
  targetId: number | null;
  /** Ordered onto its target, so it chases even while holding. */
  forced: boolean;
  attackTicks: number;
  spellTicks: Partial<Record<SpellId, number>>;
  guardTicks: number;
  rallyTicks: number;
}

export type MonsterKind = 'wasp' | 'rooster' | 'viper' | 'boar';

export type EnemyKind = 'dummy' | 'boss' | MonsterKind;

/** An enemy's stats. Level scales them, so each enemy carries its own in state. */
export interface EnemyStats extends Readonly<Omit<CombatSheet, 'maxHealth'>> {
  readonly level: number;
  readonly health: number;
  readonly size: number;
  /** World units per second. */
  readonly speed: number;
  readonly reach: number;
  readonly xp: number;
  /** Share of knockback that moves it. */
  readonly knockbackShare: number;
}

export interface MonsterData {
  readonly name: string;
  readonly behaviour: 'melee' | 'spitter' | 'slammer';
  readonly healthShare: number;
  readonly attackShare: number;
  readonly arShare: number;
  readonly drShare: number;
  readonly defenceShare: number;
  /** Seconds it waits after a strike lands. */
  readonly attackSeconds: number;
  readonly crit: number;
  readonly evade: number;
  readonly block: number;
  readonly resistances: CombatSheet['resistances'];
  readonly size: number;
  readonly speed: number;
  readonly reach: number;
  readonly xpShare: number;
  readonly knockbackShare: number;
  /** How long it winds up before a strike lands. */
  readonly windSeconds: number;
  readonly coins: { readonly least: number; readonly most: number };
}

export interface PackData extends Point {
  readonly level: number;
  readonly mobs: readonly { readonly kind: MonsterKind; readonly count: number }[];
  /** Half the side of the square its members land in, where the ground is too tight for the usual one (M2). */
  readonly spread?: number;
}

export interface BossData extends EnemyStats {
  readonly wakeRange: number;
  readonly firstMoveSeconds: number;
  readonly wokenMoveSeconds: number;
  readonly enrageBelowShare: number;
  readonly calmPace: number;
  readonly enragedPace: number;
  readonly slowShare: number;
  readonly walkAfterSeconds: number;
  readonly meleeExtraReach: number;
  readonly meleeShare: number;
  readonly interruptSeconds: number;
  readonly slam: {
    readonly radius: number;
    readonly hitRadius: number;
    readonly telegraphSeconds: number;
    readonly waitSeconds: number;
    readonly cooldownSeconds: number;
    readonly damageShare: number;
    readonly calmCount: number;
    readonly enragedCount: number;
    /** Later slams land up to this far from the first. */
    readonly spread: number;
  };
  readonly charge: {
    readonly length: number;
    readonly width: number;
    readonly telegraphSeconds: number;
    readonly seconds: number;
    readonly speed: number;
    /** Contact is the boss's size plus this. */
    readonly hitExtra: number;
    readonly damageShare: number;
    readonly cooldownSeconds: number;
  };
  readonly blast: {
    readonly calmSeconds: number;
    readonly enragedSeconds: number;
    readonly damageShare: number;
    readonly cooldownSeconds: number;
  };
  readonly summon: {
    readonly kind: MonsterKind;
    readonly level: number;
    readonly health: number;
    readonly calmCount: number;
    readonly enragedCount: number;
    readonly distance: number;
    /** Largest random turn of the ring of minions, in radians. */
    readonly turn: number;
    readonly waitSeconds: number;
    readonly cooldownSeconds: number;
  };
}

export type BossMove = 'slam' | 'charge' | 'blast' | 'summon';

/** What only the boss remembers. */
export interface BossState {
  /** `aiming` waits on the charge's telegraph, and `waiting` on `waitTicks`. */
  phase: 'free' | 'waiting' | 'aiming' | 'charging';
  /** Ticks since the phase began. */
  phaseTicks: number;
  waitTicks: number;
  lastMove: BossMove | null;
  /** Left of the cast, and how long it was, for a cast bar. */
  castTicks: number;
  castTotalTicks: number;
  meleeTicks: number;
  chargeAngle: number;
  /** Units this charge has already hit. */
  chargeHitIds: number[];
}

export interface Enemy extends Omit<EnemyStats, 'health'> {
  readonly id: number;
  readonly kind: EnemyKind;
  /** Members of a pack wake together. */
  readonly packId: number | null;
  /** Summoned by the boss, so it goes when the boss resets. */
  readonly minion: boolean;
  /** Where the enemy goes back to, if it resets. */
  readonly homeX: number;
  readonly homeZ: number;
  alive: boolean;
  /** Asleep until a unit comes near or something hits it. */
  awake: boolean;
  x: number;
  z: number;
  /** Speed it is walking at. Knockback is on top of this. */
  moveX: number;
  moveZ: number;
  health: number;
  readonly maxHealth: number;
  /** Until its next strike. */
  strikeTicks: number;
  /** Left of a wind-up, which is 0 when it is not winding up. */
  windTicks: number;
  respawnTicks: number;
  tauntTicks: number;
  /** Who taunted it. */
  tauntUnitId: number | null;
  /** Goes for this unit first, if it lives. */
  preferId: number | null;
  slowTicks: number;
  knockX: number;
  knockZ: number;
  staggerTicks: number;
  boss: BossState | null;
}

/** A shot homes in on its enemy until it hits or runs out of time. */
export interface Shot {
  x: number;
  z: number;
  readonly unitId: number;
  readonly enemyId: number;
  readonly multiplier: number;
  readonly crippling: boolean;
  ticks: number;
}

/** A monster's shot flies straight, and hits the first unit it meets. */
export interface EnemyShot {
  x: number;
  z: number;
  readonly speedX: number;
  readonly speedZ: number;
  readonly damage: number;
  readonly sourceId: number;
  readonly sourceAr: number;
  ticks: number;
}

/** Loot in the world. Coins carry marks, and a potion carries one potion. */
export interface Drop {
  readonly id: number;
  readonly kind: 'marks' | 'potion';
  readonly value: number;
  x: number;
  z: number;
  readonly speedX: number;
  readonly speedZ: number;
  /** Left of its flight. It cannot be collected until it lands. */
  flightTicks: number;
  ageTicks: number;
}

/** A delayed effect, held as a record so that a save keeps it (D-015). */
export interface ScheduledStrike {
  readonly kind: 'volley-strike';
  ticks: number;
  readonly unitId: number;
  readonly x: number;
  readonly z: number;
}

/** A warning drawn on the ground, which lands when `ticks` runs out (D-015). */
export interface SlamTelegraph {
  readonly kind: 'slam';
  ticks: number;
  readonly totalTicks: number;
  readonly enemyId: number;
  readonly x: number;
  readonly z: number;
  /** What is drawn. */
  readonly radius: number;
  /** What lands, which is a little wider. */
  readonly hitRadius: number;
  readonly damage: number;
}

/** The line of a charge. The boss sets off along it when `ticks` runs out. */
export interface ChargeTelegraph {
  readonly kind: 'charge';
  ticks: number;
  readonly totalTicks: number;
  readonly enemyId: number;
  readonly x: number;
  readonly z: number;
  readonly angle: number;
  readonly length: number;
  readonly width: number;
}

export type ScheduledEffect = ScheduledStrike | SlamTelegraph | ChargeTelegraph;

export type ObstacleKind = 'stone' | 'rock' | 'beacon' | 'fountain';

export interface Obstacle extends Point {
  readonly kind: ObstacleKind;
  readonly radius: number;
}

/** What a zone holds when it runs: packs, a boss and a training dummy (D-022). */
export interface ZoneContents {
  readonly dummy: Point | null;
  readonly packs: readonly PackData[];
  /** Where the boss stands, if there is one. */
  readonly boss: Point | null;
  /** Replaces the zone's obstacles. Only tests use this. */
  readonly obstacles?: readonly Obstacle[];
}

/** When a cleared pack comes back, on the game clock (D-021). */
export interface PackReturn {
  readonly packId: number;
  readonly tick: number;
}

/** What lasts about a zone after the squad leaves it (D-021). */
export interface ZoneRecord {
  readonly id: string;
  bossDead: boolean;
  returns: PackReturn[];
  /** A test scenario's replacement contents, or null in play. */
  readonly contents: ZoneContents | null;
}

/** Everything that exists only while its zone runs. It is dropped on leaving (D-021). */
export interface LiveGroup {
  enemies: Enemy[];
  shots: Shot[];
  enemyShots: EnemyShot[];
  scheduled: ScheduledEffect[];
  drops: Drop[];
}

export interface GameState {
  tick: number;
  /** The generator's whole state. */
  rng: number;
  nextId: number;
  /** Items count separately, so unit and enemy IDs do not move (decision 7). */
  nextItemId: number;
  family: Family;
  /** The active three's bodies, in the family's active order. */
  bodies: Body[];
  /** The zone that runs. Only one runs at a time (D-021). */
  zoneId: string;
  /** One for each zone in the world, in data order. */
  records: ZoneRecord[];
  live: LiveGroup;
  /** Centre of the squad's triangle. */
  anchor: Point;
  /** Direction the triangle faces, in radians. */
  heading: number;
  scatterCooldownTicks: number;
  /** The enemy the squad was last told to attack. */
  sharedTargetId: number | null;
  potionCooldownTicks: number;
  /** All three are down. Only the tick moves until they return to the zone's camp. */
  squadDown: boolean;
  /** Left until the squad returns to camp. */
  wipeTicks: number;
}

type DeepReadonly<T> = T extends readonly (infer Item)[]
  ? readonly DeepReadonly<Item>[]
  : T extends object
    ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
    : T;

/** How everything outside the core reads the game. */
export type GameView = DeepReadonly<GameState>;

/** What a game starts with: a zone, a point and a heading (D-022). */
export interface Scenario {
  readonly name: string;
  readonly zone: string;
  readonly squadStart: Point;
  readonly squadHeading: number;
  /** Replaces the starting family, for tests, such as three Fighters. */
  readonly family?: readonly CharacterStart[];
  /** Replaces the starting zone's contents, for tests. */
  readonly contents?: ZoneContents;
}

export interface MoveCommand {
  readonly type: 'move';
  readonly unitIds: readonly number[];
  readonly x: number;
  readonly z: number;
  readonly attack: boolean;
}

export interface TargetCommand {
  readonly type: 'target';
  readonly unitIds: readonly number[];
  readonly enemyId: number;
}

export interface CastCommand {
  readonly type: 'cast';
  readonly unitId: number;
  readonly spell: SpellId;
  readonly point?: Point;
  readonly enemyId?: number;
}

export interface PotionCommand {
  readonly type: 'potion';
  readonly unitId?: number;
}

/** Moves an item from the inventory into a slot (decision 17). */
export interface EquipCommand {
  readonly type: 'equip';
  readonly unitId: number;
  readonly itemId: number;
  readonly slot: GearSlot;
}

/** Sends an equipped item back to the inventory. */
export interface UnequipCommand {
  readonly type: 'unequip';
  readonly unitId: number;
  readonly slot: GearSlot;
}

/** A step up at the smith, for any weapon or armour the family owns (D-042). */
export interface UpgradeCommand {
  readonly type: 'upgrade';
  readonly itemId: number;
}

/** Repairs a broken item to +4 at the smith (D-042). */
export interface RepairCommand {
  readonly type: 'repair';
  readonly itemId: number;
}

export type Command =
  | MoveCommand
  | TargetCommand
  | CastCommand
  | PotionCommand
  | UpgradeCommand
  | RepairCommand
  | EquipCommand
  | UnequipCommand
  | { readonly type: 'regroup' }
  | { readonly type: 'scatter' };

export type RefusalReason =
  | 'bad-point'
  | 'unknown-unit'
  | 'no-living-units'
  | 'on-cooldown'
  | 'no-mana'
  | 'no-target'
  | 'caster-down'
  | 'not-your-spell'
  | 'no-potions'
  | 'nobody-hurt'
  | 'no-marks'
  | 'not-near-smith'
  | 'not-near-npc'
  | 'unknown-npc'
  | 'broken'
  | 'not-broken'
  | 'not-upgradable'
  | 'already-max'
  | 'unknown-item'
  | 'wrong-slot'
  | 'slot-empty'
  | 'needs-level'
  | 'needs-art'
  | 'needs-weapon'
  | 'in-fight';

export type GameEvent =
  | { readonly type: 'order-accepted'; readonly tick: number; readonly order: Command['type'] }
  | {
      readonly type: 'order-refused';
      readonly tick: number;
      readonly order: Command['type'];
      readonly reason: RefusalReason;
    }
  | { readonly type: 'unit-arrived'; readonly tick: number; readonly unitId: number }
  | { readonly type: 'unit-gave-up'; readonly tick: number; readonly unitId: number }
  | {
      readonly type: 'hit';
      readonly tick: number;
      /** Characters and enemies share one run of IDs. */
      readonly sourceId: number;
      readonly targetId: number;
      readonly amount: number;
      readonly crit: boolean;
    }
  | {
      readonly type: 'healed';
      readonly tick: number;
      readonly unitId: number;
      readonly amount: number;
    }
  | {
      readonly type: 'spell-cast';
      readonly tick: number;
      readonly unitId: number;
      readonly spell: SpellId;
      /** Where the spell lands. */
      readonly x: number;
      readonly z: number;
    }
  | {
      readonly type: 'level-up';
      readonly tick: number;
      readonly unitId: number;
      readonly level: number;
    }
  | { readonly type: 'unit-down'; readonly tick: number; readonly unitId: number }
  | { readonly type: 'enemy-down'; readonly tick: number; readonly enemyId: number }
  | { readonly type: 'unit-revived'; readonly tick: number; readonly unitId: number }
  | {
      readonly type: 'upgraded' | 'item-broken' | 'repaired';
      readonly tick: number;
      readonly itemId: number;
      /** The level it reached, broke at, or was repaired to. */
      readonly level: number;
    }
  | {
      readonly type: 'equipped' | 'unequipped';
      readonly tick: number;
      readonly unitId: number;
      readonly itemId: number;
      readonly slot: GearSlot;
    }
  | { readonly type: 'squad-down'; readonly tick: number }
  | { readonly type: 'squad-returned'; readonly tick: number }
  | { readonly type: 'boss-woken'; readonly tick: number; readonly enemyId: number }
  | { readonly type: 'interrupted'; readonly tick: number; readonly enemyId: number }
  | {
      readonly type: 'loot';
      readonly tick: number;
      readonly unitId: number;
      readonly kind: Drop['kind'];
      readonly value: number;
    }
  | {
      readonly type: 'zone-changed';
      readonly tick: number;
      readonly from: string;
      readonly to: string;
    };

/** Why auto-combat has stopped (D-007). */
export type AutoStop = 'danger' | 'clear' | 'squad-down';

export interface AutoResult {
  readonly commands: readonly Command[];
  readonly stop: AutoStop | null;
}

export type BotKind = 'careful' | 'sloppy';

/** One item on a bot's shopping list. */
export interface BotUpgrade {
  /** Place in the active three. */
  readonly place: number;
  readonly slot: GearSlot;
}

export interface ReplayEntry {
  readonly tick: number;
  readonly commands: readonly Command[];
}

export interface Replay {
  readonly seed: number;
  readonly scenario: Scenario;
  /** How many ticks the replay runs. */
  readonly ticks: number;
  readonly entries: readonly ReplayEntry[];
  readonly expectedHash: string;
}
