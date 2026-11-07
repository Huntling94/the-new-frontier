# Brief S3c — Saves

**Status:** draft. The maintainer chose on 8 Nov 2026 to build items before saves.
**Read first:** `STATE.md`, `ARCHITECTURE.md`, `docs/DATA-MODEL.md`, briefs S3a and S3b, D-005, D-015, D-019, D-021, D-024, D-025, D-032, D-033.
**Depends on:** S3b closed.
**Goal:** the maintainer plays, upgrades gear, walks into the cave, refreshes the page, presses Continue and is back in the cave with the same levels, gear and marks.

## Why now

A refresh wipes the run, so playtesters cannot finish a region (D-024). S3a split lasting state from the live group, and S3b put the characters, their items and the store on the family. What lasts is now one clean set of data, and its item shapes are settled, so the first save format holds the new items and needs no migration on day one.

## Decisions

1. **The core turns lasting state into a save, and back** (D-032). `toSave(view)` returns plain data. `fromSave(data)` returns a game or a refusal with a reason. A save holds the family, the zone records, the current zone and the generator's state, and never the live group (D-024). On load the squad stands at the current zone's camp at full health, with a fresh live group. The core never touches storage or the clock.
2. **Every save carries a format version, starting at 1** (D-024). A save has two parts: a small envelope (`format`, `version`, and the app's `savedAt`), and the game data.
3. **Migration is a chain of small steps** (D-024). Each step moves a save from version *n* to *n + 1*, as a plain function on plain data. A save loads by running every step from its version to the current one, then the normal check. Steps are never edited once shipped, and each version keeps a frozen example save in the tests forever, which every later build must load. Version 1 ships with no steps, so the chain is proven with a test-only step.
4. **A save is checked before it is used.** It must have the right shape, and every class, item type, zone and gate ID in it must exist in the data (rule 9 in `docs/DATA-MODEL.md`). A save newer than the build, or one that fails the check, is refused and left untouched, and the player is offered to export it or start a new game.
5. **`SaveStore` holds text and knows nothing of the format** (D-032): `load(): Promise<string | null>`, `save(text: string): Promise<void>` and `delete(): Promise<void>`. The methods are asynchronous, so a cloud store (D-033) fits later without changing them. This brief builds one store on `localStorage`, under one key. Before each write, the store copies the last good save to a second key, so one bad write or bad migration never loses the run.
6. **The game saves when no fight is on** (D-024): no enemy awake in the live group and the squad not down, at most once every 15 seconds, set in `packages/app`. It also saves on arriving through a gate, when the page is hidden with no fight on, and immediately after every anvil result, fight or not (D-005).
7. **The start screen offers Continue and New game** when a save exists. Continue shows the characters' levels and when it was saved. New game asks before it replaces a save.
8. **Export and import sit beside the store** (D-032). Export downloads the save as a `.json` file. Import reads one, runs migration and the check, and asks before replacing the current save.
9. **Test and bot runs never save.** Saving is off when the address has `?bot=`, `?seed=` or `?test`, so a bot run on the public page cannot overwrite a player's game.
10. **Replays still start from `createGame`.** Saves do not enter replays in this brief.

## Scope

**In:**

- `toSave`, `fromSave`, the version, the migration chain and the check.
- `SaveStore`, the browser store and its backup key.
- Automatic saving, Continue and New game, and export and import.
- `docs/DATA-MODEL.md`, `ARCHITECTURE.md` and a short section in the README on saves.

**Out:**

- Cloud saves and sign-in (D-033, proposed).
- More than one save slot (no brief yet, D-024).
- Saving mid-fight, or saving the live group (D-024).
- Saves in replays (no brief yet).

## Done means

1. `pnpm check` passes.
2. Unit tests prove:
   - A save turns into text and back with every lasting value the same, and no live value in it.
   - A game loaded from a save plays on exactly as a fresh entry into that zone would, with the same generator state.
   - The version 1 example save loads, and a test-only step proves the chain runs in order.
   - A save from a newer version is refused, and the stored text is unchanged.
   - A save with a missing or unknown ID is refused.
3. Replays and bot runs do not change, because saving only reads state.
4. `pnpm test:e2e` adds flows:
   - Play, reload, Continue, and see the same levels, marks, gear, store and zone.
   - Upgrade at the anvil and reload at once: the result stands.
   - Export, start a new game, import, and see the exported game back.
   - A `?bot=careful` run leaves an existing save untouched.
5. `docs/DATA-MODEL.md` moves the save to its new status.
6. A check on the tracked files and built site finds no secrets, local paths or unintended personal information.
7. The maintainer has approved the exact file list and diff before any commit.
8. CI is green on `master` after the maintainer's approved push.
9. **The maintainer has played it:** start a run, level up, upgrade gear, walk into the cave, refresh, Continue, then export and import the save. Questions:
   - Did Continue bring back what you expected, and nothing you did not?
   - Was it clear when the game had saved?

## Stop and ask if

- A rule needs a live value to survive a save, which D-024 rules out.
- `localStorage` refuses a save in any tested browser, or a save exceeds 100 KB.
- Any standing trigger in `CLAUDE.md` fires.

## Outcome (builder fills in)
