import { MONSTERS, MONSTER_RULES, SLAMMER, SPITTER } from '../data/enemies';
import { ROUTE } from '../data/movement';
import { hurtUnit, wakePack } from './combat';
import { STANDING, type Drive } from './enemies';
import { findRouteForEnemy, lineClearForEnemy } from './grid';
import type { Enemy, GameEvent, GameState, MonsterData, MonsterKind, Body, Point } from './state';
import { TICKS, secondsToTicks } from './time';
import { gridOf } from './world';

function dataOf(enemy: Enemy): MonsterData {
  return MONSTERS[enemy.kind as MonsterKind];
}

/** Who an enemy goes for: its taunter, then whoever it prefers, then the nearest. */
export function pickTarget(state: GameState, enemy: Enemy): Body | null {
  const living = state.bodies.filter((unit) => unit.alive);
  const named = (id: number | null): Body | undefined => living.find((unit) => unit.id === id);
  const taunter = enemy.tauntTicks > 0 ? named(enemy.tauntUnitId) : undefined;
  const nearest = living.reduce<Body | null>((best, unit) => {
    const distance = Math.hypot(unit.x - enemy.x, unit.z - enemy.z);
    const bestDistance = best ? Math.hypot(best.x - enemy.x, best.z - enemy.z) : Infinity;
    return distance < bestDistance ? unit : best;
  }, null);
  return taunter ?? named(enemy.preferId) ?? nearest;
}

function spit(state: GameState, enemy: Enemy, target: Body): void {
  const angle = Math.atan2(target.z - enemy.z, target.x - enemy.x);
  state.live.enemyShots.push({
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
  target: Body,
  distance: number,
  events: GameEvent[],
): void {
  const { behaviour } = dataOf(enemy);
  enemy.strikeTicks = secondsToTicks(enemy.attackSeconds);
  if (behaviour === 'spitter') {
    spit(state, enemy, target);
  } else if (behaviour === 'melee' && distance < enemy.reach + MONSTER_RULES.landStrikeExtra) {
    hurtUnit(state, target, enemy.attack, enemy, events);
  }
}

function drawSlam(state: GameState, enemy: Enemy): void {
  const ticks = enemy.windTicks;
  state.live.scheduled.push({
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

/**
 * The next point on the way to a target. A monster walks straight when its own ground
 * allows, and takes a route only when it does not (D-060). A search waits for the
 * monster's turn, which comes twice a second and falls on a different tick for each
 * monster, so a pack shares the work.
 */
function chasePoint(state: GameState, enemy: Enemy, target: Point): Point {
  const grid = gridOf(state);
  if (lineClearForEnemy(grid, enemy, target)) {
    enemy.route = [];
    enemy.routeGoal = null;
    return target;
  }
  const { routeGoal } = enemy;
  const kept =
    routeGoal !== null &&
    enemy.route.length > 0 &&
    Math.hypot(routeGoal.x - target.x, routeGoal.z - target.z) < ROUTE.goalDrift &&
    lineClearForEnemy(grid, enemy, enemy.route[0] ?? target);
  if (kept) {
    enemy.route[enemy.route.length - 1] = { x: target.x, z: target.z };
  } else if ((state.tick + enemy.id) % TICKS.monsterRouteSearch === 0) {
    const route = findRouteForEnemy(grid, enemy, target);
    enemy.route = route ?? [];
    enemy.routeGoal = route ? { x: target.x, z: target.z } : null;
  }
  const { route } = enemy;
  while (route.length > 1 && lineClearForEnemy(grid, enemy, route[1] as Point)) {
    route.shift();
  }
  return route[0] ?? target;
}

/** The way to walk to reach a target, at a speed. */
function chase(state: GameState, enemy: Enemy, target: Point, speed: number): Drive {
  const point = chasePoint(state, enemy, target);
  const dx = point.x - enemy.x;
  const dz = point.z - enemy.z;
  const distance = Math.hypot(dx, dz) || MONSTER_RULES.zeroDistance;
  return { x: dx / distance, z: dz / distance, speed };
}

/** Keeps its distance, and fires from there. */
function spitterDrive(
  state: GameState,
  enemy: Enemy,
  target: Point,
  dx: number,
  dz: number,
  distance: number,
): Drive {
  const speed = enemy.speed * (enemy.slowTicks > 0 ? MONSTER_RULES.slowShare : 1);
  if (distance < SPITTER.fireWithin && enemy.strikeTicks === 0) {
    enemy.windTicks = secondsToTicks(dataOf(enemy).windSeconds);
  }
  if (distance > SPITTER.approachBeyond) {
    return chase(state, enemy, target, speed);
  }
  return distance < SPITTER.retreatWithin
    ? { x: -dx / distance, z: -dz / distance, speed }
    : STANDING;
}

/** Walks in, and starts a strike once it is close. */
function closingDrive(state: GameState, enemy: Enemy, target: Point, distance: number): Drive {
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
  return chase(state, enemy, target, speed);
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
    ? spitterDrive(state, enemy, target, dx, dz, distance)
    : closingDrive(state, enemy, target, distance);
}
