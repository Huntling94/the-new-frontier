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

/** What the start screen offers (S3c decisions 7 and 8). */
export interface StartChoices {
  /** Continue's line, levels and when it was saved, if a save loads. */
  readonly continueInfo: string | null;
  /** A line above the buttons, such as why a save would not load. */
  readonly note: { readonly text: string; readonly warn: boolean } | null;
  /** Export and import show only where saving is on. */
  readonly saving: boolean;
  /** There is a save, loadable or not, to export. */
  readonly canExport: boolean;
}

export interface StartActions {
  readonly onContinue: () => void;
  readonly onNew: () => void;
  readonly onExport: () => void;
  readonly onImport: (file: File) => void;
}

/** The start screen: what the game is, the keys, Continue or Start, and saves (S3c). */
export class StartScreen {
  private readonly modal = element('start');
  private readonly go = element<HTMLButtonElement>('go');
  private readonly resume = element<HTMLButtonElement>('continue');
  private readonly resumeInfo = element('continueInfo');
  private readonly note = element('saveNote');
  private readonly tools = element('saveTools');
  private readonly exportButton = element<HTMLButtonElement>('exportSave');
  private readonly file = element<HTMLInputElement>('importFile');
  private readonly askBox = element('startAsk');
  private readonly askText = element('askText');
  private readonly askYes = element<HTMLButtonElement>('askYes');
  private readonly askNo = element<HTMLButtonElement>('askNo');
  private answer: ((yes: boolean) => void) | null = null;

  constructor(actions: StartActions) {
    element('keyList').replaceChildren(
      ...KEY_LIST.map(([key, action]) => {
        const row = make('div');
        row.append(make('kbd', '', key), make('span', '', action));
        return row;
      }),
    );
    this.go.addEventListener('click', () => actions.onNew());
    this.resume.addEventListener('click', () => actions.onContinue());
    this.exportButton.addEventListener('click', () => actions.onExport());
    element('importSave').addEventListener('click', () => this.file.click());
    this.file.addEventListener('change', () => {
      const [chosen] = this.file.files ?? [];
      this.file.value = '';
      if (chosen) actions.onImport(chosen);
    });
    this.askYes.addEventListener('click', () => this.settle(true));
    this.askNo.addEventListener('click', () => this.settle(false));
  }

  show(choices: StartChoices): void {
    this.settle(false);
    const saved = choices.continueInfo !== null;
    this.resume.hidden = !saved;
    this.resumeInfo.textContent = choices.continueInfo ?? '';
    this.go.textContent = saved || choices.canExport ? 'New game' : 'Start';
    this.say(choices.note?.text ?? null, choices.note?.warn ?? false);
    this.tools.hidden = !choices.saving;
    this.exportButton.disabled = !choices.canExport;
    this.modal.hidden = false;
    (saved ? this.resume : this.go).focus();
  }

  hide(): void {
    this.settle(false);
    this.modal.hidden = true;
  }

  /** A line above the buttons, in the warning colour if `warn`. */
  say(text: string | null, warn = false): void {
    this.note.hidden = text === null;
    this.note.textContent = text ?? '';
    this.note.classList.toggle('warn', warn);
  }

  /** Asks before replacing a save, on the screen itself. Resolves to the answer. */
  ask(question: string, yes: string): Promise<boolean> {
    this.settle(false);
    this.askText.textContent = question;
    this.askYes.textContent = yes;
    this.askBox.hidden = false;
    this.askNo.focus();
    return new Promise((resolve) => {
      this.answer = resolve;
    });
  }

  private settle(yes: boolean): void {
    this.askBox.hidden = true;
    const answer = this.answer;
    this.answer = null;
    answer?.(yes);
  }
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
