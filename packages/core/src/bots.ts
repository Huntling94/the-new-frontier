import { BOTS } from '../data/bots';
import { SPELLS } from '../data/spells';
import { centreIn, livingIn, lowestShare, moveAll, roam } from './auto';
import { characterOf, classOf } from './family';
import { spellsKnown } from './items';
import type { BotKind, Command, GameView, Point, SpellId } from './state';
import { TICKS } from './time';
import { gateRoute, isNearSmith, npcOffering } from './npcs';
import { upgradeOffer } from './upgrades';

type EnemyView = GameView['live']['enemies'][number];

/** The first living character who knows the spell and has it ready (decision 5). */
function casterOf(view: GameView, spell: SpellId): number | null {
  const unit = view.bodies.find((candidate) => {
    const knows = candidate.alive && spellsKnown(characterOf(view, candidate.id)).includes(spell);
    return knows && (candidate.spellTicks[spell] ?? 0) === 0 && candidate.mana >= SPELLS[spell].mana;
  });
  return unit ? unit.id : null;
}

function cast(
  view: GameView,
  spell: SpellId,
  aim: { readonly point?: Point; readonly enemyId?: number } = {},
): Command[] {
  const unitId = casterOf(view, spell);
  return unitId === null ? [] : [{ type: 'cast', unitId, spell, ...aim }];
}

/** Heals and revives, which both bots do at any time. */
function sustain(view: GameView): Command[] {
  const low = lowestShare(livingIn(view));
  const someoneDown = view.bodies.some((unit) => !unit.alive);
  const canDrink = low < BOTS.potionBelow && view.family.potions > 0 && view.potionCooldownTicks === 0;
  return [
    ...(someoneDown ? cast(view, 'revive') : []),
    ...(low < BOTS.mendBelow ? cast(view, 'mend') : []),
    ...(canDrink ? [{ type: 'potion' } as const] : []),
  ];
}

/** The next upgrade on the list, by place in the three and slot, that the squad can afford. */
function nextUpgrade(view: GameView): Command | null {
  for (const { place, slot } of BOTS.upgrades) {
    const unitId = view.family.active[place];
    const item = unitId === undefined ? null : characterOf(view, unitId).items[slot];
    const offer = item ? upgradeOffer(view, item.id) : null;
    if (item && offer && item.upgrade < BOTS.upgradeBelow && view.family.marks >= offer.cost) {
      return { type: 'upgrade', itemId: item.id };
    }
  }
  return null;
}

/** One leg of a walk across zones: to the first gate on the route, then the zone's own A* (S3e decision 13). */
function towardsZone(view: GameView, wanted: Parameters<typeof gateRoute>[1]): Command[] {
  const [gate] = gateRoute(view.zoneId, wanted) ?? [];
  return gate ? [moveAll(view, gate.area, false)] : [];
}

/** To the smith if one stands here, or else along the gates to a town that has one. */
function towardsSmith(view: GameView): Command[] {
  const smith = npcOffering(view, 'smith');
  return smith
    ? [moveAll(view, smith.at, false)]
    : towardsZone(view, ({ npcs }) => npcs.some(({ services }) => services.includes('smith')));
}

/** With the zone clear: to the smith while there is money, and then the boss. */
function headForBoss(view: GameView): Command[] {
  const upgrade = nextUpgrade(view);
  if (upgrade && isNearSmith(view)) {
    return [upgrade];
  }
  const units = livingIn(view);
  if (units.some((unit) => unit.dest)) {
    return [];
  }
  if (upgrade) {
    return towardsSmith(view);
  }
  const centre = centreIn(units);
  const { bossStart, bossApproach } = BOTS;
  return [moveAll(view, centre.z > bossStart.z ? bossStart : bossApproach, false)];
}

/** In a zone with no boss, such as town: spend what there is at the smith, then walk back to the boss's zone. */
function travelLayer(view: GameView): Command[] {
  const upgrade = nextUpgrade(view);
  if (upgrade && isNearSmith(view)) {
    return [upgrade];
  }
  if (livingIn(view).some((unit) => unit.dest)) {
    return [];
  }
  return upgrade ? towardsSmith(view) : towardsZone(view, ({ id }) => id === BOTS.fightZone);
}

function roamLayer(view: GameView): Command[] {
  const next = roam(view);
  if (next === 'busy') {
    return [];
  }
  return next ? [moveAll(view, next, true)] : headForBoss(view);
}

/** The careful bot leaves a slam before it lands, and regroups once it has. */
function dodge(view: GameView): Command[] {
  const units = livingIn(view);
  const centre = centreIn(units);
  const danger = view.live.scheduled.some((entry) => {
    return (
      entry.kind === 'slam' &&
      entry.ticks < entry.totalTicks * (1 - BOTS.dodgeAfterShare) &&
      entry.radius < BOTS.dodgeSmallerThan &&
      Math.hypot(entry.x - centre.x, entry.z - centre.z) < entry.radius
    );
  });
  if (danger && view.scatterCooldownTicks === 0) {
    return [{ type: 'scatter' }];
  }
  const settled = view.scatterCooldownTicks <= TICKS.scatterCooldown - TICKS.scatterRegroup;
  return settled && units.some((unit) => unit.hold) ? [{ type: 'regroup' }] : [];
}

/** The careful bot sends all but its healers at any minion, which are after the healer. */
function focusMinion(view: GameView): Command[] {
  const minion = view.live.enemies.find((enemy) => enemy.minion && enemy.alive);
  if (!minion) {
    return [];
  }
  const unitIds = livingIn(view)
    .filter((unit) => !classOf(view, unit.id).autoHeals && unit.targetId !== minion.id)
    .map((unit) => unit.id);
  return unitIds.length > 0 ? [{ type: 'target', unitIds, enemyId: minion.id }] : [];
}

function carefulLayer(view: GameView, boss: EnemyView): Command[] {
  const casting = (boss.boss?.castTicks ?? 0) > 0;
  const aiming = boss.boss?.phase === 'aiming' && boss.boss.lastMove === 'charge';
  return [
    ...dodge(view),
    ...(casting ? cast(view, 'crippling-shot', { enemyId: boss.id }) : []),
    ...focusMinion(view),
    ...(aiming ? cast(view, 'taunt') : []),
    ...cast(view, 'cleave'),
    ...cast(view, 'guard'),
  ];
}

/** Both bots spend their damage on the boss. Only the careful one plays its moves. */
function bossLayer(view: GameView, kind: BotKind, boss: EnemyView): Command[] {
  return [
    ...(kind === 'careful' ? carefulLayer(view, boss) : []),
    ...sustain(view),
    ...cast(view, 'aimed-shot', { enemyId: boss.id }),
    ...cast(view, 'volley', { point: { x: boss.x, z: boss.z } }),
    ...cast(view, 'rally'),
  ];
}

/** A player that acts only through commands (S2.2c). Roams as auto-combat does, then fights. */
export function botCommands(view: GameView, kind: BotKind): Command[] {
  if (view.tick % TICKS.botThink !== 0 || view.squadDown || view.victory) {
    return [];
  }
  const boss = view.live.enemies.find((enemy) => enemy.boss);
  if (!boss) {
    return [...sustain(view), ...travelLayer(view)];
  }
  return boss.awake
    ? bossLayer(view, kind, boss)
    : [...sustain(view), ...roamLayer(view)];
}
