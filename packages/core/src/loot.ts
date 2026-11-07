import { LOOT, MONSTERS } from '../data/enemies';
import { TAU } from './island';
import { nextRandom, randomBetween } from './random';
import type { Drop, Enemy, GameEvent, GameState, Unit } from './state';
import { TICKS, perTick } from './time';

function dropAt(state: GameState, enemy: Enemy, kind: Drop['kind'], value: number): void {
  const id = state.nextId;
  state.nextId += 1;
  const angle = randomBetween(state, 0, TAU);
  const speed = randomBetween(state, LOOT.leastFlightSpeed, LOOT.mostFlightSpeed);
  state.drops.push({
    id,
    kind,
    value,
    x: enemy.x,
    z: enemy.z,
    speedX: Math.cos(angle) * speed,
    speedZ: Math.sin(angle) * speed,
    flightTicks: TICKS.dropFlight,
    ageTicks: 0,
  });
}

/** A monster leaves coins, and sometimes a potion. The dummy and the boss leave nothing. */
export function dropLoot(state: GameState, enemy: Enemy): void {
  if (enemy.kind === 'dummy' || enemy.kind === 'boss') {
    return;
  }
  const { least, most } = MONSTERS[enemy.kind].coins;
  const coins = least + Math.floor(nextRandom(state) * (most - least + 1));
  const value = LOOT.coinBase + enemy.level * LOOT.coinPerLevel;
  for (let coin = 0; coin < coins; coin += 1) {
    dropAt(state, enemy, 'marks', value);
  }
  if (nextRandom(state) < LOOT.potionChance) {
    dropAt(state, enemy, 'potion', 1);
  }
}

function nearestUnit(state: GameState, drop: Drop): { unit: Unit; distance: number } | null {
  let best: { unit: Unit; distance: number } | null = null;
  for (const unit of state.units) {
    const distance = Math.hypot(unit.x - drop.x, unit.z - drop.z);
    if (unit.alive && distance < (best?.distance ?? LOOT.pullRange)) {
      best = { unit, distance };
    }
  }
  return best;
}

/** Moves one drop. Returns whether it is still in the world. */
function updateDrop(state: GameState, drop: Drop, events: GameEvent[]): boolean {
  drop.ageTicks += 1;
  if (drop.flightTicks > 0) {
    drop.flightTicks -= 1;
    drop.x += perTick(drop.speedX);
    drop.z += perTick(drop.speedZ);
    return true;
  }
  const near = nearestUnit(state, drop);
  if (!near) {
    return true;
  }
  const { unit, distance } = near;
  if (distance < LOOT.collectRange) {
    if (drop.kind === 'marks') {
      state.marks += drop.value;
    } else {
      state.potions += drop.value;
    }
    const { tick } = state;
    events.push({ type: 'loot', tick, unitId: unit.id, kind: drop.kind, value: drop.value });
    return false;
  }
  drop.x += ((unit.x - drop.x) / distance) * perTick(LOOT.pullSpeed);
  drop.z += ((unit.z - drop.z) / distance) * perTick(LOOT.pullSpeed);
  return true;
}

export function updateDrops(state: GameState, events: GameEvent[]): void {
  state.drops = state.drops.filter((drop) => updateDrop(state, drop, events));
}
