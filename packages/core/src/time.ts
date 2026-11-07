import { AUTO_HEAL, COMBAT, POTIONS, SHOTS } from '../data/combat';
import { DUMMY } from '../data/enemies';
import { MOVEMENT, SCATTER } from '../data/movement';
import { ROUNDING_SLACK, TICK_RATE } from '../data/sim';
import { SPELLS } from '../data/spells';

/** Rounds up, so a timer never runs shorter than its data says. */
export function secondsToTicks(seconds: number): number {
  return Math.max(Math.ceil(seconds * TICK_RATE - ROUNDING_SLACK), 0);
}

/** Each timing, converted once. These never change. */
export const TICKS = {
  giveUp: secondsToTicks(MOVEMENT.giveUpSeconds),
  scatterCooldown: secondsToTicks(SCATTER.cooldownSeconds),
  dash: secondsToTicks(SCATTER.dashSeconds),
  invulnerable: secondsToTicks(SCATTER.invulnerableSeconds),
  hitInvulnerable: secondsToTicks(COMBAT.hitInvulnerableSeconds),
  reviveInvulnerable: secondsToTicks(SPELLS.revive.invulnerableSeconds),
  shotLife: secondsToTicks(SHOTS.lifeSeconds),
  autoHeal: secondsToTicks(AUTO_HEAL.seconds),
  potionCooldown: secondsToTicks(POTIONS.cooldownSeconds),
  dummyStrike: secondsToTicks(DUMMY.strikeSeconds),
  dummyRespawn: secondsToTicks(DUMMY.respawnSeconds),
  taunt: secondsToTicks(SPELLS.taunt.seconds),
  guard: secondsToTicks(SPELLS.guard.seconds),
  slow: secondsToTicks(SPELLS['crippling-shot'].slowSeconds),
  rally: secondsToTicks(SPELLS.rally.seconds),
};

/** Turns a per-second value into a per-tick one. */
export function perTick(perSecond: number): number {
  return perSecond / TICK_RATE;
}

/** Share of knockback left after one tick. */
export const KNOCKBACK_LEFT_PER_TICK = Math.pow(COMBAT.knockbackLeftPerSecond, 1 / TICK_RATE);
