# Architecture

The game is split so that its rules run and test without a browser (D-009, D-016). Rules live in one package, and everything that draws, listens or builds sits around it. What the game is made of, and how its parts relate, is in `docs/DATA-MODEL.md`.

## Packages

| Package | Holds | May depend on |
|---|---|---|
| `packages/core` | Game rules, as plain functions and data | Nothing |
| `packages/render` | Everything drawn on screen | `core`, three.js |
| `packages/app` | The page, input and interface | `core`, `render` |
| `packages/tools` | Command-line tools, run on Node through `tsx` | `core`, Node |

Dependencies point one way, towards `core`. pnpm only lets a package import what its `package.json` declares, so an undeclared import fails to resolve.

## Interfaces between packages

Packages meet at small, explicit interfaces (D-019), so one can be rebuilt without rewriting the others. The renderer is the likely first case, because the graphics will be redone after the base game works.

- **`src/index.ts` is a package's whole public interface.** The `exports` field in `package.json` makes anything else impossible to import. `app` is the top of the stack, so nothing imports it.
- **What crosses is named, typed and read-only.** `core` exposes plain data, never three.js or browser objects.
- **Interface changes are deliberate.** The brief that makes one says so.
- **Inside a package, code stays simple.** An abstraction waits until a second real use needs it.

## Rules for the core

`core` must run anywhere and give the same answer each time. Lint and TypeScript enforce that.

- **No outside world.** No three.js, DOM or Node imports, no dynamic imports, and no browser or Node globals. `packages/core/tsconfig.json` has no DOM library and no ambient types.
- **No hidden inputs.** No `Math.random`, `Date`, `performance`, `setTimeout` or `crypto`.
- **Code and data stay separate (D-018).** `src` holds logic and `data` holds typed values. Lint rejects any number in `src` other than 0, 1, -1 and 2. Data files and tests are exempt.
- **No exceptions.** Comments cannot switch lint rules off inside `core`.

`packages/tools/test/core-lint.test.ts` proves these rules reject banned code.

## How the first feature crosses the split

The island shows the pattern for later features:

1. `packages/core/data/island.ts` holds the size, shape and noise values.
2. `packages/core/src/island.ts` turns those values into plain arrays of positions and indices.
3. `packages/render/src/island-geometry.ts` turns the arrays into three.js geometry, and chooses the colours.
4. `packages/app/src/main.ts` hands the page's canvas to `render`.

The renderer never sees the noise, and the core never sees a colour.

## The simulation

The rules run in fixed ticks, 30 a second, whatever the frame rate (D-015). A seed and a list of commands replay a run exactly.

- **All of the game is in `GameState`,** as plain data, generator included. Nothing in `core` keeps changing values anywhere else.
- **State has a lasting part and a live group (D-021).** The lasting part is the family, the current zone, one record per zone and the generator. The live group, `state.live`, holds the enemies, shots, enemy shots, scheduled effects and drops of the one zone that runs. Crossing a gate drops it, and entering a zone builds it fresh from the zone's data and record. A save (S3c) keeps the lasting part only.
- **A character and its body are separate (S3b).** `state.family` holds the characters, the active three in order, the store, marks and potions. A character is what lasts: name, class, level, XP, arts and seven slots of items. `state.bodies` holds one body for each of the active three: position, orders, route, health, mana, target, timers and the stats worked out from the character's items. Bodies belong to the squad, not the live group, so a gate moves them whole. A body's ID is its character's, and its place in the triangle comes from its place in the active three, never its class.
- **Items are instances of item types (D-028, D-029).** An item is a type ID and an upgrade, with an ID from its own counter, `nextItemId`, so enemy IDs never move. Weapon values sit on the item type, armour is shared, and each class keeps its armour skill. Every item is in exactly one place: the store, or one character's slot. `equip` and `unequip` move them, and are refused while any enemy is awake.
- **Class checks are data.** The boss turns on whoever's class auto-heals, bots cast by the spells a character knows and buy upgrades by place and slot, and `render` and `app` read a character's class only for its looks.
- **The grid is derived, not state (D-023).** Each zone's walkable grid is built from its data the first time it runs and kept in memory. It is the same on every run, so nothing about it needs saving.
- **The core changes state in place.** Outside code reads it as `GameView`, which is read-only. It passes state back only to `step`, `applyCommands` and `advance`.
- **Commands go in, and events come out.** Commands carry everything a rule needs, so the core has no cursor, camera or selection. Events report what happened, and are not part of state.
- **A replay proves it.** `packages/core/data/replays/` holds hand-written replays, each ending on an `expectedHash`. Changing rules or data changes the hash. The failing test prints the new one, updating it is a deliberate edit, and CI's result is the reference.
- **Time is seconds in the data and whole ticks in state,** converted once in `packages/core/src/time.ts`.
- **A tick runs in a fixed order:** commands, packs due back, bodies, then any gate crossing, which ends the tick, then enemies, shots, drops and delayed effects.
- **Anything that lands later is a record in state.** Shots, Volley's strikes, telegraphs and drops are plain entries, so a save keeps them.
- **The core resolves aiming.** A `cast` carries a point or enemy ID, and the rule picks the target. The shared target is in state, and selection stays in `packages/app`.
- **Enemies carry their own stats,** because level scales them. Monster types are data, and packs and the boss belong to the zone that holds them (D-022).
- **Layouts are baked (D-022).** `pnpm bake` runs the old placement generator once, with seed 1, and writes `packages/core/data/lande-layout.ts`. A test proves the committed file matches, so every change to the world shows in a diff.
- **Auto-combat and bots are players.** `autoCommands` and `botCommands` read `GameView` and return commands. They keep no memory and use no randomness, so a run needs only a seed.

The viewer at `/viewer.html` plays any replay, or a live bot from a seed, on a plain 2D canvas under `pnpm dev`. It can draw the zone's grid, with closed cells shaded, and each unit's live route as a dashed line through its corners. It is dev-only: Vite builds only `index.html`, and `e2e/public-build.spec.ts` proves no viewer page or replay reaches the public build.

## Protecting `legacy/`

`legacy/` is the 2019 game and never changes (D-016).

- **A read-only guard proves it.** `packages/tools/src/legacy-guard.ts` checks the folder's git tree against `v0-2019`, that it has no uncommitted changes, and that no git attribute reaches `legacy/ge.c`. It runs in `pnpm check` and in CI.
- **Line-ending rules name file types.** `.gitattributes` has no `*`, `*.txt` or `*.c` pattern, and there is no `.editorconfig`.
- **CI does not compile `ge.c`.** It needs Windows, and a failure could never be fixed.

## Commands

| Command | Does |
|---|---|
| `pnpm dev` | Runs the game locally, with the replay viewer at `/viewer.html` |
| `pnpm build` | Builds the static site to `packages/app/dist` |
| `pnpm check` | Typecheck, lint, unit tests and the `legacy/` guard |
| `pnpm test:e2e` | Builds, then runs the browser test |
| `pnpm sim --seed <n> --bot careful\|sloppy` | Plays one bot run in the terminal |
| `pnpm sim:report --seeds <n>` | Summarises both bots and auto-combat across many seeds |
| `pnpm bake` | Bakes Lande de Montclaire's standing stones and rocks into a data file |

The browser test needs Chromium once per machine: `pnpm exec playwright install chromium`.

## CI and deployment

`.github/workflows/ci.yml` runs on every push: install, `pnpm check`, build and browser tests. On `master`, a separate deploy job then publishes to GitHub Pages. It runs only if those checks pass, and it is the only job with write permissions. Workflows use no secrets, and actions are pinned to full commit hashes.
