import { BOSS } from '../data/enemies';
import { hurtUnit, wakeBoss } from './combat';
import { STANDING, createMonster, type Drive } from './enemies';
import { centreOf, livingUnits } from './formation';
import { TAU } from './island';
import { pickTarget } from './monsters';
import { nextRandom, randomBetween } from './random';
import type {
  BossMove,
  BossState,
  ChargeTelegraph,
  Enemy,
  GameEvent,
  GameState,
  Unit,
} from './state';
import { TICKS, secondsToTicks } from './time';

const MOVES: readonly BossMove[] = ['slam', 'charge', 'blast', 'summon'];

function isEnraged(enemy: Enemy): boolean {
  return enemy.health < enemy.maxHealth * BOSS.enrageBelowShare;
}

/** Cooldowns are multiplied by the pace, so an enraged boss moves sooner. */
function setCooldown(enemy: Enemy, seconds: number): void {
  const pace = isEnraged(enemy) ? BOSS.enragedPace : BOSS.calmPace;
  enemy.strikeTicks = secondsToTicks(seconds * pace);
}

function wait(boss: BossState, seconds: number): void {
  boss.phase = 'waiting';
  boss.phaseTicks = 0;
  boss.waitTicks = secondsToTicks(seconds);
}

function startSlam(state: GameState, enemy: Enemy, boss: BossState): void {
  const { slam } = BOSS;
  const centre = centreOf(livingUnits(state));
  const count = isEnraged(enemy) ? slam.enragedCount : slam.calmCount;
  const ticks = secondsToTicks(slam.telegraphSeconds);
  for (let index = 0; index < count; index += 1) {
    const spread = index === 0 ? 0 : slam.spread;
    state.scheduled.push({
      kind: 'slam',
      ticks,
      totalTicks: ticks,
      enemyId: enemy.id,
      x: centre.x + randomBetween(state, -spread, spread),
      z: centre.z + randomBetween(state, -spread, spread),
      radius: slam.radius,
      hitRadius: slam.hitRadius,
      damage: enemy.attack * slam.damageShare,
    });
  }
  wait(boss, slam.waitSeconds);
  setCooldown(enemy, slam.cooldownSeconds);
}

/** The boss turns on the Healer, unless it is taunted or the Healer is down. */
function chargeTarget(state: GameState, enemy: Enemy, target: Unit): Unit {
  const healer = state.units.find((unit) => unit.classId === 'healer' && unit.alive);
  return enemy.tauntTicks > 0 ? target : (healer ?? target);
}

function startChargeLine(state: GameState, enemy: Enemy, boss: BossState, target: Unit): void {
  const { charge } = BOSS;
  const ticks = secondsToTicks(charge.telegraphSeconds);
  const aimAt = chargeTarget(state, enemy, target);
  boss.chargeAngle = Math.atan2(aimAt.z - enemy.z, aimAt.x - enemy.x);
  boss.phase = 'aiming';
  boss.phaseTicks = 0;
  state.scheduled.push({
    kind: 'charge',
    ticks,
    totalTicks: ticks,
    enemyId: enemy.id,
    x: enemy.x,
    z: enemy.z,
    angle: boss.chargeAngle,
    length: charge.length,
    width: charge.width,
  });
  setCooldown(enemy, charge.cooldownSeconds);
}

function startBlast(enemy: Enemy, boss: BossState): void {
  const { calmSeconds, enragedSeconds } = BOSS.blast;
  boss.castTotalTicks = secondsToTicks(isEnraged(enemy) ? enragedSeconds : calmSeconds);
  boss.castTicks = boss.castTotalTicks;
}

function summon(state: GameState, enemy: Enemy, boss: BossState): void {
  const { kind, level, health, calmCount, enragedCount, distance, turn } = BOSS.summon;
  const healer = state.units.find((unit) => unit.classId === 'healer');
  const count = isEnraged(enemy) ? enragedCount : calmCount;
  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * TAU + randomBetween(state, 0, turn);
    const point = {
      x: enemy.x + Math.cos(angle) * distance,
      z: enemy.z + Math.sin(angle) * distance,
    };
    state.enemies.push({
      ...createMonster(state, kind, level, point),
      health,
      maxHealth: health,
      xp: 0,
      awake: true,
      minion: true,
      preferId: healer?.id ?? null,
    });
  }
  wait(boss, BOSS.summon.waitSeconds);
  setCooldown(enemy, BOSS.summon.cooldownSeconds);
}

function startMove(state: GameState, enemy: Enemy, boss: BossState, target: Unit): void {
  const options = MOVES.filter((move) => move !== boss.lastMove);
  const move = options[Math.floor(nextRandom(state) * options.length)] as BossMove;
  boss.lastMove = move;
  switch (move) {
    case 'slam':
      startSlam(state, enemy, boss);
      break;
    case 'charge':
      startChargeLine(state, enemy, boss, target);
      break;
    case 'blast':
      startBlast(enemy, boss);
      break;
    case 'summon':
      summon(state, enemy, boss);
      break;
  }
}

function updateCast(state: GameState, enemy: Enemy, boss: BossState, events: GameEvent[]): void {
  boss.castTicks -= 1;
  if (boss.castTicks === 0) {
    const { damageShare, cooldownSeconds } = BOSS.blast;
    for (const unit of livingUnits(state)) {
      hurtUnit(state, unit, enemy.attack * damageShare, enemy, events);
    }
    setCooldown(enemy, cooldownSeconds);
  }
}

function updateCharge(state: GameState, enemy: Enemy, boss: BossState, events: GameEvent[]): Drive {
  const { charge } = BOSS;
  if (boss.phaseTicks > TICKS.chargeLength) {
    boss.phase = 'free';
    boss.phaseTicks = 0;
    setCooldown(enemy, charge.cooldownSeconds);
    return STANDING;
  }
  for (const unit of livingUnits(state)) {
    const near = Math.hypot(unit.x - enemy.x, unit.z - enemy.z) < enemy.size + charge.hitExtra;
    if (near && !boss.chargeHitIds.includes(unit.id)) {
      boss.chargeHitIds.push(unit.id);
      hurtUnit(state, unit, enemy.attack * charge.damageShare, enemy, events);
    }
  }
  return {
    x: Math.cos(boss.chargeAngle),
    z: Math.sin(boss.chargeAngle),
    speed: charge.speed,
  };
}

/** Between moves it walks to its target, and swings once in reach. */
function updateFree(
  state: GameState,
  enemy: Enemy,
  boss: BossState,
  target: Unit,
  events: GameEvent[],
): Drive {
  const dx = target.x - enemy.x;
  const dz = target.z - enemy.z;
  const distance = Math.hypot(dx, dz);
  if (boss.phaseTicks > TICKS.bossWalkAfter && distance > enemy.reach) {
    const speed = enemy.speed * (enemy.slowTicks > 0 ? BOSS.slowShare : 1);
    return { x: dx / distance, z: dz / distance, speed };
  }
  if (distance <= enemy.reach + BOSS.meleeExtraReach) {
    boss.meleeTicks -= 1;
    if (boss.meleeTicks <= 0) {
      boss.meleeTicks = TICKS.bossMelee;
      hurtUnit(state, target, enemy.attack * BOSS.meleeShare, enemy, events);
    }
  }
  return STANDING;
}

/** One tick of the boss's thinking. Returns where it walks. */
export function updateBoss(state: GameState, enemy: Enemy, events: GameEvent[]): Drive {
  const { boss } = enemy;
  if (!boss) {
    return STANDING;
  }
  boss.phaseTicks += 1;
  if (!enemy.awake) {
    const isNear = (unit: Unit): boolean => {
      return Math.hypot(unit.x - enemy.x, unit.z - enemy.z) < BOSS.wakeRange;
    };
    if (livingUnits(state).some(isNear)) {
      wakeBoss(state, enemy, events);
    }
    return STANDING;
  }
  const target = pickTarget(state, enemy);
  if (!target || enemy.staggerTicks > 0) {
    return STANDING;
  }
  if (boss.castTicks > 0) {
    updateCast(state, enemy, boss, events);
    return STANDING;
  }
  switch (boss.phase) {
    case 'charging':
      return updateCharge(state, enemy, boss, events);
    case 'aiming':
      return STANDING;
    case 'waiting':
      if (boss.phaseTicks > boss.waitTicks) {
        boss.phase = 'free';
        boss.phaseTicks = 0;
      }
      return STANDING;
    case 'free':
      if (enemy.strikeTicks > 0) {
        return updateFree(state, enemy, boss, target, events);
      }
      startMove(state, enemy, boss, target);
      return STANDING;
  }
}

/** The telegraph has run out, so the boss sets off along the line. */
export function startCharge(state: GameState, telegraph: ChargeTelegraph): void {
  const enemy = state.enemies.find(({ id }) => id === telegraph.enemyId);
  if (enemy?.boss) {
    enemy.boss.phase = 'charging';
    enemy.boss.phaseTicks = 0;
    enemy.boss.chargeHitIds = [];
  }
}

/** Crippling Shot stops a cast, if this enemy is the boss and it is casting. */
export function interruptBoss(state: GameState, enemy: Enemy, events: GameEvent[]): void {
  if (enemy.alive && enemy.boss && enemy.boss.castTicks > 0) {
    enemy.boss.castTicks = 0;
    enemy.staggerTicks = TICKS.bossInterrupt;
    enemy.strikeTicks = TICKS.bossInterrupt;
    events.push({ type: 'interrupted', tick: state.tick, enemyId: enemy.id });
  }
}

export function removeMinions(state: GameState): void {
  state.enemies = state.enemies.filter((enemy) => !enemy.minion);
}

/** Puts the boss back as it was. Any other enemy is left as it is. */
export function resetBoss(enemy: Enemy): void {
  const { boss } = enemy;
  if (!boss) {
    return;
  }
  enemy.health = enemy.maxHealth;
  enemy.awake = false;
  enemy.x = enemy.homeX;
  enemy.z = enemy.homeZ;
  enemy.moveX = 0;
  enemy.moveZ = 0;
  enemy.strikeTicks = TICKS.bossFirstMove;
  enemy.tauntTicks = 0;
  enemy.slowTicks = 0;
  enemy.staggerTicks = 0;
  boss.phase = 'free';
  boss.phaseTicks = 0;
  boss.lastMove = null;
  boss.castTicks = 0;
  boss.meleeTicks = 0;
}
