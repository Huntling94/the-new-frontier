# Brief S3k — Browser tests step by step

**Status:** agreed 9 Nov 2026
**Read first:** `STATE.md` (Bugs), S3j's brief and Outcome, `packages/app/src/main.ts`, `packages/app/src/clock.ts`, `e2e/game.ts`.
**Goal:** the public page plays exactly as before, and a commit's browser tests finish on CI in under 4 minutes, with no test depending on how fast frames arrive.

## Why now

S3j stopped the tests guessing at the clock, but they still wait for real frames. Three things are wrong.

- **Tests take as long as CI's drawing takes.** A frame counts for at most 0.05 seconds of game time (`FEEL.longestFrame`). CI draws in software, and S3j measured frames that are slow and uneven, so a walk costs however many frames it needs at that rate. The browser step took 6.1 to 7.2 minutes on the last green runs before S3j, and S3j then lifted the time limits on waits.
- **A hang now takes a long time to show.** S3j took the limits off polls that depend on frames, on the maintainer's word. Only a test's overall limit, up to 240 seconds, stops one that will never finish.
- **Some tests repeat the rules, slowly.** Walks through zones are already covered in `packages/core/test`, at far lower cost. The audit below says which.

No figure yet says how the time splits between tests or between drawing and everything else: CI's default reporter prints no per-test times. Step 1 of the build measures this, and the 4-minute target is provisional until it does.

## Decisions

1. **A test page can step the game.** A *frame step* runs the page's whole per-frame work once, on demand, with a set amount of time passing. `?test&step` stops the page scheduling its own frames, and the hook gains `step(frames, { draw })`. Without `?step`, a page runs as it does today. `?step` does nothing without `?test`.
2. **One frame body.** `frame` in `main.ts` splits into the work and the scheduling, so a stepped frame and a real frame run the same code. There is no test-only copy of the game loop.
3. **Each step counts as 1/30 of a second,** which is one game tick at `?speed=1` (`TICK_RATE` is 30). Tests wait on game state, as S3j decided, and do not assert an exact tick per frame, as hit-stop and slow time change that.
4. **Stepped frames can skip the picture.** `draw: false` skips only `renderer.render` and the overlay. Everything else in `world.frame` still runs, because it does real work: building a new zone's scene, moving figures, fading buildings. The last frame of each `step` call always draws, so `screenOf` and `pickables` report what the camera shows. This changes the `WorldView` interface in `packages/render`, by one optional field, which D-019 requires a brief to say.
5. **Waits are counted in frames.** A new `stepUntil(predicate, maxFrames)` helper in `e2e/game.ts` steps until the state holds, and fails with a clear message when `maxFrames` runs out. This is not a clock, so it keeps S3j's rule, and it restores a quick failure. In a stepped test, a bare `waitForFunction` on game state would hang for ever, so the helpers replace them all.
6. **Input stays real** (S3j decision 4). Keys, clicks and drags still go through Playwright to the page. Stepping makes them exact: key down, step 30 frames, key up.
7. **One time source in a stepped page.** The auto-save timer reads the frame's `now` and four other calls read `performance.now()`. In a stepped page all of them read one stepped clock, so an auto-save falls on the same frame every run.
8. **Two tests stay on real frames:** `smoke.spec.ts`, and "a run starts from the start screen" in `interface.spec.ts`. They prove the page's own loop still runs and draws. Everything else in a browser page steps.
9. **Still no automatic retries** (S3j decision 5).
10. **This lifts S3j decision 3 for this brief only,** and extends S2.3a decision 16: the hook stops being purely read-only, as `step` drives the game. The comment on `exposeHook` changes to say so. `packages/core` does not change.

11. **Two zone tests go (the maintainer, 9 Nov 2026),** as the audit sets out. They were Done means of M1 and M2, which are closed, but removing them changes what the browser suite proves. The risk is real and small: core tests run in Node, and browsers round `sin`, `cos` and `atan2` slightly differently (`STATE.md`), so a walk in a browser is not the identical walk.
12. **`lookAt` is replaced by `bringIntoView` (the maintainer, 9 Nov 2026),** as set out below.
13. **The target is 4 minutes for now (the maintainer, 9 Nov 2026),** and is revisited after step 1, with measured numbers.
14. **`smith.spec.ts` keeps writing marks straight into game state, as labelled setup (the maintainer, 9 Nov 2026).** Earning 100,000 marks in a test proves nothing about the smith, and a `?test` start option would be more surface for little gain.

## `lookAt` is not what a player does

`lookAt` in `e2e/zones.spec.ts` sets `camera.follow`, `camera.x` and `camera.z` from inside the page, which S3j decision 4 says tests should not do. The `Readonly` on the hook's camera binds only at compile time, so nothing stops it. It is called nine times, in the M1 and both M2 tests.

- **What it skips:** the arrow keys, the pan that turns follow off, and any proof a player can bring that point into view.
- **Why it probably exists:** panning across a zone cost too many real frames. Stepping removes that cost.
- **Decision 12:** `lookAt` goes, and the tests that remain use `bringIntoView`, as the town and cave tests already do. `bringIntoView`'s limits (20 tries of 40 frames) may need raising for long pans.

Other places tests reach past the player, all acceptable as setup: `smith.spec.ts` writes marks (decision 14), `saves.spec.ts` plants saves in `localStorage` and fires `visibilitychange`, and the leak test calls `world.rebuildZone()`, which a player has no way to do at will.

## Audit of the 35 tests

**27 stay, 6 shrink, 2 go.** *Page wiring* means what only a real page can prove: input to command, screen to ground, DOM, storage, WebGL. *Repeats* means a rule `packages/core/test` already covers. All of the "keep" tests that touch the game move to stepping, except the two in decision 8.

| File | Test | What it proves | Covered elsewhere | Verdict |
|---|---|---|---|---|
| `smoke` | starts and draws, clean console | Wiring: WebGL really draws | None | Keep, real frames |
| `public-build` | build is there | Build output, no game page | None | Keep |
| `public-build` | no viewer page | Build output | None | Keep |
| `public-build` | no replay | Build output | None | Keep |
| `interface` | start screen, nothing ticks before it | Wiring: DOM, loop, audio | None | Keep, real frames |
| `interface` | spell button casts, cooldown shows | Wiring: button, shade | `spells.test` for the rule | Keep |
| `interface` | N mutes, H hides help | Wiring | `controls.test` for the key map only | Keep |
| `interface` | cards show auto-combat | Wiring: HUD | `controls.test` for who goes on auto | Keep |
| `interface` | selecting one turns follow on | Wiring: follow flag, camera | `controls.test` for the target | Keep |
| `inventory` | Alt + E, equip, preview, pause | Wiring: screen, pause | `items.test` for the rule | Keep |
| `inventory` | says why an equip is refused | Wiring: message | `items.test` for the refusal | Keep |
| `play` | right click at four rotations | Wiring: screen to ground, then a repeat: bodies settling | `movement.test` for arrival | **Shrink:** see note 1 |
| `play` | right drag turns, never orders | Wiring | `camera.test` for the maths | Keep |
| `play` | Ctrl and left click attack-moves | Wiring | `movement.test` for the flag | Keep |
| `play` | F1 selects, only that one moves | Wiring | `controls.test` for who is ordered | Keep |
| `play` | left drag box-selects | Wiring | None | Keep |
| `play` | G regroups | Wiring, then a repeat | `movement.test:181` | **Shrink:** stop once holds clear, drop the wait for arrival |
| `play` | spell key casts by row | Wiring | `controls.test`, `family.test` | Keep |
| `play` | grips, rotates, tilts, zooms | Wiring: real mouse and keys | `camera.test` for the maths | Keep |
| `play` | scene rebuilds with no leaks | Wiring: WebGL memory | None | Keep, drawing every frame |
| `play` | a bot clears every pack | Wiring for one pack; the rest repeats | `bots.test`, and 100 seeds in `tools/test/runs.test` | **Shrink:** see note 2 |
| `saves` | play, cave, reload, Continue | Wiring: storage, gate save, Continue | `save.test` for what a save holds | **Shrink:** drop the fight, see note 3 |
| `saves` | version 1 save loads | Mostly a repeat, plus one label on screen | `save.test:367` | Keep: one page load, costs almost nothing |
| `saves` | export, new game, import | Wiring: download, file input, prompts | `app/test/saves.test` for parts | Keep |
| `saves` | unreadable save refused, backup offered | Wiring: note, buttons | `save.test:288` for the rule | Keep |
| `saves` | a bot run leaves a save alone | Wiring: S3c decision 9 | None in a page | Keep |
| `smith` | hover, talk, +5, reload | Wiring: hover, screen, save on result | `upgrades.test` for the rule | Keep |
| `smith` | miss breaks, refuses, repairs | Wiring: three screens together | `upgrades.test` for the rule | Keep |
| `smith` | left click, drag and Y do not talk | Wiring | `controls.test` for Y | Keep |
| `town` | starts in Montclaire, gate out and back | Wiring for the start, one gate; the return repeats | `town.test:170` | **Shrink:** one crossing, out only |
| `town` | test and bot pages start on the Lande | Wiring: address options | None | Keep |
| `zones` | cave, round the wall, back out | Wiring for crossing; the wall repeats | `zones.test:81` and `:108` | **Shrink:** in and out, drop the wall |
| `zones` | Lande to Carrefour and back (M1) | Repeats, apart from one banner | `colosse.test:306` and `:320` | **Remove** |
| `zones` | Garganta and Carrefour both ways (M2) | Wiring: two zones draw, both directions | `garganta.test:285` | Keep, without `lookAt` |
| `zones` | through the sliver (M2) | Repeats | 300 trips in `narrow-ground.test`, `garganta.test:306` | **Remove** |

Every zone still gets drawn in a real browser after this: Lande and Montclaire by the town test, the cave by the cave test, Carrefour and Garganta by the M2 test.

**Notes**

1. **Four rotations.** Keep the four clicks and the anchor check, which is the page's job. Check bodies settling at no rotations. The settled distance is the source of the "3.8 from the click" bug in `STATE.md`, and it is a rules question, so one new test goes to `packages/core/test`: bodies settling after orders beside stones on the Lande, across many click points.
2. **The bot.** The page test keeps what only it can prove: `?bot=careful` starts, a pack is cleared, the game carries on, the console stays clean. It stops after one pack, not seven, with a picture drawn at each batch of frames.
3. **Save round trip.** The fight only supplies XP and marks, and `save.test` proves those survive a save. The cap and the gate save stay. `xp > 0` is dropped.

## Scope

**In:**

- Stepping in `main.ts`, the hook and the optional `draw` field in `packages/render`.
- `step`, `stepUntil` and stepped versions of the helpers in `e2e/game.ts`.
- Moving the tests to stepping, the six shrinks and two removals, and `lookAt` gone.
- The new core test in note 1.
- `STATE.md`'s Bugs, cleared of what this fixes. The attack-move test should be among them. Its tick count becomes exact, and the entry goes only if that is shown.

**Out:**

- Any change to how the game plays, or to `packages/core` game code (a new brief if the build finds a fault).
- Firefox and WebKit (no brief yet).
- Replays run in browsers on CI (no brief yet).
- The cold lint test flake in `STATE.md` (no browser involved; no brief yet).

## Done means

1. `pnpm check` passes, with the one new core test (638 unit tests against 637 today).
2. `pnpm test:e2e` passes with 33 tests, from 35 (decision 11).
3. **Timings, before and after,** per test and in total, from Playwright's `list` reporter on CI. The browser step takes under 4 minutes on CI, or the maintainer has agreed a different figure after step 1.
4. No stepped test has a bare wait on game state. Only the two real-frame tests use the page's own loop. `lookAt` is gone.
5. **Stepping is not a different game:** a `?test&seed=1` run stepped with drawing and one stepped without it end on the same `hashState` after the same orders, for 1,800 ticks. The hook gains a read of that hash for this check.
6. **A hang fails fast:** a `stepUntil` that can never succeed fails within its frame limit, with a message naming what it waited for.
7. `docs/DATA-MODEL.md` needs no change, as no entity or rule moves. `docs/DECISIONS.md` gains an entry only if the maintainer wants one for decision 1.
8. The maintainer has approved the exact file list and diff before any commit.
9. CI is green on `master` after the approved push, on the first attempt and on four re-runs of that commit in a row, the same bar as S3j.
10. **The maintainer has seen it running:** the public page deploys from that commit and plays as before, moving, fighting and crossing a gate.

## Stop and ask if

- S3j has not closed. Its Done means 6 and 7 were pending when this was drafted, and this brief builds on its helpers.
- Step 1 shows drawing is not most of the time, so `draw: false` will not reach the target.
- Any part of `world.frame` other than `renderer.render` and the overlay turns out to need skipping.
- Done means 5 fails: a stepped page and a real one disagree.
- A pan cannot bring a gate into view by keys alone, which would be a finding about the game, not the test.
- A shrink or removal turns up something only that test was catching.
- Any standing trigger in `CLAUDE.md` fires.

## Outcome (builder fills in)

**Built 12 Nov 2026. Not yet closed:** Done means 3 (CI timings), 9 (CI green five times) and 10 (the maintainer seeing it) wait on the push.

**Step 1, measured locally** (Chromium on SwiftShader, as on CI; CI's old reporter gave no per-test times):

- Before: 35 tests in 4.1 minutes. The slowest were the sliver walk (35.3 s), the town crossing (20.4 s), the M2 crossing (19.1 s) and the M1 crossing (14.8 s). CI's browser step took about 8 minutes on the last green run before this brief.
- Drawing is most of a frame: in-page, 5.3 ms a frame drawn against 0.7 ms skipped on the Lande, and 2.3 against 0.13 in Montclaire. Over 1,800 stepped frames, drawing each took 107 s and skipping took 3.3 s, as the GPU's work queues up behind the timer. The stop-and-ask on drawing did not fire.

**After:** 33 tests in 1.6 minutes locally. The M2 crossing is now the slowest, at 15.8 s, then the leak test at 6.6 s, which draws every frame on purpose. 638 unit tests pass. The CI figure comes from the `list` reporter, now on, after the push.

**Done means 5:** a `?test&seed=1` page stepped with drawing and one stepped without it, after the same right click and auto-combat, ended on tick 1809 with the same hash, `7a3e5405`, over 159 hits and kills. **Done means 6:** a `stepUntil` that could never succeed failed after 300 frames, in 0.3 s, saying what it waited for. Both were run once and not kept as tests, so the suite holds 33.

**Departures:**

1. **The overlay is not skipped whole.** `drawOverlay` also ages floating text, which `floating()` reports. With `draw: false`, `Floats.age` ages it without drawing.
2. **`step` takes `until`, and returns the frames it ran.** `stepUntil` checks its condition after every frame inside the page; without `until`, each check would have ended a step call and so drawn a frame. When `until` stops a step early, a frame of no time draws the picture without moving the game.
3. **`stepFresh`** readies a stepped page after a load or reload, and `bringIntoView` now fails if the point never shows.
4. **Two waits stay on Playwright's default 5-second poll:** the save count after a gate, and the stored save after New game. Both wait on the browser's storage answering, not on frames.

**Found:**

- **Settling beside stones is a rule, not a flake.** The new core test sends the squad beside each of the 36 stones and rocks within 70 of the start, at eight points each: all 288 orders settle, the squad's middle ends up to 3.47 from the point, and two orders end with a unit giving up. The page test's limit of 3 was tighter than the rules keep. The maintainer set the core test's limit at 4 (12 Nov 2026). The bug entry in `STATE.md` goes, and the finding is under Open.
- **Attack-move's tick count is exact now.** It and the four-rotations test passed 15 times each in a row, so its bug entry goes.

