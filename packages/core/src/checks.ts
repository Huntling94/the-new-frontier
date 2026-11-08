import { isOpen } from './grid';
import type { GameView } from './state';
import { gridFor, type ZoneData } from './world';

/**
 * Rules about the world that must always hold, checked against the data
 * (`docs/DATA-MODEL.md`, decision 12). Each returns what is wrong, so a test can
 * list every problem at once, and an empty list means the rule holds.
 */

/** Every zone can be reached from the start, by breadth-first search over gates. */
export function unreachableZones(zones: readonly ZoneData[], start: string): string[] {
  const ids = new Set(zones.map(({ id }) => id));
  const reached = new Set([start]);
  const queue = [start];
  for (let head = 0; head < queue.length; head += 1) {
    const zone = zones.find(({ id }) => id === queue[head]);
    for (const gate of zone?.gates ?? []) {
      if (ids.has(gate.to) && !reached.has(gate.to)) {
        reached.add(gate.to);
        queue.push(gate.to);
      }
    }
  }
  const problems = zones.filter(({ id }) => !reached.has(id)).map(({ id }) => `${id} cannot be reached from ${start}`);
  for (const zone of zones) {
    for (const gate of zone.gates) {
      if (!ids.has(gate.to)) {
        problems.push(`${zone.id}'s gate ${gate.id} leads to ${gate.to}, which does not exist`);
      }
    }
  }
  return problems;
}

/** Every gate arrives on a walkable cell, and its own area can be walked into. */
export function badGates(zones: readonly ZoneData[]): string[] {
  const problems: string[] = [];
  for (const zone of zones) {
    for (const gate of zone.gates) {
      const there = zones.find(({ id }) => id === gate.to);
      if (there && !isOpen(gridFor(there), gate.arrival.x, gate.arrival.z)) {
        problems.push(`${zone.id}'s gate ${gate.id} arrives off walkable ground in ${there.id}`);
      }
      if (!isOpen(gridFor(zone), gate.area.x, gate.area.z)) {
        problems.push(`${zone.id}'s gate ${gate.id} has its middle off walkable ground`);
      }
    }
  }
  return problems;
}

/** Every pack and camp stands on a walkable cell. */
export function badPlacements(zones: readonly ZoneData[]): string[] {
  const problems: string[] = [];
  for (const zone of zones) {
    const grid = gridFor(zone);
    if (!isOpen(grid, zone.camp.x, zone.camp.z)) {
      problems.push(`${zone.id}'s camp is off walkable ground`);
    }
    zone.contents.packs.forEach((pack, index) => {
      if (!isOpen(grid, pack.x, pack.z)) {
        problems.push(`${zone.id}'s pack ${String(index)} is off walkable ground`);
      }
    });
  }
  return problems;
}

/** Nothing outside the live group names an enemy that is not in it, such as one from a closed zone. */
export function strayEnemyReferences(view: GameView): string[] {
  const live = new Set(view.live.enemies.map(({ id }) => id));
  const problems: string[] = [];
  if (view.sharedTargetId !== null && !live.has(view.sharedTargetId)) {
    problems.push(`the shared target ${String(view.sharedTargetId)} is not in the live group`);
  }
  for (const unit of view.bodies) {
    if (unit.targetId !== null && !live.has(unit.targetId)) {
      problems.push(`unit ${String(unit.id)} targets ${String(unit.targetId)}, which is not in the live group`);
    }
  }
  return problems;
}
