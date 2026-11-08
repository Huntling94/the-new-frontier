import { spellsOf, type Command, type GameView, type Point } from '@new-frontier/core';

/**
 * The keys (D-031, D-034). Keys are read by position on the keyboard (`KeyboardEvent.code`),
 * so the grid keeps its shape on other layouts.
 */
export type KeyAction =
  | { readonly kind: 'spell'; readonly place: number; readonly slot: number }
  | { readonly kind: 'select'; readonly place: number }
  | { readonly kind: 'select-all' }
  | { readonly kind: 'regroup' }
  | { readonly kind: 'scatter' }
  | { readonly kind: 'potion' }
  | { readonly kind: 'auto' }
  | { readonly kind: 'snap' }
  | { readonly kind: 'reset-view' }
  | { readonly kind: 'inventory' }
  | { readonly kind: 'close' }
  | { readonly kind: 'help' }
  | { readonly kind: 'mute' };

/** One row of spell keys for each place in the active three. */
export const SPELL_ROWS: readonly (readonly string[])[] = [
  ['KeyQ', 'KeyW', 'KeyE', 'KeyR'],
  ['KeyA', 'KeyS', 'KeyD', 'KeyF'],
  ['KeyZ', 'KeyX', 'KeyC', 'KeyV'],
];

const PRESSES: Readonly<Record<string, KeyAction>> = {
  ...Object.fromEntries(
    SPELL_ROWS.flatMap((row, place) =>
      row.map((code, slot): [string, KeyAction] => [code, { kind: 'spell', place, slot }]),
    ),
  ),
  F1: { kind: 'select', place: 0 },
  F2: { kind: 'select', place: 1 },
  F3: { kind: 'select', place: 2 },
  F4: { kind: 'select-all' },
  KeyG: { kind: 'regroup' },
  KeyB: { kind: 'scatter' },
  Digit5: { kind: 'potion' },
  Space: { kind: 'auto' },
  Home: { kind: 'snap' },
  Backspace: { kind: 'reset-view' },
  Escape: { kind: 'close' },
  KeyH: { kind: 'help' },
  KeyN: { kind: 'mute' },
};

export function pressAction(code: string): KeyAction | null {
  return PRESSES[code] ?? null;
}

/**
 * Keys pressed with `Alt` (D-040). `Alt` + `E` opens the inventory anywhere, and
 * holding `Alt` keeps `E` from casting. Read by position, so it works on any layout.
 */
export function altAction(code: string): KeyAction | null {
  return code === 'KeyE' ? { kind: 'inventory' } : null;
}

/** What a key is called on screen: `KeyQ` is Q. */
export function keyLabel(code: string): string {
  return code.replace(/^Key|^Digit/, '');
}

/** The spell key for a place and slot, or null past the end of the row. */
export function spellKey(place: number, slot: number): string | null {
  const code = SPELL_ROWS[place]?.[slot];
  return code ? keyLabel(code) : null;
}

/** Keys that act while held. */
export const HELD = {
  panUp: 'ArrowUp',
  panDown: 'ArrowDown',
  panLeft: 'ArrowLeft',
  panRight: 'ArrowRight',
  rotateLeft: 'Comma',
  rotateRight: 'Period',
} as const;

/** Keys the browser would otherwise act on. */
export const CLAIMED = new Set([
  ...Object.keys(PRESSES),
  ...Object.values(HELD),
  'ShiftLeft',
  'ShiftRight',
]);

/** The character in a place in the active three, by its place, never its class (D-025). */
export function characterAt(view: GameView, place: number): number | null {
  return view.bodies[place]?.id ?? null;
}

/**
 * A spell key's cast: the character in that place casts the spell in that slot
 * of its own list (D-027). The core aims it from the point under the cursor.
 */
export function castFor(view: GameView, place: number, slot: number, cursor: Point | null): Command | null {
  const unitId = characterAt(view, place);
  if (unitId === null) return null;
  const spell = spellsOf(view, unitId)[slot];
  if (!spell) return null;
  return cursor ? { type: 'cast', unitId, spell, point: cursor } : { type: 'cast', unitId, spell };
}

/** Orders go to the selected characters who are up, or to everyone up if none are. */
export function orderedIds(view: GameView, selected: ReadonlySet<number>): number[] {
  const living = view.bodies.filter(({ alive }) => alive);
  const chosen = living.filter(({ id }) => selected.has(id));
  return (chosen.length > 0 ? chosen : living).map(({ id }) => id);
}

/** The middle of everyone up, which the camera follows. */
export function squadCentre(view: GameView): Point {
  const living = view.bodies.filter(({ alive }) => alive);
  if (living.length === 0) return view.anchor;
  return {
    x: living.reduce((sum, { x }) => sum + x, 0) / living.length,
    z: living.reduce((sum, { z }) => sum + z, 0) / living.length,
  };
}

/**
 * What the camera follows (D-037): one selected character on their own, or else the
 * middle of everyone up.
 */
export function followPoint(view: GameView, selected: ReadonlySet<number>): Point {
  if (selected.size === 1) {
    const unit = view.bodies.find(({ id, alive }) => alive && selected.has(id));
    if (unit) return { x: unit.x, z: unit.z };
  }
  return squadCentre(view);
}
