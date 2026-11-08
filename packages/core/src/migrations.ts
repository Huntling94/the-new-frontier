/**
 * The chain that moves old saves forward (D-024, S3c decision 3). Step n moves a save's
 * game data from version n to n + 1, as a plain function on plain data. A step is never
 * edited once shipped: a fix is a new step. Each version keeps a frozen example save in
 * `packages/core/test/saves/`, which every later build must load.
 */
export type MigrationStep = (game: unknown) => unknown;

/**
 * What each retired plain item type stood in for (S3e decision 12). The step names
 * every ID it retires, as rule 9 asks, so the table lives here, not in `data`.
 */
const PLAIN_TYPES: Readonly<Record<string, string>> = {
  'plain-sword': 'sword',
  'plain-rifle': 'rifle',
  'plain-staff': 'staff',
  'plain-chest': 'leather-chest',
  'plain-gloves': 'leather-gloves',
  'plain-boots': 'leather-boots',
  'plain-cap': 'cap',
  'plain-buckler': 'buckler',
  'plain-necklace': 'necklace',
};

type Plain = Record<string, unknown>;

const isPlain = (value: unknown): value is Plain => typeof value === 'object' && value !== null && !Array.isArray(value);

/** One item: its plain type retired, its ID and upgrade kept, and `broken` added. */
function modernItem(value: unknown): void {
  if (!isPlain(value)) return;
  const replacement = typeof value.typeId === 'string' ? PLAIN_TYPES[value.typeId] : undefined;
  if (replacement !== undefined) value.typeId = replacement;
  value.broken = false;
}

/** Version 1 to 2: the plain item types go, and items may break (D-042). A bad shape is left for the check to refuse. */
function retirePlainItems(game: unknown): unknown {
  const family = isPlain(game) ? game.family : null;
  if (!isPlain(family)) return game;
  if (Array.isArray(family.inventory)) family.inventory.forEach(modernItem);
  if (Array.isArray(family.characters)) {
    for (const character of family.characters as unknown[]) {
      if (isPlain(character) && isPlain(character.items)) Object.values(character.items).forEach(modernItem);
    }
  }
  return game;
}

export const MIGRATIONS: readonly MigrationStep[] = [retirePlainItems];

/** The version this build writes: one more than the number of steps. */
export const SAVE_VERSION = MIGRATIONS.length + 1;
