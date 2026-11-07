/** Everything the game remembers. All of it is plain data (D-015). */

export interface Point {
  readonly x: number;
  readonly z: number;
}

export type ClassId = 'fighter' | 'shooter' | 'healer';

export interface ClassData {
  /** World units per second. */
  readonly speed: number;
  /** Where the unit starts, from the scenario's starting point. */
  readonly startOffset: Point;
  /** The unit's place in the triangle, from its centre, facing the heading. */
  readonly slot: { readonly forward: number; readonly side: number };
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
  /** Stored now. It has no effect until S2.2b. */
  attackMove: boolean;
  /** Closest the unit has come to `dest`. */
  bestDistance: number | null;
  stuckTicks: number;
  dashTicks: number;
  dashX: number;
  dashZ: number;
  /** Stored now. It matters once units can be hurt. */
  invulnerableTicks: number;
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
}

export interface MoveCommand {
  readonly type: 'move';
  readonly unitIds: readonly number[];
  readonly x: number;
  readonly z: number;
  /** Stored now. It has no effect until S2.2b. */
  readonly attack: boolean;
}

export type Command = MoveCommand | { readonly type: 'regroup' } | { readonly type: 'scatter' };

export type RefusalReason = 'bad-point' | 'unknown-unit' | 'no-living-units' | 'on-cooldown';

export type GameEvent =
  | { readonly type: 'order-accepted'; readonly tick: number; readonly order: Command['type'] }
  | {
      readonly type: 'order-refused';
      readonly tick: number;
      readonly order: Command['type'];
      readonly reason: RefusalReason;
    }
  | { readonly type: 'unit-arrived'; readonly tick: number; readonly unitId: number }
  | { readonly type: 'unit-gave-up'; readonly tick: number; readonly unitId: number };

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
