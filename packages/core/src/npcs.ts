import { NPC_TALK } from '../data/gear';
import { ZONES } from '../data/zones';
import { inFight } from './items';
import type { GameView, Point, RefusalReason } from './state';
import { zoneOf, type GateData, type NpcData, type ServiceId, type ZoneData } from './world';

/** Whether any living character in the active three stands within reach of a point. */
function withinReach(view: GameView, point: Point): boolean {
  return view.bodies.some((unit) => unit.alive && Math.hypot(unit.x - point.x, unit.z - point.z) < NPC_TALK.reach);
}

/** Who offers a service in the zone that runs, if anyone. */
export function npcOffering(view: GameView, service: ServiceId): NpcData | null {
  return zoneOf(view).npcs.find(({ services }) => services.includes(service)) ?? null;
}

/** Whether a living character in the active three can reach a smith in this zone. */
export function isNearSmith(view: GameView): boolean {
  const smith = npcOffering(view, 'smith');
  return smith !== null && withinReach(view, smith.at);
}

/**
 * Why the squad may not talk to an NPC in this zone now, or null if it may (D-044).
 * Talking is a read, not a command: it changes nothing until a service is used.
 */
export function whyNotTalk(view: GameView, npcId: string): RefusalReason | null {
  const npc = zoneOf(view).npcs.find(({ id }) => id === npcId);
  if (!npc) {
    return 'unknown-npc';
  }
  if (view.victory) {
    return 'run-over';
  }
  if (inFight(view)) {
    return 'in-fight';
  }
  return withinReach(view, npc.at) ? null : 'not-near-npc';
}

/**
 * The gates to walk through, in order, from one zone to the nearest zone that passes
 * `wanted`, by breadth-first search over gates (S3e decision 13). Empty if `from`
 * already passes, and null if none can be reached.
 */
export function gateRoute(
  from: string,
  wanted: (zone: ZoneData) => boolean,
  zones: readonly ZoneData[] = ZONES,
): readonly GateData[] | null {
  const routes = new Map<string, readonly GateData[]>([[from, []]]);
  const queue = [from];
  for (let head = 0; head < queue.length; head += 1) {
    const id = queue[head];
    const zone = zones.find((candidate) => candidate.id === id);
    const route = id === undefined ? undefined : routes.get(id);
    if (!zone || !route) {
      continue;
    }
    if (wanted(zone)) {
      return route;
    }
    for (const gate of zone.gates) {
      if (!routes.has(gate.to)) {
        routes.set(gate.to, [...route, gate]);
        queue.push(gate.to);
      }
    }
  }
  return null;
}
