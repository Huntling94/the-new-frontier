import { itemName, slotName } from '@new-frontier/render';

/** What the anvil needs of one piece of gear: its type, for its name, and its upgrade. */
export interface AnvilItem {
  readonly typeId: string;
  readonly upgrade: number;
}

/** What the anvil needs of one character: every slot, empty or not (S3b decision 19). */
export interface AnvilCharacter {
  readonly id: number;
  readonly items: Readonly<Record<string, AnvilItem | null>>;
}

export interface AnvilOffer {
  readonly chance: number;
  readonly cost: number;
}

/** One button on the anvil. */
export interface AnvilRow {
  readonly unitId: number;
  readonly slot: string;
  readonly name: string;
  /** null when the item is at the most it can be. */
  readonly offer: AnvilOffer | null;
  readonly affordable: boolean;
  /** The odds line under the name. */
  readonly odds: string;
}

const PERCENT = 100;
const FINE_BELOW = 0.1;

/** Odds as the squad test wrote them: guaranteed, or a percentage and the risk. */
export function oddsText(level: number, offer: AnvilOffer | null): string {
  if (!offer) return 'Maxed';
  if (offer.chance >= 1) return `+${level + 1}: guaranteed`;
  const percent = (offer.chance * PERCENT).toFixed(offer.chance < FINE_BELOW ? 1 : 0);
  return `+${level + 1}: ${percent}% or destroyed`;
}

/**
 * The anvil's rows for one character: one for every slot, in the slots' own order,
 * never a fixed four (S2.3b decision 5, D-028). An empty slot shows, with nothing to
 * upgrade. Odds and costs come from the core's `upgradeOffer` (D-005), passed in as `offer`.
 */
export function anvilRows(character: AnvilCharacter, offer: (slot: string) => AnvilOffer | null, marks: number): AnvilRow[] {
  return Object.entries(character.items).map(([slot, item]) => {
    const found = item ? offer(slot) : null;
    return {
      unitId: character.id,
      slot,
      name: item ? itemName(item.typeId, item.upgrade) : `${slotName(slot)}: empty`,
      offer: found,
      affordable: found !== null && marks >= found.cost,
      odds: item ? oddsText(item.upgrade, found) : 'Nothing to upgrade',
    };
  });
}
