import {
  characterOf,
  fightOn,
  GEAR_SLOTS,
  itemInfo,
  previewChange,
  whyNotUse,
  type ChangePreview,
  type Command,
  type GameEvent,
  type GameView,
  type GearSlot,
  type ItemView,
  type RefusalReason,
  type StatSheet,
} from '@new-frontier/core';
import { categoryLook, characterLook, itemName, slotName } from '@new-frontier/render';

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

/** The key stats the screen compares, with what it calls them (S3b decision 20). */
const STATS: readonly (readonly [keyof StatSheet, string])[] = [
  ['attack', 'Attack'],
  ['defence', 'Def'],
  ['ar', 'AR'],
  ['dr', 'DR'],
  ['crit', 'Crit'],
  ['range', 'Range'],
  ['maxHealth', 'Health'],
];

const ONE_PLACE = 10;
const shown = (value: number): string => String(Math.round(value * ONE_PLACE) / ONE_PLACE);

/** Why the core refused, in the player's words. */
export function refusalText(reason: RefusalReason, item: ItemView | null, who: string): string {
  switch (reason) {
    case 'in-fight':
      return 'Not during a fight. Wait until no enemy is awake.';
    case 'needs-level':
      return `${who} needs level ${item?.level ?? '?'} for this.`;
    case 'needs-art':
      return `${who} has no art for a ${categoryLook(item?.category ?? '').name.toLowerCase()}.`;
    case 'broken':
      return 'It is broken. The smith in town can repair it to +4.';
    case 'wrong-slot':
      return 'It does not fit that slot.';
    case 'slot-empty':
      return 'That slot is empty.';
    default:
      return `Refused: ${reason}.`;
  }
}

/** Each key stat before and after, marking what goes up or down. */
export function statLines(preview: ChangePreview): { readonly label: string; readonly text: string; readonly change: number }[] {
  return STATS.map(([key, label]) => {
    const before = preview.before[key];
    const after = preview.after[key];
    const change = Math.round((after - before) * ONE_PLACE) / ONE_PLACE;
    return { label, text: change === 0 ? shown(before) : `${shown(before)} → ${shown(after)}`, change };
  });
}

/**
 * The inventory (S3b decision 20, D-040). The family's shared items on the left, the active three on
 * the right. Click an inventory item, then a slot, to equip; click an equipped item to send
 * it back. It pauses the game, and sends its commands at once.
 */
export class Inventory {
  private readonly modal = element('inventory');
  private readonly box = element('inventoryBox');
  private view: GameView | null = null;
  /** The inventory item picked up, waiting for a slot. */
  private held: number | null = null;
  private message = '';
  private preview: { readonly title: string; readonly body: ChangePreview } | null = null;

  private readonly send: (commands: readonly Command[]) => readonly GameEvent[];
  private readonly close: () => void;

  constructor(send: (commands: readonly Command[]) => readonly GameEvent[], close: () => void) {
    this.send = send;
    this.close = close;
    this.box.addEventListener('click', (event) => this.click(event));
    this.box.addEventListener('mouseover', (event) => this.hover(event));
  }

  get open(): boolean {
    return !this.modal.hidden;
  }

  show(view: GameView): void {
    this.held = null;
    this.message = '';
    this.preview = null;
    this.modal.hidden = false;
    this.draw(view);
  }

  hide(): void {
    this.modal.hidden = true;
    this.held = null;
  }

  /** Redraws after the game moves on, as when a command lands. */
  refresh(view: GameView): void {
    if (this.open) this.draw(view);
  }

  private click(event: MouseEvent): void {
    const view = this.view;
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!view || !target) return;
    const act = target.dataset.act;
    if (act === 'close') {
      this.close();
      return;
    }
    if (act === 'shared') {
      const id = Number(target.dataset.item);
      this.held = this.held === id ? null : id;
      this.message = '';
      this.preview = null;
    }
    if (act === 'slot') {
      const unitId = Number(target.dataset.unit);
      const slot = target.dataset.slot as GearSlot;
      const command: Command =
        this.held !== null ? { type: 'equip', unitId, itemId: this.held, slot } : { type: 'unequip', unitId, slot };
      if (this.held === null && !characterOf(view, unitId).items[slot]) return;
      const events = this.send([command]);
      const refused = events.find((answer) => answer.type === 'order-refused');
      const item = this.held !== null ? this.inventoryItem(view, this.held) : null;
      this.message = refused?.type === 'order-refused' ? refusalText(refused.reason, item, characterOf(view, unitId).name) : '';
      if (!refused) this.held = null;
      this.preview = null;
    }
    this.draw(this.view ?? view);
  }

  /** Holding an item over a slot shows each key stat before and after (decision 20). */
  private hover(event: MouseEvent): void {
    const view = this.view;
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-act="slot"]');
    if (!view || !target) return;
    const unitId = Number(target.dataset.unit);
    const slot = target.dataset.slot as GearSlot;
    const character = characterOf(view, unitId);
    const command: Command | null =
      this.held !== null
        ? { type: 'equip', unitId, itemId: this.held, slot }
        : character.items[slot]
          ? { type: 'unequip', unitId, slot }
          : null;
    const next = command && (command.type === 'equip' || command.type === 'unequip') ? previewChange(view, command) : null;
    const title = next ? `${character.name}, ${slotName(slot)}` : '';
    if (title === this.preview?.title && next?.reason === this.preview.body.reason) return;
    this.preview = next ? { title, body: next } : null;
    this.drawPreview(view);
  }

  private inventoryItem(view: GameView, id: number): ItemView | null {
    const found = view.family.inventory.find((item) => item.id === id);
    return found ? itemInfo(found) : null;
  }

  private tile(item: ItemView, className: string): HTMLElement {
    const look = categoryLook(item.category);
    const tile = make('div', className);
    const badge = make('i', 'cat', look.name);
    badge.style.color = look.colour;
    badge.style.borderColor = look.colour;
    tile.append(badge, make('b', '', itemName(item.typeId, item.upgrade)));
    if (item.fills.length > 0) tile.append(make('small', '', 'Two hands'));
    if (item.broken) tile.append(make('small', 'warn', 'Broken'));
    return tile;
  }

  private draw(view: GameView): void {
    this.view = view;
    const head = make('div', 'mhead');
    const fight = fightOn(view);
    head.append(make('h3', '', 'Inventory'), make('span', fight ? 'warn' : 'dim', fight ? 'Fight on: no changes' : 'Alt + E or Esc to close'));
    const blurb = make('p', 'dim', 'Click an item in the inventory, then a slot. Click an equipped item to send it back to the inventory.');

    const shared = make('div', 'shared');
    shared.append(make('h4', '', `Inventory (${view.family.inventory.length})`));
    if (view.family.inventory.length === 0) shared.append(make('p', 'dim', 'Empty.'));
    for (const held of view.family.inventory) {
      const item = itemInfo(held);
      const tile = this.tile(item, 'itile');
      tile.dataset.act = 'shared';
      tile.dataset.item = String(item.id);
      tile.classList.toggle('held', this.held === item.id);
      tile.setAttribute('role', 'button');
      shared.append(tile);
    }

    const columns = make('div', 'icols');
    for (const id of view.family.active) {
      const character = characterOf(view, id);
      const column = make('div');
      column.dataset.unit = String(id);
      column.append(make('h4', '', character.name), make('small', 'dim', `${characterLook(character.classId).name}, level ${character.level}`));
      const fillers = new Map<string, string>();
      for (const slot of GEAR_SLOTS) {
        const worn = character.items[slot];
        if (worn) for (const filled of itemInfo(worn).fills) fillers.set(filled, itemName(worn.typeId));
      }
      for (const slot of GEAR_SLOTS) {
        const worn = character.items[slot];
        const row = make('div', 'islot');
        row.dataset.act = 'slot';
        row.dataset.unit = String(id);
        row.dataset.slot = slot;
        row.setAttribute('role', 'button');
        row.append(make('span', 'sname', slotName(slot)));
        if (worn) {
          row.append(this.tile(itemInfo(worn), 'itile worn'));
        } else {
          const filler = fillers.get(slot);
          row.append(make('span', 'empty', filler ? `Held by ${filler}` : 'Empty'));
        }
        if (this.held !== null) {
          const item = this.inventoryItem(view, this.held);
          const fits = item?.fits.includes(slot) ?? false;
          row.classList.toggle('fits', fits);
          row.classList.toggle('blocked', fits && (item?.broken === true || whyNotUse(view, id, item?.typeId ?? '') !== null));
        }
        column.append(row);
      }
      columns.append(column);
    }

    const body = make('div', 'ibody');
    body.append(shared, columns);
    const message = make('div', 'resbox imsg', this.message);
    message.id = 'inventoryMessage';
    const preview = make('div', 'ipreview');
    preview.id = 'inventoryPreview';
    const buttons = make('div', 'btns');
    const back = make('button', 'btn', 'Back to the game') as HTMLButtonElement;
    back.type = 'button';
    back.dataset.act = 'close';
    buttons.append(back);
    this.box.replaceChildren(head, blurb, body, preview, message, buttons);
    this.drawPreview(view);
  }

  private drawPreview(view: GameView): void {
    const box = this.box.querySelector<HTMLElement>('#inventoryPreview');
    if (!box) return;
    const preview = this.preview;
    if (!preview) {
      box.replaceChildren(make('span', 'dim', this.held !== null ? 'Hold the item over a slot to compare.' : ''));
      return;
    }
    const lines: HTMLElement[] = [make('b', '', preview.title)];
    const { reason, displaced } = preview.body;
    if (reason) {
      const item = this.held !== null ? this.inventoryItem(view, this.held) : null;
      const who = preview.title.split(',')[0] ?? '';
      lines.push(make('span', 'warn', refusalText(reason, item, who)));
    } else {
      for (const { label, text, change } of statLines(preview.body)) {
        lines.push(make('span', change > 0 ? 'up' : change < 0 ? 'down' : 'same', `${label} ${text}`));
      }
      for (const item of displaced) {
        lines.push(make('span', 'warn', `Sends ${itemName(item.typeId, item.upgrade)} to the inventory`));
      }
    }
    box.replaceChildren(...lines);
  }
}
