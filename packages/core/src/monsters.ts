import { MONSTERS, MONSTER_RULES, SLAMMER, SPITTER } from '../data/enemies';
import { hurtUnit, wakePack } from './combat';
import { STANDING, type Drive } from './enemies';
import { randomBetween } from './random';
import type { Enemy, GameEvent, GameState, MonsterData, MonsterKind, Unit } from './state';
import { TICKS, secondsToTicks } from './time';

function dataOf(enemy: Enemy): MonsterData {
  return MONSTERS[enemy.kind as MonsterKind];
}

/** Who an enemy goes for: its taunter, then whoever it prefers, then the nearest. */
export function pickTarget(state: GameState, enemy: Enemy): Unit | null {
  const living = state.units.filter((unit) => unit.alive);
  const named = (id: number | null): Unit | undefined => living.find((unit) => unit.id === id);
  const taunter = enemy.tauntTicks > 0 ? named(enemy.tauntUnitId) : undefined;
  const nearest = living.reduce<Unit | null>((best, unit) => {
    const distance = Math.hypot(unit.x - enemy.x, unit.z - enemy.z);
    const bestDistance = best ? Math.hypot(best.x - enemy.x, best.z - enemy.z) : Infinity;
    return distance < bestDistance ? unit : best;
  }, null);
  return taunter ?? named(enemy.preferId) ?? nearest;
}

function spit(state: GameState, enemy: Enemy, target: Unit): void {
  const angle = Math.atan2(target.z - enemy.z, target.x - enemy.x);
  state.enemyShots.push({
    x: enemy.x,
    z: enemy.z,
    speedX: Math.cos(angle) * SPITTER.shotSpeed,
    speedZ: Math.sin(angle) * SPITTER.shotSpeed,
    damage: enemy.attack,
    sourceId: enemy.id,
    sourceAr: enemy.ar,
    ticks: TICKS.spitLife,
  });
}

/** The strike lands, once the wind-up is over. A slam is already on the ground as a telegraph. */
function strike(
  state: GameState,
  enemy: Enemy,
  target: Unit,
  distance: number,
  events: GameEvent[],
): void {
  const { behaviour } = dataOf(enemy);
  const { strikeCooldownLeast, strikeCooldownMost, landStrikeExtra } = MONSTER_RULES;
  const cooldown = randomBetween(state, strikeCooldownLeast, strikeCooldownMost);
  enemy.strikeTicks = secondsToTicks(cooldown);
  if (behaviour === 'spitter') {
    spit(state, enemy, target);
  } else if (behaviour === 'melee' && distance < enemy.reach + landStrikeExtra) {
    hurtUnit(state, target, enemy.attack, enemy, events);
  }
}

function drawSlam(state: GameState, enemy: Enemy): void {
  const ticks = enemy.windTicks;
  state.scheduled.push({
    kind: 'slam',
    ticks,
    totalTicks: ticks,
    enemyId: enemy.id,
    x: enemy.x,
    z: enemy.z,
    radius: SLAMMER.radius,
    hitRadius: SLAMMER.hitRadius,
    damage: enemy.attack,
  });
}

/** Keeps its distance, and fires from there. */
function spitterDrive(enemy: Enemy, dx: number, dz: number, distance: number): Drive {
  const speed = enemy.speed * (enemy.slowTicks > 0 ? MONSTER_RULES.slowShare : 1);
  if (distance < SPITTER.fireWithin && enemy.strikeTicks === 0) {
    enemy.windTicks = secondsToTicks(dataOf(enemy).windSeconds);
  }
  if (distance > SPITTER.approachBeyond) {
    return { x: dx / distance, z: dz / distance, speed };
  }
  return distance < SPITTER.retreatWithin
    ? { x: -dx / distance, z: -dz / distance, speed }
    : STANDING;
}

/** Walks in, and starts a strike once it is close. */
function closingDrive(
  state: GameState,
  enemy: Enemy,
  dx: number,
  dz: number,
  distance: number,
): Drive {
  const { closeReachShare, closeSizeShare, startStrikeExtra, slowShare } = MONSTER_RULES;
  const data = dataOf(enemy);
  if (distance < enemy.reach + startStrikeExtra && enemy.strikeTicks === 0) {
    enemy.windTicks = secondsToTicks(data.windSeconds);
    if (data.behaviour === 'slammer') {
      drawSlam(state, enemy);
    }
  }
  if (distance <= enemy.reach * closeReachShare + enemy.size * closeSizeShare) {
    return STANDING;
  }
  const speed = enemy.speed * (enemy.slowTicks > 0 ? slowShare : 1);
  return { x: dx / distance, z: dz / distance, speed };
}

/** One tick of a monster's thinking. Returns where it walks. */
export function updateMonster(state: GameState, enemy: Enemy, events: GameEvent[]): Drive {
  const target = pickTarget(state, enemy);
  if (!target) {
    return STANDING;
  }
  const dx = target.x - enemy.x;
  const dz = target.z - enemy.z;
  const distance = Math.hypot(dx, dz) || MONSTER_RULES.zeroDistance;
  if (!enemy.awake && distance < MONSTER_RULES.wakeRange) {
    wakePack(state, enemy);
  }
  if (enemy.windTicks > 0) {
    enemy.windTicks -= 1;
    if (enemy.windTicks === 0) {
      strike(state, enemy, target, distance, events);
    }
    return STANDING;
  }
  if (!enemy.awake) {
    return STANDING;
  }
  return dataOf(enemy).behaviour === 'spitter'
    ? spitterDrive(enemy, dx, dz, distance)
    : closingDrive(state, enemy, dx, dz, distance);
}
