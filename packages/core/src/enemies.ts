import { BOSS, DUMMY, MONSTERS, MONSTER_LEVELS, MONSTER_RULES } from '../data/enemies';
import { updateBoss } from './boss';
import { hurtUnit } from './combat';
import { updateMonster } from './monsters';
import { randomBetween } from './random';
import { xpToNextLevel } from './stats';
import type {
  Enemy,
  EnemyKind,
  EnemyStats,
  GameEvent,
  GameState,
  MonsterKind,
  PackData,
  Point,
  Body,
} from './state';
import { KNOCKBACK_LEFT_PER_TICK, TICKS, TURN_PER_TICK, perTick, secondsToTicks } from './time';
import { isWalkableForEnemy, pushOutOfObstacles } from './world';

/** Which way an enemy wants to go this tick, and how fast. */
export interface Drive {
  readonly x: number;
  readonly z: number;
  readonly speed: number;
}

export const STANDING: Drive = { x: 0, z: 0, speed: 0 };

function createEnemy(state: GameState, kind: EnemyKind, point: Point, stats: EnemyStats): Enemy {
  const id = state.nextId;
  state.nextId += 1;
  return {
    level: stats.level,
    attack: stats.attack,
    ar: stats.ar,
    dr: stats.dr,
    defence: stats.defence,
    size: stats.size,
    speed: stats.speed,
    reach: stats.reach,
    xp: stats.xp,
    knockbackShare: stats.knockbackShare,
    id,
    kind,
    packId: null,
    minion: false,
    homeX: point.x,
    homeZ: point.z,
    alive: true,
    awake: false,
    x: point.x,
    z: point.z,
    moveX: 0,
    moveZ: 0,
    health: stats.health,
    maxHealth: stats.health,
    strikeTicks: 0,
    windTicks: 0,
    respawnTicks: 0,
    tauntTicks: 0,
    tauntUnitId: null,
    preferId: null,
    slowTicks: 0,
    knockX: 0,
    knockZ: 0,
    staggerTicks: 0,
    boss: null,
  };
}

export function createDummy(state: GameState, point: Point): Enemy {
  return {
    ...createEnemy(state, 'dummy', point, DUMMY),
    awake: true,
    strikeTicks: TICKS.dummyStrike,
  };
}

export function createBoss(state: GameState, point: Point): Enemy {
  return {
    ...createEnemy(state, 'boss', point, BOSS),
    strikeTicks: TICKS.bossFirstMove,
    boss: {
      phase: 'free',
      phaseTicks: 0,
      waitTicks: 0,
      lastMove: null,
      castTicks: 0,
      castTotalTicks: 0,
      meleeTicks: 0,
      chargeAngle: 0,
      chargeHitIds: [],
    },
  };
}

/** A monster of that kind and level, with a little random size. */
export function createMonster(
  state: GameState,
  kind: MonsterKind,
  level: number,
  point: Point,
): Enemy {
  const data = MONSTERS[kind];
  const levels = MONSTER_LEVELS;
  const { leastScale, mostScale, firstStrikeLeast, firstStrikeMost } = MONSTER_RULES;
  const scale = randomBetween(state, leastScale, mostScale);
  const health =
    levels.healthBase + levels.healthPerLevel * level + levels.healthPerLevelSquared * level ** 2;
  const enemy = createEnemy(state, kind, point, {
    level,
    health: health * data.healthShare,
    attack: (levels.attackBase + levels.attackPerLevel * level) * data.attackShare,
    ar: Math.round(level * levels.arPerLevel),
    dr: Math.round(level * levels.drPerLevel),
    defence: levels.defenceBase + levels.defencePerLevel * level,
    size: data.size * scale,
    speed: data.speed,
    reach: data.reach,
    xp: (xpToNextLevel(level) / levels.xpDivisor) * data.xpShare,
    knockbackShare: data.knockbackShare,
  });
  const firstStrike = randomBetween(state, firstStrikeLeast, firstStrikeMost);
  return { ...enemy, strikeTicks: secondsToTicks(firstStrike) };
}

export function createPack(state: GameState, pack: PackData, packId: number): Enemy[] {
  const { spread } = MONSTER_RULES;
  return pack.mobs.flatMap(({ kind, count }) => {
    return Array.from({ length: count }, () => {
      const x = pack.x + randomBetween(state, -spread, spread);
      const z = pack.z + randomBetween(state, -spread, spread);
      return { ...createMonster(state, kind, pack.level, { x, z }), packId };
    });
  });
}

function nearestInReach(state: GameState, enemy: Enemy): Body | null {
  let best: Body | null = null;
  let bestDistance = enemy.reach;
  for (const unit of state.bodies) {
    const distance = Math.hypot(unit.x - enemy.x, unit.z - enemy.z);
    if (unit.alive && distance < bestDistance) {
      best = unit;
      bestDistance = distance;
    }
  }
  return best;
}

function respawn(enemy: Enemy): void {
  enemy.alive = true;
  enemy.health = enemy.maxHealth;
  enemy.strikeTicks = TICKS.dummyStrike;
  enemy.tauntTicks = 0;
  enemy.slowTicks = 0;
  enemy.staggerTicks = 0;
  enemy.knockX = 0;
  enemy.knockZ = 0;
}

/** The dummy stands still and strikes on a timer. */
function updateDummy(state: GameState, enemy: Enemy, events: GameEvent[]): void {
  const unit = nearestInReach(state, enemy);
  if (unit && enemy.strikeTicks === 0) {
    enemy.strikeTicks = TICKS.dummyStrike;
    hurtUnit(state, unit, enemy.attack, enemy, events);
  }
}

/** Monsters spread out and go round obstacles. Only the boss walks through what it meets. */
function keepApart(state: GameState, enemy: Enemy): void {
  const { spacingSizeShare, pushRate, minPushDistance, obstacleSizeShare } = MONSTER_RULES;
  for (const other of state.live.enemies) {
    if (other === enemy || !other.alive) {
      continue;
    }
    const dx = enemy.x - other.x;
    const dz = enemy.z - other.z;
    const distance = Math.hypot(dx, dz);
    const reach = (enemy.size + other.size) * spacingSizeShare;
    if (distance < reach && distance > minPushDistance) {
      const push = (reach - distance) * perTick(pushRate);
      enemy.x += (dx / distance) * push;
      enemy.z += (dz / distance) * push;
    }
  }
  pushOutOfObstacles(state, enemy, enemy.size * obstacleSizeShare);
}

function moveEnemy(state: GameState, enemy: Enemy, drive: Drive): void {
  enemy.moveX += (drive.x * drive.speed - enemy.moveX) * TURN_PER_TICK;
  enemy.moveZ += (drive.z * drive.speed - enemy.moveZ) * TURN_PER_TICK;
  const x = enemy.x + perTick(enemy.moveX + enemy.knockX);
  const z = enemy.z + perTick(enemy.moveZ + enemy.knockZ);
  if (isWalkableForEnemy(state, x, z)) {
    enemy.x = x;
    enemy.z = z;
  }
  if (!enemy.boss) {
    keepApart(state, enemy);
  }
}

/** One tick of one enemy. */
export function updateEnemy(state: GameState, enemy: Enemy, events: GameEvent[]): void {
  if (!enemy.alive) {
    enemy.respawnTicks -= 1;
    if (enemy.kind === 'dummy' && enemy.respawnTicks <= 0) {
      respawn(enemy);
    }
    return;
  }
  enemy.tauntTicks = Math.max(0, enemy.tauntTicks - 1);
  enemy.slowTicks = Math.max(0, enemy.slowTicks - 1);
  enemy.staggerTicks = Math.max(0, enemy.staggerTicks - 1);
  enemy.strikeTicks = Math.max(0, enemy.strikeTicks - 1);
  if (enemy.kind === 'dummy') {
    updateDummy(state, enemy, events);
  } else {
    const think = enemy.boss ? updateBoss : updateMonster;
    moveEnemy(state, enemy, think(state, enemy, events));
  }
  enemy.knockX *= KNOCKBACK_LEFT_PER_TICK;
  enemy.knockZ *= KNOCKBACK_LEFT_PER_TICK;
}
