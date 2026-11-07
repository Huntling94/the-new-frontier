import { SHOTS } from '../data/combat';
import { DUMMY } from '../data/enemies';
import { SPELLS } from '../data/spells';
import { aliveEnemy, hitEnemy } from './combat';
import type { Enemy, GameEvent, GameState, ScheduledStrike, Shot, Unit } from './state';
import { TICKS, perTick } from './time';

export function fireShot(
  state: GameState,
  unit: Unit,
  enemy: Enemy,
  multiplier: number,
  crippling: boolean,
): void {
  state.shots.push({
    x: unit.x,
    z: unit.z,
    unitId: unit.id,
    enemyId: enemy.id,
    multiplier,
    crippling,
    ticks: TICKS.shotLife,
  });
}

function unitById(state: GameState, id: number): Unit {
  const unit = state.units.find((candidate) => candidate.id === id);
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
  if (distance <= stride + DUMMY.size * SHOTS.sizeShare) {
    hitEnemy(state, unitById(state, shot.unitId), enemy, shot.multiplier, events);
    if (shot.crippling) {
      enemy.slowTicks = TICKS.slow;
    }
    return false;
  }
  shot.x += (dx / distance) * stride;
  shot.z += (dz / distance) * stride;
  return shot.ticks > 0;
}

export function updateShots(state: GameState, events: GameEvent[]): void {
  state.shots = state.shots.filter((shot) => updateShot(state, shot, events));
}

function volleyStrike(state: GameState, strike: ScheduledStrike, events: GameEvent[]): void {
  const { radius, sizeShare, multiplier } = SPELLS.volley;
  for (const enemy of state.enemies) {
    const reach = radius + DUMMY.size * sizeShare;
    if (enemy.alive && Math.hypot(enemy.x - strike.x, enemy.z - strike.z) < reach) {
      hitEnemy(state, unitById(state, strike.unitId), enemy, multiplier, events);
    }
  }
}

/** Counts down delayed effects, and runs those that are due. */
export function updateScheduled(state: GameState, events: GameEvent[]): void {
  for (const entry of state.scheduled) {
    entry.ticks -= 1;
  }
  const due = state.scheduled.filter((entry) => entry.ticks <= 0);
  state.scheduled = state.scheduled.filter((entry) => entry.ticks > 0);
  for (const entry of due) {
    switch (entry.kind) {
      case 'volley-strike':
        volleyStrike(state, entry, events);
        break;
    }
  }
}
