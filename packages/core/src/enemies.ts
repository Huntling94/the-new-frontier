import { DUMMY } from '../data/enemies';
import { hurtUnit } from './combat';
import type { Enemy, GameEvent, GameState, Point, Unit } from './state';
import { KNOCKBACK_LEFT_PER_TICK, TICKS } from './time';

export function createDummy(state: GameState, point: Point): Enemy {
  const id = state.nextId;
  state.nextId += 1;
  return {
    id,
    kind: 'dummy',
    alive: true,
    x: point.x,
    z: point.z,
    health: DUMMY.health,
    maxHealth: DUMMY.health,
    strikeTicks: TICKS.dummyStrike,
    respawnTicks: 0,
    tauntTicks: 0,
    slowTicks: 0,
    knockX: 0,
    knockZ: 0,
    staggerTicks: 0,
  };
}

function nearestInReach(state: GameState, enemy: Enemy): Unit | null {
  let best: Unit | null = null;
  let bestDistance = DUMMY.reach;
  for (const unit of state.units) {
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

/** One tick of one enemy. The dummy stands still and strikes on a timer. */
export function updateEnemy(state: GameState, enemy: Enemy, events: GameEvent[]): void {
  if (!enemy.alive) {
    enemy.respawnTicks -= 1;
    if (enemy.respawnTicks <= 0) {
      respawn(enemy);
    }
    return;
  }
  enemy.tauntTicks = Math.max(0, enemy.tauntTicks - 1);
  enemy.slowTicks = Math.max(0, enemy.slowTicks - 1);
  enemy.staggerTicks = Math.max(0, enemy.staggerTicks - 1);
  enemy.strikeTicks = Math.max(0, enemy.strikeTicks - 1);
  enemy.knockX *= KNOCKBACK_LEFT_PER_TICK;
  enemy.knockZ *= KNOCKBACK_LEFT_PER_TICK;
  const unit = nearestInReach(state, enemy);
  if (unit && enemy.strikeTicks === 0) {
    enemy.strikeTicks = TICKS.dummyStrike;
    hurtUnit(state, unit, DUMMY.attack, enemy, events);
  }
}
