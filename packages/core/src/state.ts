import type { SPELLS } from '../data/spells';

/** Everything the game remembers. All of it is plain data (D-015). */

export interface Point {
  readonly x: number;
  readonly z: number;
}

export type ClassId = 'fighter' | 'sniper' | 'healer';

export type SpellId = keyof typeof SPELLS;

export type GearSlot = 'weapon' | 'chest' | 'gloves' | 'boots';

export interface ClassData {
  /** World units per second. */
  readonly speed: number;
  /** Where the unit starts, from the scenario's starting point. */
  readonly startOffset: Point;
  /** The unit's place in the triangle, from its centre, facing the heading. */
  readonly slot: { readonly forward: number; readonly side: number };
  readonly health: number;
  readonly mana: number;
  readonly attack: number;
  /** Accuracy, which is set against the target's DR. */
  readonly ar: number;
  /** Chance of a crit, as a percentage. */
  readonly crit: number;
  readonly range: number;
  readonly attackSeconds: number;
  /** Multiplies the Def of armour. */
  readonly armourScale: number;
  readonly melee: boolean;
  readonly knockback: number;
  readonly autoHeals: boolean;
  /** How near an enemy must be for the unit to start fighting it. */
  readonly aggroRange: number;
  /** How near an enemy must be to stop an attack-move. */
  readonly attackMoveRange: number;
  readonly spells: readonly SpellId[];
}

export interface GearItem {
  upgrade: number;
  /** A basic replacement from the smith (D-005). */
  readonly spare: boolean;
  readonly attack: number;
  readonly ar: number;
  readonly crit: number;
  readonly defence: number;
  readonly dr: number;
}

export interface Unit {
  readonly id: number;
  readonly classId: ClassId;
  alive: boolean;
  x: number;
  z: number;
  dest: Point | null;
  /** Holding units stay where they stop until regrouped. */
  hold: boolean;
  /** Fights what it meets on the way. */
  attackMove: boolean;
  /** Closest the unit has come to `dest`. */
  bestDistance: number | null;
  stuckTicks: number;
  dashTicks: number;
  dashX: number;
  dashZ: number;
  invulnerableTicks: number;
  level: number;
  xp: number;
  health: number;
  mana: number;
  gear: Record<GearSlot, GearItem>;
  /** This stat and the five after it come from level and gear, through `recalculate`. */
  maxHealth: number;
  attack: number;
  ar: number;
  crit: number;
  defence: number;
  /** Damage reduction, which is set against the attacker's AR. */
  dr: number;
  targetId: number | null;
  /** Ordered onto its target, so it chases even while holding. */
  forced: boolean;
  attackTicks: number;
  spellTicks: Partial<Record<SpellId, number>>;
  guardTicks: number;
  rallyTicks: number;
}

export type MonsterKind = 'swarm' | 'runner' | 'spitter' | 'brute';

export type EnemyKind = 'dummy' | 'boss' | MonsterKind;

/** An enemy's stats. Level scales them, so each enemy carries its own in state. */
export interface EnemyStats {
  readonly level: number;
  readonly health: number;
  readonly attack: number;
  readonly ar: number;
  readonly dr: number;
  readonly defence: number;
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
  readonly meleeSeconds: number;
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

export type ObstacleKind = 'tree' | 'rock' | 'beacon' | 'waystone';

export interface Obstacle extends Point {
  readonly kind: ObstacleKind;
  readonly radius: number;
}

export interface ZoneState {
  readonly id: string;
  readonly obstacles: Obstacle[];
}

export interface GameState {
  tick: number;
  /** The generator's whole state. */
  rng: number;
  nextId: number;
  units: Unit[];
  zones: ZoneState[];
  /** Centre of the squad's triangle. */
  anchor: Point;
  /** Direction the triangle faces, in radians. */
  heading: number;
  scatterCooldownTicks: number;
  enemies: Enemy[];
  shots: Shot[];
  enemyShots: EnemyShot[];
  scheduled: ScheduledEffect[];
  drops: Drop[];
  /** The enemy the squad was last told to attack. */
  sharedTargetId: number | null;
  marks: number;
  potions: number;
  potionCooldownTicks: number;
  /** All three are down. Only the tick moves until they return to camp. */
  squadDown: boolean;
  /** Left until the squad returns to camp. */
  wipeTicks: number;
  /** The boss is dead. Only the tick still moves. */
  victory: boolean;
  /** Where the squad returns to after a wipe. */
  readonly camp: Point;
  readonly campHeading: number;
}

type DeepReadonly<T> = T extends readonly (infer Item)[]
  ? readonly DeepReadonly<Item>[]
  : T extends object
    ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
    : T;

/** How everything outside the core reads the game. */
export type GameView = DeepReadonly<GameState>;

/** What a game starts with. */
export interface Scenario {
  readonly name: string;
  readonly squadStart: Point;
  readonly squadHeading: number;
  /** Where the training dummy stands, if there is one. */
  readonly dummy: Point | null;
  readonly packs: readonly PackData[];
  /** Where the boss stands, if there is one. */
  readonly boss: Point | null;
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

export interface UpgradeCommand {
  readonly type: 'upgrade';
  readonly unitId: number;
  readonly slot: GearSlot;
}

export type Command =
  | MoveCommand
  | TargetCommand
  | CastCommand
  | PotionCommand
  | UpgradeCommand
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
  | 'not-near-anvil'
  | 'already-max'
  | 'run-over';

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
      /** Units and enemies share one run of IDs. */
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
      readonly type: 'upgraded';
      readonly tick: number;
      readonly unitId: number;
      readonly slot: GearSlot;
      readonly level: number;
    }
  | {
      readonly type: 'item-destroyed';
      readonly tick: number;
      readonly unitId: number;
      readonly slot: GearSlot;
      readonly level: number;
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
  | { readonly type: 'victory'; readonly tick: number };

/** Why auto-combat has stopped (D-007). */
export type AutoStop = 'danger' | 'clear' | 'squad-down' | 'victory';

export interface AutoResult {
  readonly commands: readonly Command[];
  readonly stop: AutoStop | null;
}

export type BotKind = 'careful' | 'sloppy';

/** One item on a bot's shopping list. */
export interface BotUpgrade {
  readonly classId: ClassId;
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
