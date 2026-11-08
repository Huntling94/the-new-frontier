# Brief S3c — Saves

**Status:** agreed 8 Nov 2026, after a refresh for what S3b built.
**Read first:** `STATE.md`, `ARCHITECTURE.md`, `docs/DATA-MODEL.md`, briefs S3a and S3b, D-005, D-015, D-019, D-021, D-024, D-025, D-032, D-033.
**Depends on:** S3b closed.
**Goal:** the maintainer plays, upgrades gear, walks into the cave, refreshes the page, presses Continue and is back in the cave with the same levels, gear and marks.

## Why now

A refresh wipes the run, so playtesters cannot finish a region (D-024). S3a split lasting state from the live group, and S3b put the characters, their items and the family's shared items on the family. What lasts is now one clean set of data, so the first save format holds the new items and needs no migration on day one. Item shapes are not final: the maintainer wants new upgrade rules to replace D-005, in a brief of their own. Saves go first anyway, because playtesting needs them now, and that brief will then add the first real migration step, from version 1 to 2.

## Decisions

1. **The core turns lasting state into a save, and back** (D-032). `toSave(view)` returns plain data. `fromSave(data)` returns a game or a refusal with a reason. A save holds every fact the player earned or chose, and nothing that can be worked out again:

   | Saved | Where it lives today |
   |---|---|
   | Each character's name, class, level, XP and arts learned | `family.characters` |
   | What each character has equipped, with every item's ID, type and upgrade | each character's seven slots |
   | Every item not equipped | the family's inventory (decision 11) |
   | Which three are active, in order | `family.active` |
   | Marks and potions | `family` |
   | Bosses killed, and when each cleared pack comes back | the zone records |
   | The zone the squad is in, and where each character stands | `zoneId`, bodies, anchor, heading |
   | Each character's health and mana | bodies |
   | The generator's state and the game tick | `rng`, `tick` |
   | Quests completed and in progress | none yet: quests arrive with the first region, and join the save then through a migration step |

   Whether the run is won is not saved separately: it follows from the boss's zone record. A save never holds the live group (D-024).
   - **The tick** is saved because zone records time each cleared pack's return on the game clock (S3a).
   - **The ID counters are not saved; they are worked out on load.** `nextId` starts one above the highest character ID, since enemies and drops are rebuilt fresh and their old numbers no longer matter. `nextItemId` starts one above the highest item ID in the save, since every item that still exists is in the save. A destroyed item's number may be handed out again, which is safe while nothing refers to items that no longer exist.
   - **Where the squad stands is saved** (maintainer, 8 Nov 2026): each character's position, and the triangle's centre and heading. On load each body stands where it stood. A saved position that is no longer walkable in this build, because a zone's layout changed, falls back to the triangle at the zone's camp.
   - **Health and mana are saved** (maintainer, 8 Nov 2026), so a reload never heals the squad. A character who is down stays down, and needs a revive as before. Saves happen only outside fights, so cooldowns are not saved.
   - **Everything else on a body is rebuilt on load**: no cooldowns, orders, route or target, and stats recalculated from level and items. This settles the Body row that S3b left open.
   - A zone record's test `contents` are never saved; test runs never save (decision 9).
   - The live group starts fresh, as it does on entering the zone. The core never touches storage or the wall clock.
2. **Every save carries a format version, starting at 1** (D-024). A save has two parts: a small envelope (`format`, `version`, and the app's `savedAt`), and the game data.
3. **Migration is a chain of small steps** (D-024). Each step moves a save from version *n* to *n + 1*, as a plain function on plain data. A save loads by running every step from its version to the current one, then the normal check. Steps are never edited once shipped, and each version keeps a frozen example save in the tests forever, which every later build must load. Version 1 ships with no steps, so the chain is proven with a test-only step.
4. **A save is checked before it is used.** It must have the right shape, and every class, art, item type, zone and gate ID in it must exist in the data (rule 9 in `docs/DATA-MODEL.md`). Its items must keep S3b's rules: no item ID appears twice across the inventory and every slot (rule 1), each item sits in a slot its type fits, the slot a two-handed weapon fills is empty (rule 2), and the active three are characters in the family. A save newer than the build, or one that fails the check, is refused and left untouched, and the player is offered to export it or start a new game.
5. **`SaveStore` holds text and knows nothing of the format** (D-032): `load(): Promise<string | null>`, `save(text: string): Promise<void>` and `delete(): Promise<void>`. The methods are asynchronous, so a cloud store (D-033) fits later without changing them. This brief builds one store on `localStorage`, under one key. Before each write, the store copies the last good save to a second key, so one bad write or bad migration never loses the run.
6. **The game saves when no fight is on** (D-024): the core's `fightOn` read, which S3b built for equipping (any awake enemy except the training dummy), is false and the squad is not down, at most once every 15 seconds, set in `packages/app`. One definition of a fight serves both. It also saves on arriving through a gate, when the page is hidden with no fight on, and immediately after every anvil result, fight or not (D-005).
7. **The start screen offers Continue and New game** when a save exists. Continue shows the characters' levels and when it was saved. New game asks before it replaces a save.
8. **Export and import sit beside `SaveStore`** (D-032). Export downloads the save as a `.json` file. Import reads one, runs migration and the check, and asks before replacing the current save.
9. **Test and bot runs never save.** Saving is off when the address has `?bot=`, `?seed=` or `?test`, so a bot run on the public page cannot overwrite a player's game.
10. **Replays still start from `createGame`.** Saves do not enter replays in this brief.
11. **Step one renames the store to the inventory** (maintainer, 8 Nov 2026), before any save exists, so the name never needs a migration. `family.store` becomes `family.inventory` in code, tests, the living docs and the screen. "Store" would clash with `SaveStore` and with the town's shops. Closed briefs keep the old word, as records. A new decision records the name, since D-025 is never rewritten. Nothing else changes in step one: every replay and bot run must match tick for tick before step two begins.

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
- New upgrade rules (their own brief, replacing D-005), and the inventory changes the maintainer asked for after S3b: not pausing the game, and a UX pass.

## Done means

1. `pnpm check` passes.
2. Unit tests prove:
   - A save turns into text and back with every lasting value the same, and no live value in it.
   - A game loaded from a save plays on exactly as a fresh entry into that zone would, with the same generator state.
   - The version 1 example save loads, and a test-only step proves the chain runs in order.
   - A save from a newer version is refused, and the stored text is unchanged.
   - A save with a missing or unknown ID is refused.
   - A save with an item in two places, or an item in a slot its type does not fit, is refused.
   - After loading, new enemies, drops and items get IDs no saved character or item holds.
   - Loading in the cave puts each body where it stood, a position that is no longer walkable falls back to the cave's camp, and a pack cleared before saving comes back at the same tick it would have without the save.
3. Replays and bot runs do not change, because saving only reads state.
4. `pnpm test:e2e` adds flows:
   - Play, reload, Continue, and see the same levels, XP, marks, gear, inventory, zone, positions, health and mana.
   - Upgrade at the anvil and reload at once: the result stands.
   - Export, start a new game, import, and see the exported game back.
   - A `?bot=careful` run leaves an existing save untouched.
5. `docs/DATA-MODEL.md` moves the save to its new status, marks the body as not saved (rebuilt on load), and names the tests behind each saved entity.
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
