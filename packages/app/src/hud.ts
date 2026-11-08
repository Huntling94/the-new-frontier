import {
  cardOf,
  characterOf,
  currentZone,
  isNearSmith,
  npcOffering,
  spellInfo,
  spellsOf,
  TICK_RATE,
  type GameView,
  type SpellId,
} from '@new-frontier/core';
import { characterLook, monsterLook, spellName, zoneLook } from '@new-frontier/render';
import { spellKey } from './controls';
import type { Banner, LogLine } from './reactions';

const LOG_LINES = 7;
const SECONDS_IN_MINUTE = 60;
/** The HUD redraws this often, as in the squad test, rather than every frame. */
export const HUD_SECONDS = 0.08;
/** The spell that interrupts a cast, named on the cast bar. */
const INTERRUPTER: SpellId = 'crippling-shot';

/** The keys and what they do, for the start screen and help (D-003, D-013, D-031, D-034, D-035). */
export const KEY_LIST: readonly (readonly [string, string])[] = [
  ['Right click ground', 'Move'],
  ['Right click enemy', 'Target'],
  ['Right click the smith', 'Upgrade and repair gear'],
  ['Right drag', 'Rotate and tilt'],
  ['Middle drag', 'Grip the camera'],
  ['Arrow keys', 'Move the camera'],
  [', and .', 'Rotate'],
  ['Backspace', 'Reset rotation'],
  ['Wheel', 'Zoom'],
  ['Ctrl + left click', 'Attack-move'],
  ['Space', 'Auto-combat for the selected'],
  ['F1 F2 F3 / left click', 'Select one'],
  ['Left drag', 'Box-select'],
  ['F4', 'Select all'],
  ['G', 'Regroup triangle'],
  ['QWER / ASDF / ZXCV', 'Spells, one row each'],
  ['B', 'Scatter'],
  ['Shift (hold)', 'Slow time'],
  ['5', 'Potion'],
  ['Home', 'Snap camera to squad'],
  ['Alt + E', 'Inventory'],
  ['H / N', 'Hide help / sound'],
];
/** Help shows the first of these during play, as the squad test did. */
const HELP_KEYS = 19;

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`The page has no #${id} element.`);
  return found as T;
}

const make = (tag: string, className = '', text = ''): HTMLElement => {
  const made = document.createElement(tag);
  if (className) made.className = className;
  if (text) made.textContent = text;
  return made;
};

const bar = (fill: string, thin = false): { box: HTMLElement; fill: HTMLElement } => {
  const box = make('div', thin ? 'bar thin' : 'bar');
  const inner = make('i', fill);
  box.append(inner);
  return { box, fill: inner };
};

/** Writes only what changed, so the browser does not restyle the HUD every frame. */
const setText = (target: HTMLElement, text: string): void => {
  if (target.textContent !== text) target.textContent = text;
};

const setHidden = (target: HTMLElement, hidden: boolean): void => {
  if (target.hidden !== hidden) target.hidden = hidden;
};

/** Bars scale rather than resize, which the browser can do without laying the page out again. */
const ROUNDING = 1000;
const scaled = (fill: HTMLElement, share: number, axis: 'X' | 'Y'): void => {
  const value = `scale${axis}(${Math.round(Math.min(Math.max(share, 0), 1) * ROUNDING) / ROUNDING})`;
  if (fill.style.transform !== value) fill.style.transform = value;
};

const width = (fill: HTMLElement, share: number): void => {
  scaled(fill, share, 'X');
};

interface Card {
  readonly id: number;
  readonly root: HTMLElement;
  readonly level: HTMLElement;
  readonly auto: HTMLElement;
  readonly health: HTMLElement;
  readonly mana: HTMLElement | null;
  readonly xp: HTMLElement;
  readonly spells: { readonly button: HTMLElement; readonly shade: HTMLElement; readonly spell: SpellId }[];
}

/** What the HUD reads besides the game, from the page. */
export interface HudInput {
  readonly selected: ReadonlySet<number>;
  readonly autoIds: ReadonlySet<number>;
  readonly slowMeter: number;
  readonly slowed: boolean;
  readonly paused: boolean;
}

/** The HUD (S2.3b). It reads the game and the page, and acts only through the handlers it is given. */
export class Hud {
  private readonly root = element('hud');
  private readonly cardsBox = element('cards');
  private readonly logBox = element('log');
  private readonly help = element('hint');
  private readonly prompt = element('prompt');
  private readonly slowEdge = element('slowTag');
  private readonly bossWrap = element('bossWrap');
  private readonly bossName = element('bossName');
  private readonly bossFill = element('bossFill');
  private readonly castWrap = element('castWrap');
  private readonly castText = element('castTxt');
  private readonly castFill = element('castFill');
  private readonly objective = element('obj');
  private readonly marks = element('marks');
  private readonly stock = element('stock');
  private readonly focus = element('focus');
  private readonly clock = element('clock');
  private readonly bannerBox = element('ban');
  private readonly bannerTitle = element('banT');
  private readonly bannerLine = element('banS');
  private cards: Card[] = [];
  private cardKey = '';
  private bannerLeft = 0;

  private readonly onSelect: (id: number) => void;
  private readonly onSpell: (place: number, slot: number) => void;

  constructor(onSelect: (id: number) => void, onSpell: (place: number, slot: number) => void) {
    this.onSelect = onSelect;
    this.onSpell = onSpell;
    this.help.replaceChildren(
      ...KEY_LIST.slice(0, HELP_KEYS).flatMap(([key, action], index) => [
        ...(index > 0 ? [make('br')] : []),
        make('kbd', '', key),
        document.createTextNode(` ${action}`),
      ]),
    );
    this.cardsBox.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const spell = target.closest<HTMLElement>('.sp');
      if (spell) {
        this.onSpell(Number(spell.dataset.place), Number(spell.dataset.slot));
        return;
      }
      const card = target.closest<HTMLElement>('.card');
      if (card) this.onSelect(Number(card.dataset.id));
    });
  }

  show(on: boolean): void {
    this.root.hidden = !on;
  }

  toggleHelp(): void {
    this.help.hidden = !this.help.hidden;
  }

  get helpShown(): boolean {
    return !this.help.hidden;
  }

  log(line: LogLine): void {
    const row = make('div', line.tone === 'plain' ? '' : line.tone, line.text);
    this.logBox.append(row);
    while (this.logBox.children.length > LOG_LINES) this.logBox.firstElementChild?.remove();
  }

  banner(banner: Banner): void {
    this.bannerTitle.textContent = banner.title;
    this.bannerLine.textContent = banner.line;
    this.bannerBox.classList.add('on');
    this.bannerLeft = banner.seconds;
  }

  /** Real seconds, so banners fade while paused too. */
  ageBanner(dt: number): void {
    if (this.bannerLeft <= 0) return;
    this.bannerLeft -= dt;
    if (this.bannerLeft <= 0) this.bannerBox.classList.remove('on');
  }

  /** One card per character in its place in the three, never one per class (S2.3b decision 6). */
  private buildCards(view: GameView): void {
    this.cards = view.bodies.map((unit, place) => {
      const { name, classId } = characterOf(view, unit.id);
      const look = characterLook(classId);
      const root = make('div', 'card');
      root.dataset.id = String(unit.id);
      const head = make('div', 'chead');
      const level = make('small');
      const auto = make('span', 'auto', 'AUTO');
      head.append(make('b', '', `F${place + 1} ${name}`), make('span', 'cls', look.name), auto, level);
      const health = bar('hpf');
      const card = cardOf(view, unit.id);
      const mana = card && card.maxMana > 0 ? bar('mpf', true) : null;
      const xp = bar('xpf', true);
      const grid = make('div', 'spells');
      const spells = spellsOf(view, unit.id).map((spell, slot) => {
        const button = make('button', 'sp');
        button.dataset.place = String(place);
        button.dataset.slot = String(slot);
        button.setAttribute('type', 'button');
        const shade = make('i');
        button.append(make('kbd', '', spellKey(place, slot) ?? ''), document.createTextNode(spellName(spell)), shade);
        grid.append(button);
        return { button, shade, spell };
      });
      grid.style.gridTemplateColumns = `repeat(${Math.max(spells.length, 1)}, minmax(0, 1fr))`;
      root.append(head, health.box, ...(mana ? [mana.box] : []), xp.box, grid);
      return { id: unit.id, root, level, auto, health: health.fill, mana: mana?.fill ?? null, xp: xp.fill, spells };
    });
    this.cardsBox.replaceChildren(...this.cards.map(({ root }) => root));
  }

  update(view: GameView, input: HudInput): void {
    const key = view.bodies.map(({ id }) => id).join();
    if (key !== this.cardKey) {
      this.cardKey = key;
      this.buildCards(view);
    }
    for (const card of this.cards) {
      const unit = view.bodies.find(({ id }) => id === card.id);
      if (!unit) continue;
      const info = cardOf(view, unit.id);
      card.root.classList.toggle('sel', input.selected.has(unit.id));
      card.root.classList.toggle('dead', !unit.alive);
      setHidden(card.auto, !input.autoIds.has(unit.id));
      card.root.classList.toggle('on-auto', input.autoIds.has(unit.id));
      setText(card.level, unit.alive && info ? `LV ${info.level}` : 'DOWN');
      width(card.health, unit.maxHealth > 0 ? unit.health / unit.maxHealth : 0);
      if (card.mana && info) width(card.mana, unit.mana / info.maxMana);
      if (info) width(card.xp, info.xp / info.xpToNext);
      for (const { button, shade, spell } of card.spells) {
        const { cooldownTicks, mana } = spellInfo(spell);
        const left = unit.spellTicks[spell] ?? 0;
        scaled(shade, cooldownTicks > 0 ? left / cooldownTicks : 0, 'Y');
        button.classList.toggle('ready', left === 0 && unit.alive && unit.mana >= mana);
      }
    }

    const zone = currentZone(view);
    const boss = view.live.enemies.find((enemy) => enemy.boss);
    const bossUp = boss?.awake === true && boss.alive && !view.victory;
    setHidden(this.bossWrap, !bossUp);
    if (boss && bossUp) {
      const look = monsterLook(boss.kind);
      setText(this.bossName, `${look.name}  (lvl ${boss.level})`);
      width(this.bossFill, boss.health / boss.maxHealth);
      const cast = boss.boss;
      const casting = cast !== null && cast.castTicks > 0;
      setHidden(this.castWrap, !casting);
      if (cast && casting) {
        width(this.castFill, 1 - cast.castTicks / Math.max(cast.castTotalTicks, 1));
        setText(this.castText, `${(look.castName ?? 'Cast').toUpperCase()}: ${this.interruptHint(view)}`);
      }
    }

    const left = view.live.enemies.filter((enemy) => enemy.alive && !enemy.boss && enemy.kind !== 'dummy').length;
    const title = zoneLook(zone.id).name;
    // Only a zone with a boss sends the squad on to the smith and the beacon.
    const then = boss ? ' Upgrade at the smith in Montclaire, then walk to the beacon.' : '';
    // A town has nothing to fight, so it points the way out (S3d decision 11).
    const out = zone.kind === 'town' ? zone.gates[0] : undefined;
    const goal = out
      ? `Head out to ${zoneLook(out.to).name}`
      : bossUp && boss
        ? `Defeat ${monsterLook(boss.kind).name}`
        : `${left} monsters about.${then}`;
    if (this.objective.dataset.text !== title + goal) {
      this.objective.dataset.text = title + goal;
      this.objective.replaceChildren(make('b', '', title), document.createTextNode(goal));
    }
    setText(this.marks, `${Math.round(view.family.marks).toLocaleString('en-AU')} marks`);
    setText(this.stock, `${view.family.potions} potions`);
    setText(this.focus, `slow ${input.slowMeter.toFixed(1)}s`);
    const seconds = Math.floor(view.tick / TICK_RATE);
    setText(this.clock, `${Math.floor(seconds / SECONDS_IN_MINUTE)}:${String(seconds % SECONDS_IN_MINUTE).padStart(2, '0')}`);
    setHidden(this.slowEdge, !input.slowed);
    const smith = npcOffering(view, 'smith');
    if (smith) setText(this.prompt, `Right click ${smith.name} to upgrade gear`);
    setHidden(this.prompt, input.paused || !isNearSmith(view) || view.victory);
  }

  /** Names the spell that interrupts, with its key, for whoever in the three has it. */
  private interruptHint(view: GameView): string {
    for (const [place, unit] of view.bodies.entries()) {
      const slot = spellsOf(view, unit.id).indexOf(INTERRUPTER);
      if (slot >= 0) return `interrupt with ${spellName(INTERRUPTER)} (${spellKey(place, slot) ?? '?'})`;
    }
    return 'interrupt it';
  }
}
