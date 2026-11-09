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

Built on 9 Nov 2026. Only `e2e/`, this Outcome and `STATE.md` changed.

| Done means | Result |
|---|---|
| 1 | Types, lint, 637 unit tests and the legacy guard pass. Lint ran with `--ignore-pattern '.claude/**'`, as in S3i |
| 2 | 35 browser tests pass, in 3.9 minutes, with none removed or marked `fixme`. Each test named in the brief failed before its fix under a slowed browser and passes after it (below) |
| 3 | No timed wait in `e2e/` decides whether an input has landed. The one `waitForTimeout` left is the pause between tries in `saveNow` (`saves.spec.ts`), which waits for a fight to end. Polls on drawn frames or game ticks carry no 5-second limit (below) |
| 4 | `docs/DATA-MODEL.md` needs no change |
| 5 | Pending: the maintainer's approval of the file list and diff |
| 6 | Pending: CI on the approved push and four re-runs |
| 7 | Pending: the public page deployed from that commit |

**What caused each failure**

| Test | Brief's guess | What the slowed runs showed |
|---|---|---|
| Four rotations | A held key can miss a slow frame | Confirmed. `camera.follow` stayed true after the 250 ms hold |
| M1 crossing (`zones.spec.ts:88`) | Not read | A click placed from a stale picture: see below. Inferred from the mechanism; the exact 30-second timeout did not recur locally |
| M2 both ways (`zones.spec.ts:110`) | `crossInto` misses a short fade | Not a missed fade. A fade runs in capped frame steps, at least 15 frames, so a poll cannot miss it. Two faults instead: a stale click, as above, and a fixed 10-second limit on the fade, which ran out with the game already in the right zone |
| The sliver walk | The camera had not reached the point | Confirmed. The page reported the old camera, as no frame had been drawn since the look |

A stale click: `lookAt` moved the camera and waited 250 ms. With no frame drawn in that time, `screenOf` still gave the old view, so the point seemed off screen, or the click landed short of the gate and the squad never crossed. Logged runs showed zero frames drawn after a look.

**How it was slowed.** The brief asked for processor slowing, and that alone did not match CI. At 24 times slower all 8 runs passed, because it slows the test's own page calls along with the frames. On CI the drawing is what is slow, and scripts stay quick. Delaying only the game's frames by 300 to 800 ms, with a script injected into a scratch copy of the tests, reproduced the failures. Before the fixes: 6 of 8 runs failed, and a processor slowdown of 16 times failed all six crossing runs at the 10-second limit. After them, in full runs with frames delayed 80 to 300 ms: 32 of 32, the three build-output tests being left out of that copy. At 300 to 800 ms the only failures were whole-test time limits, and with five times the limit those tests passed. The limits stay as they were, as CI is far quicker than that.

**Departures**

- **Crossings and walks have no limit of their own now.** Only the test's overall time limit bounds them, as nothing about the clock should decide a crossing.
- **Two tests beyond the brief's list.** The full delayed run found them, and leaving them would have left `master` flaky. "The camera grips" released the middle button before a frame had applied the drag, and now holds it until the camera has moved. "A ?bot=careful run" had the default 30 seconds for 900 ticks, and now has 90.
- **A failed first push (`c169e84`).** CI failed 34 of 35 on "the camera grips": a poll for the turn of a held key used `expect.poll`'s default limit of 5 seconds, and CI drew only a couple of frames in that time. The first round had missed that limit. On the maintainer's word the polls that depend on frames or ticks now have none, and that test has 90 seconds. The count for Done means 6 restarted on the next commit.
- Other timed waits went too: the arrow-key hold in `interface.spec.ts`, and three pauses in `smith.spec.ts`, which now wait for frames.

**Bugs left in `STATE.md`:** the cold lint test, the attack-move test, and the 3.8-from-the-click case in the four rotations test. These are not reproduced or fixed here.

**Closing note:** pending Done means 6 and 7.
