import { SHOTS } from '../data/combat';
import { SPITTER } from '../data/enemies';
import { SPELLS } from '../data/spells';
import { interruptBoss, startCharge } from './boss';
import { aliveEnemy, hitEnemy, hurtUnit } from './combat';
import { livingUnits } from './formation';
import type {
  Enemy,
  EnemyShot,
  GameEvent,
  GameState,
  ScheduledStrike,
  Shot,
  SlamTelegraph,
  Body,
} from './state';
import { TICKS, perTick } from './time';

export function fireShot(
  state: GameState,
  unit: Body,
  enemy: Enemy,
  multiplier: number,
  crippling: boolean,
): void {
  state.live.shots.push({
    x: unit.x,
    z: unit.z,
    unitId: unit.id,
    enemyId: enemy.id,
    multiplier,
    crippling,
    ticks: TICKS.shotLife,
  });
}

function unitById(state: GameState, id: number): Body {
  const unit = state.bodies.find((candidate) => candidate.id === id);
  if (!unit) {
    throw new Error(`No unit has ID ${String(id)}.`);
  }
  return unit;
}

/** Moves one shot. Returns whether it is still flying. */
function updateShot(state: GameState, shot: Shot, events: GameEvent[]): boolean {
  shot.ticks -= 1;
  const enemy = aliveEnemy(state, shot.enemyId);
  if (!enemy) {
    return false;
  }
  const dx = enemy.x - shot.x;
  const dz = enemy.z - shot.z;
  const distance = Math.hypot(dx, dz);
  const stride = perTick(SHOTS.speed);
  if (distance <= stride + enemy.size * SHOTS.sizeShare) {
    hitEnemy(state, unitById(state, shot.unitId), enemy, shot.multiplier, events);
    if (shot.crippling) {
      enemy.slowTicks = TICKS.slow;
      interruptBoss(state, enemy, events);
    }
    return false;
  }
  shot.x += (dx / distance) * stride;
  shot.z += (dz / distance) * stride;
  return shot.ticks > 0;
}

/** Moves one monster's shot. Returns whether it is still flying. */
function updateEnemyShot(state: GameState, shot: EnemyShot, events: GameEvent[]): boolean {
  shot.ticks -= 1;
  shot.x += perTick(shot.speedX);
  shot.z += perTick(shot.speedZ);
  const unit = livingUnits(state).find(({ x, z }) => {
    return Math.hypot(x - shot.x, z - shot.z) < SPITTER.shotHitRadius;
  });
  if (unit) {
    hurtUnit(state, unit, shot.damage, { id: shot.sourceId, ar: shot.sourceAr }, events);
    return false;
  }
  return shot.ticks > 0;
}

export function updateShots(state: GameState, events: GameEvent[]): void {
  state.live.shots = state.live.shots.filter((shot) => updateShot(state, shot, events));
  state.live.enemyShots = state.live.enemyShots.filter((shot) => updateEnemyShot(state, shot, events));
}

function volleyStrike(state: GameState, strike: ScheduledStrike, events: GameEvent[]): void {
  const { radius, sizeShare, multiplier } = SPELLS.volley;
  for (const enemy of state.live.enemies) {
    const reach = radius + enemy.size * sizeShare;
    if (enemy.alive && Math.hypot(enemy.x - strike.x, enemy.z - strike.z) < reach) {
      hitEnemy(state, unitById(state, strike.unitId), enemy, multiplier, events);
    }
  }
}

/** A slam lands where it was drawn, unless what made it is gone. */
function landSlam(state: GameState, slam: SlamTelegraph, events: GameEvent[]): void {
  const enemy = aliveEnemy(state, slam.enemyId);
  if (!enemy) {
    return;
  }
  for (const unit of livingUnits(state)) {
    if (Math.hypot(unit.x - slam.x, unit.z - slam.z) < slam.hitRadius) {
      hurtUnit(state, unit, slam.damage, enemy, events);
    }
  }
}

/** Counts down delayed effects, and runs those that are due. */
export function updateScheduled(state: GameState, events: GameEvent[]): void {
  for (const entry of state.live.scheduled) {
    entry.ticks -= 1;
  }
  const due = state.live.scheduled.filter((entry) => entry.ticks <= 0);
  state.live.scheduled = state.live.scheduled.filter((entry) => entry.ticks > 0);
  for (const entry of due) {
    switch (entry.kind) {
      case 'volley-strike':
        volleyStrike(state, entry, events);
        break;
      case 'slam':
        landSlam(state, entry, events);
        break;
      case 'charge':
        startCharge(state, entry);
        break;
    }
  }
}
