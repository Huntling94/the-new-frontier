import type { BossData, EnemyStats, MonsterData, MonsterKind, PackData } from '../src/state';
import { NO_RESISTANCE } from './combat';

/**
 * A level 5 Rooster with far more health and a longer reach. A rooster walks in
 * to hit, but the dummy stands still, so a rooster's reach would miss a Fighter at
 * the edge of melee range. These are not balance.
 */
export const DUMMY: EnemyStats & {
  readonly respawnSeconds: number;
} = {
  level: 5,
  health: 34000,
  attack: 89,
  ar: 3,
  dr: 3,
  defence: 19,
  attackSeconds: 1,
  crit: 0,
  evade: 0,
  block: 0,
  resistances: NO_RESISTANCE,
  size: 1.15,
  speed: 0,
  reach: 5.5,
  xp: 338,
  knockbackShare: 1,
  respawnSeconds: 10,
};

/**
 * The Lande's monster types (D-050), each with its own sheet. Health, attack, AR, DR and
 * defence are shares of what its level gives. `attackSeconds` is the wait after a strike
 * lands before the next wind-up can begin. Names are working names (D-038).
 */
export const MONSTERS: Readonly<Record<MonsterKind, MonsterData>> = {
  wasp: {
    name: 'Wasp',
    attackSeconds: 1.1,
    arShare: 1,
    drShare: 1,
    defenceShare: 1,
    crit: 0,
    evade: 0,
    block: 0,
    resistances: NO_RESISTANCE,
    behaviour: 'melee',
    healthShare: 0.4,
    attackShare: 0.6,
    size: 0.8,
    speed: 9.5,
    reach: 1.9,
    xpShare: 0.5,
    knockbackShare: 1,
    windSeconds: 0.12,
    coins: { least: 1, most: 2 },
  },
  rooster: {
    name: 'Rooster',
    attackSeconds: 1.4,
    arShare: 1,
    drShare: 1,
    defenceShare: 1,
    crit: 0,
    evade: 0,
    block: 0,
    resistances: NO_RESISTANCE,
    behaviour: 'melee',
    healthShare: 1,
    attackShare: 1,
    size: 1.15,
    speed: 7.2,
    reach: 2.8,
    xpShare: 1,
    knockbackShare: 1,
    windSeconds: 0.3,
    coins: { least: 1, most: 2 },
  },
  viper: {
    name: 'Viper',
    attackSeconds: 1.6,
    arShare: 1,
    drShare: 1,
    defenceShare: 1,
    crit: 0,
    evade: 0,
    block: 0,
    resistances: NO_RESISTANCE,
    behaviour: 'spitter',
    healthShare: 0.8,
    attackShare: 0.9,
    size: 1.2,
    speed: 5,
    reach: 18,
    xpShare: 1.1,
    knockbackShare: 1,
    windSeconds: 0.5,
    coins: { least: 1, most: 2 },
  },
  boar: {
    name: 'Wild Boar',
    attackSeconds: 1.8,
    arShare: 1,
    drShare: 1,
    defenceShare: 1,
    crit: 0,
    evade: 0,
    block: 0,
    resistances: NO_RESISTANCE,
    behaviour: 'slammer',
    healthShare: 2.8,
    attackShare: 1.7,
    size: 2,
    speed: 6,
    reach: 5.5,
    xpShare: 2.4,
    knockbackShare: 0.4,
    windSeconds: 0.95,
    coins: { least: 4, most: 4 },
  },
};

/** What a monster's level gives it, before its type's shares. */
export const MONSTER_LEVELS = {
  healthBase: 300,
  healthPerLevel: 62,
  healthPerLevelSquared: 6,
  attackBase: 34,
  attackPerLevel: 11,
  arPerLevel: 0.55,
  drPerLevel: 0.5,
  defenceBase: 14,
  defencePerLevel: 1,
  /** A monster's XP is the XP for its level divided by this, times its share. */
  xpDivisor: 4.5,
};

/** How monsters behave. Times are seconds, and speeds are per second. */
export const MONSTER_RULES = {
  /** A pack wakes when a unit comes this close to any of its members. */
  wakeRange: 17,
  /** Where members land, as a square around the pack's point. */
  spread: 6,
  leastScale: 0.95,
  mostScale: 1.05,
  firstStrikeLeast: 0.4,
  firstStrikeMost: 1.4,
  /** A pack coming back lands no monster closer than this to a character (S3f decision 20). */
  respawnClearance: 3,
  /** How far from its place, in whole units each way, a monster looks for a clear spot. */
  respawnSearch: 20,
  /** A slowed monster moves at this share of its speed. */
  slowShare: 0.45,
  /** Melee monsters close to this share of their reach, plus a share of their size. */
  closeReachShare: 0.75,
  closeSizeShare: 0.3,
  /** How far past its reach a monster starts a strike, and how far one still lands. */
  startStrikeExtra: 1,
  landStrikeExtra: 1.2,
  /** Share of the gap to its wanted speed that a monster closes per second. */
  turnRate: 9,
  /** Monsters closer than this share of their sizes push apart. */
  spacingSizeShare: 0.75,
  pushRate: 5,
  /** Monsters closer than this have no direction to push in. */
  minPushDistance: 0.01,
  /** Stands in for a distance of zero when dividing by it. */
  zeroDistance: 0.1,
  /** How far a monster stays from an obstacle, as a share of its size. */
  obstacleSizeShare: 0.7,
};

export const SPITTER = {
  /** Walks in beyond this, and backs away inside the next. */
  approachBeyond: 17,
  retreatWithin: 8,
  fireWithin: 20,
  shotSpeed: 17,
  shotLifeSeconds: 2.6,
  shotHitRadius: 1.3,
};

/** The Wild Boar's slam. What is drawn is a little smaller than what lands. */
export const SLAMMER = { radius: 6.5, hitRadius: 6.9 };

export const PACKS: readonly PackData[] = [
  {
    x: -38,
    z: 50,
    level: 3,
    mobs: [
      { kind: 'rooster', count: 3 },
      { kind: 'wasp', count: 3 },
    ],
  },
  {
    // Moved 2 units off z 52, where a standing stone's margin covered its centre (S3a).
    x: 38,
    z: 50,
    level: 3,
    mobs: [
      { kind: 'rooster', count: 2 },
      { kind: 'viper', count: 2 },
    ],
  },
  {
    x: -62,
    z: 12,
    level: 4,
    mobs: [
      { kind: 'viper', count: 3 },
      { kind: 'rooster', count: 2 },
    ],
  },
  {
    x: 62,
    z: 10,
    level: 4,
    mobs: [
      { kind: 'boar', count: 1 },
      { kind: 'wasp', count: 4 },
    ],
  },
  {
    x: -46,
    z: -42,
    level: 5,
    mobs: [
      { kind: 'boar', count: 1 },
      { kind: 'rooster', count: 3 },
    ],
  },
  {
    x: 46,
    z: -44,
    level: 5,
    mobs: [
      { kind: 'boar', count: 1 },
      { kind: 'viper', count: 3 },
    ],
  },
  {
    x: 0,
    z: -66,
    level: 6,
    mobs: [
      { kind: 'boar', count: 2 },
      { kind: 'rooster', count: 2 },
      { kind: 'viper', count: 2 },
    ],
  },
];

/**
 * The Warden, from the squad test. No zone holds it for now (D-052); it waits for quest
 * and raid bosses. Times are seconds, and damage is a share of attack.
 */
export const BOSS: BossData = {
  level: 8,
  health: 32000,
  attack: 215,
  ar: 6,
  dr: 5,
  defence: 40,
  attackSeconds: 1.8,
  crit: 0,
  evade: 0,
  block: 0,
  resistances: NO_RESISTANCE,
  size: 3.6,
  speed: 6,
  reach: 7,
  xp: 2200,
  knockbackShare: 0,
  wakeRange: 13,
  firstMoveSeconds: 2.5,
  wokenMoveSeconds: 1.5,
  enrageBelowShare: 0.25,
  calmPace: 1.3,
  enragedPace: 1,
  slowShare: 0.5,
  walkAfterSeconds: 0.2,
  meleeExtraReach: 1,
  meleeShare: 0.6,
  interruptSeconds: 2.4,
  slam: {
    radius: 9,
    hitRadius: 9.4,
    telegraphSeconds: 1.45,
    waitSeconds: 1.3,
    cooldownSeconds: 1.8,
    damageShare: 1.7,
    calmCount: 1,
    enragedCount: 2,
    spread: 7,
  },
  charge: {
    length: 36,
    width: 8,
    telegraphSeconds: 1.2,
    seconds: 0.7,
    speed: 40,
    hitExtra: 1.4,
    damageShare: 1.6,
    cooldownSeconds: 1.2,
  },
  blast: {
    calmSeconds: 3.6,
    enragedSeconds: 3,
    damageShare: 2.6,
    cooldownSeconds: 2,
  },
  summon: {
    kind: 'wasp',
    level: 7,
    health: 600,
    calmCount: 2,
    enragedCount: 3,
    distance: 8,
    turn: 1,
    waitSeconds: 0.8,
    cooldownSeconds: 2,
  },
};

/** What monsters leave behind. */
export const LOOT = {
  /** Share of kills that leave a potion. */
  potionChance: 0.05,
  coinBase: 10,
  coinPerLevel: 5,
  /** How long a drop flies, and how fast, before it lands. */
  flightSeconds: 0.55,
  leastFlightSpeed: 2,
  mostFlightSpeed: 6,
  /** A landed drop slides to the nearest unit in this range. */
  pullRange: 13,
  pullSpeed: 24,
  collectRange: 1.5,
};

/** How long the squad lies down before returning to camp. */
export const WIPE = { seconds: 2.2 };
