# Brief S3j — Browser tests off the clock

**Status:** agreed 9 Nov 2026
**Read first:** `STATE.md` (Bugs), `e2e/game.ts`, `e2e/play.spec.ts`, `e2e/zones.spec.ts`, S3i's Outcome.
**Goal:** a commit that changes no game code passes CI every time, so a red `master` always means something is wrong.

## Why now

`3f5e20e` changed only three docs, and CI failed on it twice, on four different browser tests, with 33 of 35 passing each time. The game code is the same as `26f8b7e`, which passed. A failed run also skips the deploy, so flaky tests can hold back the public page.

CI draws in software, so its frames are slow and uneven. The tests fail where they assume otherwise:

| Test | Error | Likely cause |
|---|---|---|
| A right click moves the squad, at four rotations | `camera.follow` still true after 5 seconds | `stillCamera` holds an arrow key for 250 ms by the clock, and a slow frame can miss it |
| Lande to Carrefour crossing (M1) | Timed out after 30 seconds | Not yet read in detail |
| Garganta and Carrefour both ways (M2) | Timed out at `crossInto` | `crossInto` waits to catch `fading` true, and may miss a short fade between frames |
| The walk through the sliver (M2) | "None of the points is on screen" | The camera had not reached the point when the click was tried |

`STATE.md` already lists earlier failures of the same kind. The causes in the table come from the logs and the code, and step 1 of the build confirms them.

## Decisions

1. **Tests wait on the game's own state, not the clock.** A held key is held until the camera has answered, and a look at a point waits until the point is on screen.
2. **A crossing is proved by the `zone-changed` event,** not by catching the fade.
3. **The game does not change.** Only `e2e/` does. Any fix that seems to need a change in `packages/` is a stop and ask.
4. **The tests still act as a player does,** with real keys and clicks.

5. **No automatic retries (the maintainer, 9 Nov 2026).** Playwright could re-run a failed test on CI, which would turn these runs green with far less work. It would also hide the next real timing bug.

## Scope

**In:**

- Reproduce the failures by slowing the browser's processor locally, and confirm each cause.
- `stillCamera`, `bringIntoView`, `crossInto`, the look-at steps and the timed key holds in `e2e/play.spec.ts`.
- `STATE.md`'s Bugs, cleared of the entries this fixes.

**Out:**

- Firefox and WebKit (no brief yet).
- Replays run in browsers on CI (no brief yet).
- Any change to movement, the camera or the page (a new brief, if step 1 finds a real fault).

## Done means

1. `pnpm check` passes.
2. `pnpm test:e2e` passes, still 35 tests, with no test removed or marked `fixme`. Each test named above fails before its fix under the slowed browser, and passes after it.
3. No timed wait remains in `e2e/` that decides whether an input has landed.
4. `docs/DATA-MODEL.md` needs no change, as no entity or rule moves.
5. The maintainer has approved the exact file list and diff before any commit.
6. CI is green on `master` after the approved push, on the first attempt and on four re-runs of that commit in a row.
7. **The maintainer has seen it running:** the public page deploys from that commit and plays as before.

## Stop and ask if

- A slowed run shows a real fault in the game, not in a test.
- A test can only be fixed by changing what it proves.
- CI still fails after the fixes, on any test.
- Any standing trigger in `CLAUDE.md` fires.

## Outcome (builder fills in)

Departures, bugs found, final numbers, and the closing note.
