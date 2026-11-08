/**
 * The chain that moves old saves forward (D-024, S3c decision 3). Step n moves a save's
 * game data from version n to n + 1, as a plain function on plain data. A step is never
 * edited once shipped: a fix is a new step. Each version keeps a frozen example save in
 * `packages/core/test/saves/`, which every later build must load.
 */
export type MigrationStep = (game: unknown) => unknown;

/** Version 1 is the first format, so there are no steps yet. */
export const MIGRATIONS: readonly MigrationStep[] = [];

/** The version this build writes: one more than the number of steps. */
export const SAVE_VERSION = MIGRATIONS.length + 1;
