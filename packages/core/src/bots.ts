import { BOTS } from '../data/bots';
import { SPELLS } from '../data/spells';
import { ZONES } from '../data/zones';
import { centreIn, livingIn, lowestShare, moveAll, nearest, roam } from './auto';
import type { BotKind, ClassId, Command, GameView, Point, SpellId } from './state';
import { TICKS } from './time';
import { isNearAnvil, upgradeOffer } from './upgrades';

type EnemyView = GameView['enemies'][number];

/** The living unit of a class, if its spell is ready. */
function casterOf(view: GameView, classId: ClassId, spell: SpellId): number | null {
  const unit = view.units.find((candidate) => candidate.classId === classId && candidate.alive);
  const ready = unit && (unit.spellTicks[spell] ?? 0) === 0 && unit.mana >= SPELLS[spell].mana;
  return ready ? unit.id : null;
}

function cast(
  view: GameView,
  classId: ClassId,
  spell: SpellId,
  aim: { readonly point?: Point; readonly enemyId?: number } = {},
): Command[] {
  const unitId = casterOf(view, classId, spell);
  return unitId === null ? [] : [{ type: 'cast', unitId, spell, ...aim }];
}

/** Heals and revives, which both bots do at any time. */
function sustain(view: GameView): Command[] {
  const low = lowestShare(livingIn(view));
  const someoneDown = view.units.some((unit) => !unit.alive);
  const canDrink = low < BOTS.potionBelow && view.potions > 0 && view.potionCooldownTicks === 0;
  return [
    ...(someoneDown ? cast(view, 'healer', 'revive') : []),
    ...(low < BOTS.mendBelow ? cast(view, 'healer', 'mend') : []),
    ...(canDrink ? [{ type: 'potion' } as const] : []),
  ];
}

/** The next upgrade on the list that the squad can afford. */
function nextUpgrade(view: GameView): Command | null {
  for (const { classId, slot } of BOTS.upgrades) {
    const unit = view.units.find((candidate) => candidate.classId === classId);
    const offer = unit ? upgradeOffer(view, unit.id, slot) : null;
    const wanted = unit && unit.gear[slot].upgrade < BOTS.upgradeBelow;
    if (unit && offer && wanted && view.marks >= offer.cost) {
      return { type: 'upgrade', unitId: unit.id, slot };
    }
  }
  return null;
}

/** With the island clear: the anvil while there is money, and then the boss. */
function headForBoss(view: GameView): Command[] {
  const upgrade = nextUpgrade(view);
  if (upgrade && isNearAnvil(view)) {
    return [upgrade];
  }
  const units = livingIn(view);
  if (units.some((unit) => unit.dest)) {
    return [];
  }
  const centre = centreIn(units);
  const anvil = nearest(
    centre,
    ZONES.map((zone) => zone.anvil),
  );
  if (upgrade && anvil) {
    return [moveAll(view, anvil, false)];
  }
  const { bossStart, bossApproach } = BOTS;
  return [moveAll(view, centre.z > bossStart.z ? bossStart : bossApproach, false)];
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
  const danger = view.scheduled.some((entry) => {
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

/** The careful bot sends its fighters at any minion, which are after the Healer. */
function focusMinion(view: GameView): Command[] {
  const minion = view.enemies.find((enemy) => enemy.minion && enemy.alive);
  if (!minion) {
    return [];
  }
  const unitIds = livingIn(view)
    .filter((unit) => unit.classId !== 'healer' && unit.targetId !== minion.id)
    .map((unit) => unit.id);
  return unitIds.length > 0 ? [{ type: 'target', unitIds, enemyId: minion.id }] : [];
}

function carefulLayer(view: GameView, boss: EnemyView): Command[] {
  const casting = (boss.boss?.castTicks ?? 0) > 0;
  const aiming = boss.boss?.phase === 'aiming' && boss.boss.lastMove === 'charge';
  return [
    ...dodge(view),
    ...(casting ? cast(view, 'shooter', 'crippling-shot', { enemyId: boss.id }) : []),
    ...focusMinion(view),
    ...(aiming ? cast(view, 'fighter', 'taunt') : []),
    ...cast(view, 'fighter', 'cleave'),
    ...cast(view, 'fighter', 'guard'),
  ];
}

/** Both bots spend their damage on the boss. Only the careful one plays its moves. */
function bossLayer(view: GameView, kind: BotKind, boss: EnemyView): Command[] {
  return [
    ...(kind === 'careful' ? carefulLayer(view, boss) : []),
    ...sustain(view),
    ...cast(view, 'shooter', 'aimed-shot', { enemyId: boss.id }),
    ...cast(view, 'shooter', 'volley', { point: { x: boss.x, z: boss.z } }),
    ...cast(view, 'healer', 'rally'),
  ];
}

/** A player that acts only through commands (S2.2c). Roams as auto-combat does, then fights. */
export function botCommands(view: GameView, kind: BotKind): Command[] {
  const boss = view.enemies.find((enemy) => enemy.boss);
  if (view.tick % TICKS.botThink !== 0 || view.squadDown || view.victory || !boss) {
    return [];
  }
  return boss.awake
    ? bossLayer(view, kind, boss)
    : [...sustain(view), ...roamLayer(view)];
}
