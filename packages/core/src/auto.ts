import { AUTO } from '../data/bots';
import { classOf } from './family';
import type { AutoResult, AutoStop, Command, GameView, Point } from './state';
import { TICKS } from './time';

type LivingUnits = GameView['bodies'][number][];

export function livingIn(view: GameView): LivingUnits {
  return view.bodies.filter((unit) => unit.alive);
}

export function centreIn(units: LivingUnits): Point {
  const x = units.reduce((sum, unit) => sum + unit.x, 0);
  const z = units.reduce((sum, unit) => sum + unit.z, 0);
  return { x: x / units.length, z: z / units.length };
}

/** The lowest share of health among the living. */
export function lowestShare(units: LivingUnits): number {
  return Math.min(...units.map((unit) => unit.health / unit.maxHealth));
}

/** Whether the zone that runs holds a living boss, whose arena is at the zone's centre. */
function hasArena(view: GameView): boolean {
  return view.live.enemies.some((enemy) => enemy.boss && enemy.alive);
}

/** A straight line through the boss's arena would wake it, so the path swings round. */
function aroundArena(view: GameView, from: Point, to: Point): Point {
  const { arenaRadius, detourRadius } = AUTO;
  if (!hasArena(view) || Math.hypot(to.x, to.z) <= arenaRadius) {
    return to;
  }
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const lengthSquared = dx * dx + dz * dz || 1;
  const along = -(from.x * dx + from.z * dz) / lengthSquared;
  const share = Math.min(1, Math.max(0, along));
  const x = from.x + dx * share;
  const z = from.z + dz * share;
  if (Math.hypot(x, z) > arenaRadius) {
    return to;
  }
  const angle = Math.atan2(z, x);
  return { x: Math.cos(angle) * detourRadius, z: Math.sin(angle) * detourRadius };
}

/** Sends everyone alive to a point, swinging round the arena. */
export function moveAll(view: GameView, to: Point, attack: boolean): Command {
  const units = livingIn(view);
  const { x, z } = aroundArena(view, centreIn(units), to);
  return { type: 'move', unitIds: units.map((unit) => unit.id), x, z, attack };
}

export function nearest(from: Point, points: readonly Point[]): Point | null {
  let best: Point | null = null;
  let bestDistance = Infinity;
  for (const point of points) {
    const distance = Math.hypot(point.x - from.x, point.z - from.z);
    if (distance < bestDistance) {
      best = point;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * What the squad does next in the zone that runs: `busy` while it is fighting or walking,
 * the next point to attack-move to, or null with nothing left to fight or fetch.
 */
export function roam(view: GameView): Point | 'busy' | null {
  const units = livingIn(view);
  const centre = centreIn(units);
  const monsters = view.live.enemies.filter((enemy) => enemy.alive && !enemy.boss);
  const fighting = units.some(({ id, x, z }) => {
    const { autoHeals, aggroRange } = classOf(view, id);
    return (
      !autoHeals &&
      monsters.some((enemy) => {
        return enemy.awake && Math.hypot(enemy.x - x, enemy.z - z) - enemy.size < aggroRange;
      })
    );
  });
  if (fighting || units.some((unit) => unit.dest)) {
    return 'busy';
  }
  const arena = hasArena(view);
  const drops = view.live.drops.filter((drop) => {
    const clear = !arena || Math.hypot(drop.x, drop.z) > AUTO.dropClearOfCentre;
    return drop.ageTicks < TICKS.dropLife && clear;
  });
  return nearest(centre, drops) ?? nearest(centre, monsters);
}

function autoStop(view: GameView): AutoStop | null {
  if (view.victory) {
    return 'victory';
  }
  if (view.squadDown) {
    return 'squad-down';
  }
  if (lowestShare(livingIn(view)) < AUTO.dangerBelow && view.family.potions === 0) {
    return 'danger';
  }
  return null;
}

/**
 * With the boss awake, auto-combat fights it rather than stopping (D-036). Characters
 * with no fight and no walk of their own are sent at the boss; the rest carry on.
 */
function fightBoss(view: GameView, bossId: number): Command | null {
  const idle = livingIn(view).filter((unit) => unit.targetId === null && unit.dest === null);
  return idle.length > 0 ? { type: 'target', unitIds: idle.map(({ id }) => id), enemyId: bossId } : null;
}

function drink(view: GameView, named: boolean): Command[] {
  const units = livingIn(view);
  const low = lowestShare(units) < AUTO.potionBelow;
  if (!low || view.family.potions === 0 || view.potionCooldownTicks > 0) {
    return [];
  }
  const lowest = units.reduce((a, b) => (b.health / b.maxHealth < a.health / a.maxHealth ? b : a));
  return [named ? { type: 'potion', unitId: lowest.id } : { type: 'potion' }];
}

/**
 * Space: roam the zone, killing and looting, and stop for danger (D-007). With the
 * boss awake it fights the boss (D-036). Given unit IDs, it runs only those characters,
 * and the rest stay the player's (D-035).
 */
export function autoCommands(whole: GameView, unitIds?: readonly number[]): AutoResult {
  const view = unitIds ? { ...whole, bodies: whole.bodies.filter(({ id }) => unitIds.includes(id)) } : whole;
  if (livingIn(view).length === 0) {
    return { commands: [], stop: 'squad-down' };
  }
  const stop = autoStop(view);
  if (stop || view.tick % TICKS.autoThink !== 0) {
    return { commands: [], stop };
  }
  const boss = view.live.enemies.find((enemy) => enemy.boss && enemy.awake && enemy.alive);
  if (boss) {
    const attack = fightBoss(view, boss.id);
    const commands = drink(view, unitIds !== undefined);
    return { commands: attack ? [...commands, attack] : commands, stop: null };
  }
  const next = roam(view);
  if (!next) {
    return { commands: [], stop: 'clear' };
  }
  const commands = drink(view, unitIds !== undefined);
  return { commands: next === 'busy' ? commands : [...commands, moveAll(view, next, true)], stop };
}
