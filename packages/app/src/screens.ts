import { characterOf, TICK_RATE, type Command, type GameEvent, type GameView } from '@new-frontier/core';
import { percentText, smithGroups, type SmithRow } from './smith';
import { KEY_LIST } from './hud';
import type { RunTally } from './reactions';

const SECONDS_IN_MINUTE = 60;

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

/** What the smith did, in plain words, for the result box. */
export function smithResult(rowName: string, events: readonly GameEvent[]): string {
  for (const event of events) {
    if (event.type === 'upgraded') return `${rowName} is now +${event.level}.`;
    if (event.type === 'item-broken') return `${rowName} breaks. It waits in the inventory until the smith repairs it to +4.`;
    if (event.type === 'repaired') return `${rowName} is repaired to +${event.level}.`;
    if (event.type === 'order-refused') return event.reason === 'no-marks' ? 'Not enough marks.' : 'The smith cannot do that.';
  }
  return '';
}

/**
 * The smith's screen (S3e). It does not pause the game: towns hold no monsters and no
 * one talks during a fight (decision 4). A step that can fail is confirmed first (decision 6).
 */
export class SmithScreen {
  private readonly modal = element('forge');
  private readonly box = element('forgeBox');
  private view: GameView | null = null;
  private result = '';
  /** The risky step waiting for the player's yes. */
  private asking: SmithRow | null = null;
  private title = 'The smith';

  private readonly send: (commands: readonly Command[]) => readonly GameEvent[];
  private readonly close: () => void;

  constructor(send: (commands: readonly Command[]) => readonly GameEvent[], close: () => void) {
    this.send = send;
    this.close = close;
    this.box.addEventListener('click', (event) => this.click(event));
  }

  get open(): boolean {
    return !this.modal.hidden;
  }

  show(view: GameView, title: string): void {
    this.result = '';
    this.asking = null;
    this.title = title;
    this.modal.hidden = false;
    this.draw(view);
  }

  hide(): void {
    this.modal.hidden = true;
    this.result = '';
    this.asking = null;
  }

  private findRow(itemId: number): SmithRow | null {
    return this.view ? (smithGroups(this.view).flatMap(({ rows }) => rows).find((row) => row.itemId === itemId) ?? null) : null;
  }

  private act(row: SmithRow): void {
    if (!row.action) return;
    const command: Command = { type: row.action, itemId: row.itemId };
    // The name without its level, since the result says the level.
    this.result = smithResult(row.name.replace(/ \+\d+$/, ''), this.send([command]));
    this.asking = null;
  }

  private click(event: MouseEvent): void {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!target || target.disabled || !this.view) return;
    if (target.dataset.back !== undefined) {
      this.close();
      return;
    }
    if (target.dataset.confirm !== undefined) {
      if (this.asking) this.act(this.asking);
    } else if (target.dataset.cancel !== undefined) {
      this.asking = null;
    } else if (target.dataset.item !== undefined) {
      const row = this.findRow(Number(target.dataset.item));
      if (row?.action === 'upgrade' && row.chance !== null && row.chance < 1) {
        this.asking = row;
        this.result = '';
      } else if (row) {
        this.act(row);
      }
    }
    this.draw(this.view);
  }

  private rowButton({ itemId, name, odds, cost, action, affordable }: SmithRow): HTMLElement {
    const button = make('button', 'urow') as HTMLButtonElement;
    button.type = 'button';
    if (action) {
      button.dataset.item = String(itemId);
      button.disabled = !affordable;
      button.append(make('em', '', (cost ?? 0).toLocaleString('en-AU')));
    } else {
      button.disabled = true;
    }
    button.append(make('b', '', name), make('small', '', odds));
    return button;
  }

  private draw(view: GameView): void {
    this.view = view;
    const head = make('div', 'mhead');
    head.append(make('h3', '', this.title), make('span', 'money', `${Math.round(view.family.marks).toLocaleString('en-AU')} marks`));
    const blurb = make('p', 'dim', 'Guaranteed up to +4. Past that each step halves your odds, and a miss breaks the item. Broken gear cannot be worn until it is repaired to +4.');
    const parts: HTMLElement[] = [head, blurb];
    if (this.result) parts.push(make('div', 'resbox', this.result));
    if (this.asking) parts.push(this.askBox(this.asking));
    const columns = make('div', 'ucols');
    for (const group of smithGroups(view)) {
      const column = make('div');
      column.append(make('h4', '', group.title));
      for (const row of group.rows) column.append(this.rowButton(row));
      columns.append(column);
    }
    const buttons = make('div', 'btns');
    const back = make('button', 'btn', 'Leave the smith') as HTMLButtonElement;
    back.type = 'button';
    back.dataset.back = '';
    buttons.append(back);
    parts.push(columns, buttons);
    this.box.replaceChildren(...parts);
  }

  private askBox(row: SmithRow): HTMLElement {
    const box = make('div', 'resbox smithask');
    box.id = 'smithAsk';
    box.append(make('p', '', `${row.name}: ${percentText(row.chance ?? 0)} chance to succeed for ${(row.cost ?? 0).toLocaleString('en-AU')} marks. A miss breaks the item.`));
    const yes = make('button', 'btn', 'Try it') as HTMLButtonElement;
    yes.type = 'button';
    yes.dataset.confirm = '';
    const no = make('button', 'btn', 'Not now') as HTMLButtonElement;
    no.type = 'button';
    no.dataset.cancel = '';
    box.append(yes, no);
    return box;
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
        `upgrades ${tally.upgrades}, items broken ${tally.broken}.`,
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
