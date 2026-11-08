import type { GameEvent, GameView } from '@new-frontier/core';
import { monsterLook, zoneLook } from '@new-frontier/render';
import { FEEL } from './feel';
import type { SoundName } from './sound';

export type Tone = 'plain' | 'gold' | 'bad' | 'blue';

export interface LogLine {
  readonly text: string;
  readonly tone: Tone;
}

export interface Banner {
  readonly title: string;
  readonly line: string;
  readonly seconds: number;
}

/** What one tick's events mean for the screen and speakers. Nothing here touches the game. */
export interface Reaction {
  readonly sounds: SoundName[];
  readonly log: LogLine[];
  banner: Banner | null;
  shake: number;
  hitStop: boolean;
  victory: boolean;
}

/** Counts for the victory screen, as in the squad test. */
export interface RunTally {
  wipes: number;
  downs: number;
  revives: number;
  upgrades: number;
  broken: number;
}

const BANNER_SECONDS = 2.6;
const SHORT_BANNER = 1.4;

const SPELL_SOUNDS: Readonly<Record<string, SoundName>> = {
  taunt: 'boss',
  cleave: 'swing',
  guard: 'forge',
  'aimed-shot': 'shoot',
  'crippling-shot': 'shoot',
  volley: 'shoot',
  mend: 'potion',
  rally: 'level',
  revive: 'level',
};

/** Things a tick can change that no event reports, remembered just before it. */
interface Before {
  readonly slams: Set<object>;
  readonly charges: Set<object>;
  readonly casting: Map<number, number>;
  readonly enemyIds: Set<number>;
}

const nameOfUnit = (view: GameView, id: number): string => {
  const character = view.family.characters.find((candidate) => candidate.id === id);
  return character ? character.name : 'Someone';
};

/**
 * Turns a tick's events into sound, log lines, banners, shake and hit-stop,
 * as the squad test did inside its rules. The core's events say what happened;
 * this decides how it feels.
 */
export class Reactions {
  private before: Before | null = null;
  readonly tally: RunTally = { wipes: 0, downs: 0, revives: 0, upgrades: 0, broken: 0 };

  /** Call just before each tick. */
  remember(view: GameView): void {
    const slams = new Set<object>();
    const charges = new Set<object>();
    for (const effect of view.live.scheduled) {
      if (effect.kind === 'slam') slams.add(effect);
      if (effect.kind === 'charge') charges.add(effect);
    }
    const casting = new Map<number, number>();
    for (const enemy of view.live.enemies) {
      if (enemy.boss) casting.set(enemy.id, enemy.boss.castTicks);
    }
    this.before = { slams, charges, casting, enemyIds: new Set(view.live.enemies.map(({ id }) => id)) };
  }

  /** Call just after each tick, with its events. */
  react(view: GameView, events: readonly GameEvent[]): Reaction {
    const reaction: Reaction = { sounds: [], log: [], banner: null, shake: 0, hitStop: false, victory: false };
    const sound = (name: SoundName): void => {
      if (!reaction.sounds.includes(name)) reaction.sounds.push(name);
    };
    const shake = (strength: number): void => {
      reaction.shake = Math.max(reaction.shake, strength);
    };
    const say = (text: string, tone: Tone = 'plain'): void => {
      reaction.log.push({ text, tone });
    };
    const isUnit = (id: number): boolean => view.bodies.some((unit) => unit.id === id);
    const enemyOf = (id: number) => view.live.enemies.find((enemy) => enemy.id === id);
    let lastHitter: number | null = null;
    const interrupted = new Set<number>();

    for (const event of events) {
      switch (event.type) {
        case 'hit':
          if (isUnit(event.sourceId)) {
            if (event.crit) {
              sound('crit');
              reaction.hitStop = true;
            } else {
              sound('hit');
            }
          } else if (isUnit(event.targetId)) {
            sound('hurt');
            shake(FEEL.shake.hurt);
            lastHitter = event.sourceId;
            if (enemyOf(event.sourceId)?.kind === 'brute') sound('slam');
          }
          break;
        case 'spell-cast':
          sound(SPELL_SOUNDS[event.spell] ?? 'click');
          if (event.spell === 'guard') say(`${nameOfUnit(view, event.unitId)} guards`, 'blue');
          if (event.spell === 'rally') say('Rally: the squad hits harder', 'gold');
          break;
        case 'order-accepted':
          if (event.order === 'scatter') {
            sound('dash');
            say('Scatter!', 'blue');
          }
          if (event.order === 'regroup') say('Regroup: triangle');
          if (event.order === 'potion') sound('potion');
          break;
        case 'level-up':
          sound('level');
          say(`${nameOfUnit(view, event.unitId)} reached level ${event.level}`, 'gold');
          break;
        case 'loot':
          if (event.kind === 'marks') {
            sound('gold');
          } else {
            sound('pickup');
            say('Found a potion', 'blue');
          }
          break;
        case 'unit-down':
          this.tally.downs += 1;
          say(`${nameOfUnit(view, event.unitId)} is down. No XP while down.`, 'bad');
          break;
        case 'unit-revived':
          this.tally.revives += 1;
          sound('level');
          say(`${nameOfUnit(view, event.unitId)} revived`, 'gold');
          break;
        case 'squad-down': {
          this.tally.wipes += 1;
          sound('fail');
          const killer = lastHitter === null ? undefined : enemyOf(lastHitter);
          say(
            killer
              ? `You died to a ${monsterLook(killer.kind).name} (lvl ${killer.level}). You are being teleported back to: camp`
              : 'The squad is down. You are being teleported back to: camp',
            'bad',
          );
          reaction.banner = { title: 'Squad down', line: 'Back to camp. The boss resets.', seconds: BANNER_SECONDS };
          break;
        }
        case 'boss-woken': {
          const name = monsterLook(enemyOf(event.enemyId)?.kind ?? 'boss').name;
          sound('boss');
          shake(FEEL.shake.boss);
          say(`Encountered monster: ${name}`, 'bad');
          reaction.banner = { title: name, line: 'has woken', seconds: BANNER_SECONDS };
          break;
        }
        case 'interrupted': {
          interrupted.add(event.enemyId);
          const name = monsterLook(enemyOf(event.enemyId)?.kind ?? 'boss').name;
          sound('crit');
          shake(FEEL.shake.interrupt);
          reaction.banner = { title: 'Interrupted', line: `${name} staggers and takes more damage`, seconds: SHORT_BANNER };
          break;
        }
        case 'zone-changed':
          sound('click');
          say(`Entered ${zoneLook(event.to).name}`, 'blue');
          reaction.banner = { title: zoneLook(event.to).name, line: '', seconds: SHORT_BANNER };
          break;
        case 'victory':
          sound('beacon');
          reaction.victory = true;
          reaction.banner = { title: 'The beacon is lit', line: '', seconds: BANNER_SECONDS };
          break;
        default:
          break;
      }
    }

    this.bossMoves(view, reaction, interrupted, sound, shake, say);
    return reaction;
  }

  /** Boss moves the core reports only through its state: slams, charges, casts and summons. */
  private bossMoves(
    view: GameView,
    reaction: Reaction,
    interrupted: ReadonlySet<number>,
    sound: (name: SoundName) => void,
    shake: (strength: number) => void,
    say: (text: string, tone?: Tone) => void,
  ): void {
    const before = this.before;
    if (!before) return;
    const slamsNow = new Set<object>();
    let newSlams = false;
    let newCharge = false;
    for (const effect of view.live.scheduled) {
      if (effect.kind === 'slam') {
        slamsNow.add(effect);
        if (!before.slams.has(effect)) newSlams = true;
      }
      if (effect.kind === 'charge' && !before.charges.has(effect)) newCharge = true;
    }
    // A slam lands when its record leaves with its time run out; a reset removes it early.
    for (const slam of before.slams) {
      if (!slamsNow.has(slam) && (slam as { ticks: number }).ticks <= 0) {
        sound('slam');
        shake(FEEL.shake.slam);
      }
    }
    if (newSlams) say('The ground glows under the squad', 'bad');
    for (const enemy of view.live.enemies) {
      if (!enemy.boss) continue;
      const name = monsterLook(enemy.kind).name;
      if (newCharge) say(`${name} turns to charge`, 'bad');
      const was = before.casting.get(enemy.id) ?? 0;
      const now = enemy.boss.castTicks;
      if (was === 0 && now > 0) {
        sound('boss');
        say('Interrupt it before the cast lands', 'gold');
      }
      if (was > 0 && now === 0 && enemy.alive && !interrupted.has(enemy.id) && !reaction.victory) {
        sound('slam');
        shake(FEEL.shake.blast);
      }
    }
    const summoned = view.live.enemies.filter((enemy) => enemy.minion && !before.enemyIds.has(enemy.id));
    const first = summoned[0];
    if (first) {
      sound('boss');
      const prey = first.preferId === null ? 'the squad' : `the ${nameOfUnit(view, first.preferId)}`;
      say(`${monsterLook(first.kind).name}s are after ${prey}. Focus them.`, 'bad');
    }
  }
}
