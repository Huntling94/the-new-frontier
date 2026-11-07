import { gearName } from '@new-frontier/render';

/** What the anvil needs of one piece of gear. */
export interface AnvilItem {
  readonly upgrade: number;
  readonly spare: boolean;
}

/** What the anvil needs of one character: its class, for names, and whatever slots its gear holds. */
export interface AnvilCharacter {
  readonly id: number;
  readonly classId: string;
  readonly gear: Readonly<Record<string, AnvilItem>>;
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

/** An item's name with its upgrade, and "Spare" for the smith's replacement (D-005). */
export function itemName(classId: string, slot: string, item: AnvilItem): string {
  const base = gearName(classId, slot);
  return `${item.spare ? 'Spare ' : ''}${base}${item.upgrade > 0 ? ` +${item.upgrade}` : ''}`;
}

/**
 * The anvil's rows for one character: one for every slot its gear holds, in the
 * gear's own order, never a fixed four (S2.3b decision 5, D-028). Odds and costs
 * come from the core's `upgradeOffer` (D-005), passed in as `offer`.
 */
export function anvilRows(character: AnvilCharacter, offer: (slot: string) => AnvilOffer | null, marks: number): AnvilRow[] {
  return Object.entries(character.gear).map(([slot, item]) => {
    const found = offer(slot);
    return {
      unitId: character.id,
      slot,
      name: itemName(character.classId, slot, item),
      offer: found,
      affordable: found !== null && marks >= found.cost,
      odds: oddsText(item.upgrade, found),
    };
  });
}
