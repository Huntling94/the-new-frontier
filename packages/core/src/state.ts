import type { SPELLS } from '../data/spells';

/** Everything the game remembers. All of it is plain data (D-015). */

export interface Point {
  readonly x: number;
  readonly z: number;
}

export type ClassId = 'fighter' | 'shooter' | 'healer';

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

export interface EnemyData {
  readonly level: number;
  readonly health: number;
  readonly attack: number;
  readonly ar: number;
  readonly dr: number;
  readonly defence: number;
  readonly size: number;
  readonly reach: number;
  readonly xp: number;
  readonly strikeSeconds: number;
  readonly respawnSeconds: number;
  /** Share of knockback that moves it. */
  readonly knockbackShare: number;
}

export interface Enemy {
  readonly id: number;
  readonly kind: 'dummy';
  alive: boolean;
  x: number;
  z: number;
  health: number;
  readonly maxHealth: number;
  strikeTicks: number;
  respawnTicks: number;
  /** Taunt, the slow and knockback are set here, and monsters act on them in S2.2c. */
  tauntTicks: number;
  slowTicks: number;
  knockX: number;
  knockZ: number;
  staggerTicks: number;
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

/** A delayed effect, held as a record so that a save keeps it (D-015). */
export interface ScheduledStrike {
  readonly kind: 'volley-strike';
  ticks: number;
  readonly unitId: number;
  readonly x: number;
  readonly z: number;
}

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
  scheduled: ScheduledStrike[];
  /** The enemy the squad was last told to attack. */
  sharedTargetId: number | null;
  marks: number;
  potions: number;
  potionCooldownTicks: number;
  /** All three are down, and only the tick still moves. */
  squadDown: boolean;
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
  | 'already-max';

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
  | { readonly type: 'squad-down'; readonly tick: number };

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
