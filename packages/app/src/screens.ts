import { characterOf, TICK_RATE, upgradeOffer, type GameEvent, type GameView, type GearSlot } from '@new-frontier/core';
import { characterLook, itemName } from '@new-frontier/render';
import { anvilRows } from './anvil';
import { KEY_LIST } from './hud';
import type { RunTally } from './reactions';

const SECONDS_IN_MINUTE = 60;
const ODDS_PLACES = 6;

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

/** The start screen: what the game is, the keys, and Start. */
export function showStart(onStart: () => void): void {
  const keys = element('keyList');
  keys.replaceChildren(
    ...KEY_LIST.map(([key, action]) => {
      const row = make('div');
      row.append(make('kbd', '', key), make('span', '', action));
      return row;
    }),
  );
  const button = element<HTMLButtonElement>('go');
  button.addEventListener('click', () => {
    element('start').hidden = true;
    onStart();
  });
  element('start').hidden = false;
  button.focus();
}

/** What an upgrade did, for the anvil's result box, as the squad test wrote it. */
export function upgradeResult(
  view: GameView,
  unitId: number,
  slot: GearSlot,
  chance: number,
  events: readonly GameEvent[],
  before: string | null,
): string {
  const unit = view.family.characters.find(({ id }) => id === unitId);
  if (!unit) return '';
  const who = unit.name;
  const rate = `Success Rate: ${chance.toFixed(ODDS_PLACES)}`;
  for (const event of events) {
    if (event.type === 'upgraded') return `${rate}\n${who}'s ${itemName(before ?? '')} is now +${event.level}.`;
    if (event.type === 'item-destroyed') {
      const spare = unit.items[slot];
      const handed = spare ? ` The smith hands over a ${itemName(spare.typeId)}.` : '';
      return `${rate}\n${who}'s ${itemName(before ?? '', event.level)} shatters on the anvil.${handed}`;
    }
    if (event.type === 'order-refused') return event.reason === 'no-marks' ? 'Not enough marks.' : 'The anvil is out of reach.';
  }
  return '';
}

/**
 * The anvil (S2.3b decisions 4 and 5). It shows whatever slots each character's gear
 * holds, and buys through `upgrade`, which sends a command while the game is paused.
 */
export class Anvil {
  private readonly modal = element('forge');
  private readonly box = element('forgeBox');
  private result = '';
  private view: GameView | null = null;

  private readonly upgrade: (unitId: number, slot: GearSlot) => string;
  private readonly close: () => void;

  constructor(upgrade: (unitId: number, slot: GearSlot) => string, close: () => void) {
    this.upgrade = upgrade;
    this.close = close;
    this.box.addEventListener('click', (event) => {
      const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!target || target.disabled) return;
      if (target.dataset.unit !== undefined && target.dataset.slot !== undefined) {
        this.result = this.upgrade(Number(target.dataset.unit), target.dataset.slot as GearSlot);
        if (this.view) this.draw(this.view);
      } else if (target.dataset.back !== undefined) {
        this.close();
      }
    });
  }

  get open(): boolean {
    return !this.modal.hidden;
  }

  show(view: GameView): void {
    this.result = '';
    this.modal.hidden = false;
    this.draw(view);
  }

  hide(): void {
    this.modal.hidden = true;
    this.result = '';
  }

  private draw(view: GameView): void {
    this.view = view;
    const head = make('div', 'mhead');
    head.append(make('h3', '', 'The anvil'), make('span', 'money', `${Math.round(view.family.marks).toLocaleString('en-AU')} marks`));
    const blurb = make(
      'p',
      'dim',
      'Guaranteed up to +4. Past that each step halves your odds, and a miss destroys the item. The smith hands over a basic spare.',
    );
    const parts: HTMLElement[] = [head, blurb];
    if (this.result) parts.push(make('div', 'resbox', this.result));
    const columns = make('div', 'ucols');
    for (const unit of view.bodies) {
      const character = characterOf(view, unit.id);
      const column = make('div');
      column.append(make('h4', '', `${character.name}, ${characterLook(character.classId).name}`));
      for (const row of anvilRows(character, (slot) => upgradeOffer(view, unit.id, slot as GearSlot), view.family.marks)) {
        const button = make('button', 'urow') as HTMLButtonElement;
        button.type = 'button';
        if (row.offer) {
          button.dataset.unit = String(row.unitId);
          button.dataset.slot = row.slot;
          button.disabled = !row.affordable;
          button.append(make('em', '', row.offer.cost.toLocaleString('en-AU')));
        } else {
          button.disabled = true;
        }
        button.append(make('b', '', row.name), make('small', '', row.odds));
        column.append(button);
      }
      columns.append(column);
    }
    const buttons = make('div', 'btns');
    const back = make('button', 'btn', 'Back to the island') as HTMLButtonElement;
    back.type = 'button';
    back.dataset.back = '';
    buttons.append(back);
    parts.push(columns, buttons);
    this.box.replaceChildren(...parts);
  }
}

/** The victory screen, with the run's numbers and the squad test's four questions. */
export function showVictory(view: GameView, tally: RunTally): void {
  const seconds = Math.floor(view.tick / TICK_RATE);
  const minutes = Math.floor(seconds / SECONDS_IN_MINUTE);
  const box = element('endBox');
  const again = make('button', 'btn', 'Play again') as HTMLButtonElement;
  again.type = 'button';
  again.addEventListener('click', () => window.location.reload());
  const buttons = make('div', 'btns');
  buttons.append(again);
  box.replaceChildren(
    make('h1', '', 'Beacon lit'),
    make(
      'p',
      'dim',
      `${minutes} min ${seconds % SECONDS_IN_MINUTE} sec. Levels ${view.family.active.map((id) => characterOf(view, id).level).join(', ')}. ` +
        `Squad wipes ${tally.wipes}, characters down ${tally.downs}, revives ${tally.revives}, ` +
        `upgrades ${tally.upgrades}, items destroyed ${tally.destroyed}.`,
    ),
    make('h3', '', 'Your verdict'),
    make('p', '', 'Did you feel like you were commanding a team, or babysitting one?'),
    make('p', '', 'Did losing the Healer change how you played?'),
    make('p', '', 'Could you follow all three during the boss?'),
    make('p', '', 'Did the camera do what your hands expected?'),
    buttons,
  );
  element('end').hidden = false;
  again.focus();
}
