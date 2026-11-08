import {
  characterOf,
  repairCost,
  smithEntries,
  upgradeOffer,
  type GameView,
  type UpgradeOffer,
} from '@new-frontier/core';
import { characterLook, itemName } from '@new-frontier/render';

const PERCENT = 100;
const FINE_BELOW = 0.1;

/** One line on the smith's screen. */
export interface SmithRow {
  readonly itemId: number;
  readonly name: string;
  /** What the button does, or null when nothing can be done. */
  readonly action: 'upgrade' | 'repair' | null;
  readonly cost: number | null;
  readonly chance: number | null;
  readonly affordable: boolean;
  /** The line under the name. */
  readonly odds: string;
}

/** A column on the screen: one character's worn items, or the inventory. */
export interface SmithGroup {
  readonly title: string;
  readonly rows: readonly SmithRow[];
}

export function percentText(chance: number): string {
  return `${(chance * PERCENT).toFixed(chance < FINE_BELOW ? 1 : 0)}%`;
}

/** Odds as the screen writes them. Every step that can fail says what a miss does (S3e decision 6). */
export function oddsText(level: number, offer: UpgradeOffer | null): string {
  if (!offer) return 'Maxed';
  if (offer.chance >= 1) return `+${level + 1}: guaranteed`;
  return `+${level + 1}: ${percentText(offer.chance)}. A miss breaks the item`;
}

function row(view: GameView, item: ReturnType<typeof smithEntries>[number]['item']): SmithRow {
  const name = itemName(item.typeId, item.upgrade);
  const marks = view.family.marks;
  if (item.broken) {
    const cost = repairCost(view, item.id);
    return {
      itemId: item.id,
      name,
      action: 'repair',
      cost,
      chance: null,
      affordable: cost !== null && marks >= cost,
      odds: `Broken at +${item.upgrade}. Repair to +4`,
    };
  }
  const offer = upgradeOffer(view, item.id);
  return {
    itemId: item.id,
    name,
    action: offer ? 'upgrade' : null,
    cost: offer?.cost ?? null,
    chance: offer?.chance ?? null,
    affordable: offer !== null && marks >= offer.cost,
    odds: oddsText(item.upgrade, offer),
  };
}

/** Every weapon and armour item the family owns, grouped by who wears it, then the inventory (S3e decision 5). */
export function smithGroups(view: GameView): readonly SmithGroup[] {
  const entries = smithEntries(view);
  const worn = view.family.characters.flatMap((character): SmithGroup[] => {
    const rows = entries.filter(({ wearerId }) => wearerId === character.id).map(({ item }) => row(view, item));
    const title = `${characterOf(view, character.id).name}, ${characterLook(character.classId).name}`;
    return rows.length > 0 ? [{ title, rows }] : [];
  });
  const rows = entries.filter(({ wearerId }) => wearerId === null).map(({ item }) => row(view, item));
  return [...worn, ...(rows.length > 0 ? [{ title: 'Inventory', rows }] : [])];
}
