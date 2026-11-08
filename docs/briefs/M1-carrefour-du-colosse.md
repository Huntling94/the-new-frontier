# Brief M1 — Carrefour du Colosse

**Status:** built 9 Nov 2026; closes when CI is green on `master`
**Read first:** `STATE.md`, `ARCHITECTURE.md`, `docs/DATA-MODEL.md`, briefs S3a, S3d and S3f, D-019, D-021, D-022, D-023, D-030, D-038, D-050, D-052, D-053.
**Depends on:** S3f closed. It does not depend on S3g or S3h, and touches none of their work.
**Goal:** the maintainer leaves Lande de Montclaire by a new gate, arrives at the east tip of a walled basin, and fights westward along its road to the far flank, with the squad never squeezing or giving up on the way.

## Why now

The game has one field. The first region needs more (D-043), and farming, the core of the game (D-053), needs somewhere to go after the Lande. Every shape of ground built so far is either an island, a rectangle or streets, so a field with bending walls, rock and water cannot be made yet. This brief adds that ground once, and sets the size for the fields that follow.

## Decisions

**Settled before agreeing** (the maintainer, 9 Nov 2026)

- **Q1. Settled: the layout is original.** The maintainer drew the sketch this brief is traced from, and confirmed on 9 Nov 2026 that it is his own design (D-038).
- **Q2. Settled: 240 by 240 is the baseline,** as in decision 2, with the walkable ground about two-thirds of the Lande's. The maintainer will judge it in play.
- **Q3. Settled: eight packs,** as in decision 9, about 1.8 times the Lande's density, to suit farming (D-053).
- **Q4. Settled: a closed dungeon door at the west end,** as in decision 6. An empty dungeon would need redoing when the real one is built.

**Map briefs** (D-058, the maintainer, 9 Nov 2026)

- **Each zone has its own brief, one at a time:** M1, M2 and so on, in the order they are built. A zone closes only when the maintainer is happy with how it looks, and more work on a closed zone's look comes back as M1.1, M1.2.

**The zone**

1. **Carrefour du Colosse is a zone of kind `field`** (D-021), the second in the starting region, between the Lande and the first dungeon. The name was agreed on 9 Nov 2026 (D-038). The colossus it is named for is deferred: there are no bosses for now (D-052), so `boss` is null.
2. **Field zones are 240 by 240 units by default** (D-057, the maintainer, 9 Nov 2026). That is the whole footprint, mountains included. This one has about 14,000 square units of walkable ground and a main road of about 258 units, about 23 seconds' uninterrupted walk at squad speed. Each field may vary by about a quarter. Towns and dungeons are sized by their own needs (the maintainer, 9 Nov 2026).
3. **A fourth ground shape, `basin`, joins the three in S3a and S3d.** Walkable ground is every point inside an outline, minus blocked outlines and blocked bending walls, each a centreline and a width. It reuses S3d's segment-distance and even-odd tests, so the rules compute no sine or cosine, and it becomes the grid, so A\* and route smoothing work unchanged (D-023). Water is blocked ground in the rules. This changes `GroundShape`, a deliberate change to the core's interface (D-019), and adds a row to `docs/DATA-MODEL.md`.
4. **The layout is hand-placed and frozen** (D-022), and its numbers are in the appendix, traced by eye. The builder shows the maintainer the plan in the viewer, with the grid drawn, before any `render` work, as in S3d.
5. **Height is look only** (D-022). The floor is flat in the rules. The ranges, the lake, the river and the height of rocks and walls belong to `render`. The ranges are highest beside the lake and lower to the south.

**Ways in and out**

6. **The Lande leads to the east tip, and the first dungeon lies off the west flank** (the maintainer, 9 Nov 2026). Two-way travel is two gates (D-038).
   - A new gate on the Lande's western edge leads to the east tip, and one at the east tip leads back. Both have empty requirements and no cost: the level step is small. The exact spot on the Lande is shown on the plan. The Lande's other gates, stones and packs do not move.
   - The first dungeon does not exist yet, so the west flank has a closed door in `render` only, with no gate. A gate with nowhere to go would fail the reachability check in `docs/DATA-MODEL.md`.
7. **The road to the south (G10 on the sketch) is closed for now,** blocked by look at the basin's edge, and kept for the falls. The lake is scenery with no way through. The lake end of the neck is open ground, off the main road.
8. **The road fits the triangle.** Every stretch of the main road is at least 13 units wide, measured on the grid, and at least 10.6 clear (S3d decision 3). The east tip needs widening at the plan stage: it traces at 10.3, about 10 units in from the gate.

**What lives there**

9. **Eight packs, placed by hand** (D-022), at levels rising westward from 6 to 11, as in the appendix. Levels are starting points, to be tuned.
10. **They are the four S3f monsters for now,** at those levels. New types and families wait for their own brief (D-050). Respawn is the same 180 seconds. Drops arrive with S3g, and nothing here needs them.
11. **The look is prototype level** (D-030): a dry limestone basin, with lavender thinning out from the east, grey ranges and a pale mountain lake, composed with care. The maintainer approves the look in the running game before this brief closes. Art beyond prototype level is S5.

**What stays the same**

12. **Bots, replays and the 100-seed report still run on the Lande.** The new zone is a new record in state, so both replay hashes move, as in S3d. The same 62-run comparison proves nothing else did, and the two hashes are then updated as a deliberate edit.
13. **Saves need no migration.** A new zone is a new ID, and any zone a save does not name gets a fresh record (S3d decision 10).

## Scope

**In:**

- The `basin` ground shape and its data checks.
- The zone, its frozen layout, its eight packs and its two gates, plus the new gate on the Lande.
- The zone's look in `render`, at prototype level.
- The viewer showing the plan with its grid.
- `docs/DATA-MODEL.md`, the register (D-057) and, if `render` gains a new part, `ARCHITECTURE.md`.

**Out:**

- The first dungeon (no brief yet).
- The road to the falls and the zones beyond it (no brief yet).
- The colossus and any boss (D-052, no brief yet).
- New monster types (no brief yet).
- Drops and the shop (S3g), and farming while away (S3h).
- Bots planning a route across zones (no brief yet).
- Height that affects the rules (no brief yet).
- Art beyond prototype level (S5, D-030).

## Done means

1. `pnpm check` passes.
2. Unit tests prove:
   - The world data checks (rule 6 in `docs/DATA-MODEL.md`) pass with the new zone: it is reachable from the Lande and back, every gate arrives on a walkable cell, and every pack and the camp stand on one.
   - Water, walls, rocks and the plateau are not walkable, and the closed south road and the lake cannot be reached.
   - The main road is as wide as decision 8 sets along its whole length, measured on the grid.
   - A squad ordered from the east tip to the west flank, and to the lake end, arrives with no `unit-gave-up` event.
   - A version 1 save from before this zone loads and plays, with the zone given a fresh record. A save made in the zone loads back in it.
3. The 62 runs of decision 12 match the old code tick for tick, and the 100-seed report matches S3f's Outcome. The hashes move only because of the new record, and the Outcome records old and new.
4. Building the grid and finding the longest route are timed and recorded. A route from the east tip to the west flank takes under 2 ms, on the machine and method S3a used.
5. `pnpm test:e2e` adds a flow: cross from the Lande, walk west, cross back.
6. Frame rate with every pack alive and the camera turning, as in S3a. The slowest 5% of frames stay inside 16.7 ms.
7. `docs/DATA-MODEL.md` adds `basin` and names the zone, and D-057 is in the register.
8. A check on the tracked files and built site finds no secrets, local paths or unintended personal information.
9. The maintainer has approved the exact file list and diff before any commit.
10. CI is green on `master` after the maintainer's approved push.
11. **The maintainer has played it:** cross from the Lande, fight along the road to the far flank, go up to the lake end, and come back. Questions:
    - Does it look good enough to close this zone?
    - Does it feel like a place, and like a crossroads?
    - Is the road a pleasure to walk more than once?
    - Is 240 by 240 the right size for the fields after it?

## Stop and ask if

- The maintainer has not approved the plan before `render` work starts (decision 4).
- A stretch of the main road cannot reach the width in decision 8 without changing the layout's shape.
- The time in Done means 4 or the frame rate in Done means 6 is missed.
- Any of the 62 runs differs from the old code in any tick, or the hashes move for any reason other than the new record.
- Saves need a change to their data, which would mean a migration step.
- Any standing trigger in `CLAUDE.md` fires.

## Appendix: the layout

Game units, centred on (0, 0), with x running east and z running south. One sketch square is 20 units. Traced by eye, so the plan may adjust points to meet decision 8.

**Basin outline:** (-47, -68), (-35, -64), (-18, -64), (0, -65), (6, -62), (7, -48), (6, -30), (12, -22), (27, -15), (55, -9), (85, -2), (118, 12), (116, 15), (100, 20), (88, 27), (85, 40), (80, 48), (55, 53), (35, 57), (17, 66), (5, 68), (-8, 63), (-18, 55), (-30, 48), (-43, 48), (-60, 57), (-70, 58), (-77, 51), (-79, 45), (-93, 41), (-108, 35), (-114, 20), (-112, 6), (-102, -2), (-102, -9), (-94, -15), (-78, -16), (-60, -12), (-43, -13), (-32, -23), (-30, -35), (-34, -48)

**Lake, look only, beyond the outline:** (-55, -109), (-45, -112), (-10, -110), (35, -105), (58, -97), (50, -92), (15, -84), (-5, -77), (-13, -67), (-25, -64), (-38, -65), (-47, -72), (-52, -95)

**Blocked outlines:**

| Name | Points |
|---|---|
| Central plateau | (10, 16), (20, 16), (26, 22), (25, 37), (15, 41), (7, 42), (3, 37), (3, 22) |
| Ridge in the neck | (-11, -59), (-3, -59), (-8, -54), (-7, -48), (-9, -43), (-10, -35), (-16, -35), (-14, -45), (-12, -53) |

**Blocked walls, as a centreline and a width:**

| Name | Width | Points |
|---|---|---|
| Long wall | 2.3 | (-43, 2), (-34, 1), (-30, 11), (-20, 20), (-19, 27), (-15, 32), (-9, 32), (-8, 20) |
| Plateau spur, west | 2 | (1, 23), (0, 35) |
| Plateau spur, east | 2.3 | (25, 20), (32, 15), (35, 11), (55, 12), (65, 18) |
| Arch wall | 2.3 | (22, 55), (21, 47), (30, 39), (40, 43), (43, 48) |
| West rocks | 2 | (-95, -8), (-85, -8), (-92, -4), (-88, 1) |
| Short wall | 2 | (-77, 14), (-72, 17) |
| Rock by the long wall | 2 | (-46, 18), (-38, 20) |
| South-west rock | 2 | (-67, 46), (-58, 42) |
| River | 3 | (-105, 71), (-85, 55), (-54, 35) |
| Pool | 3 | (-48, 36), (-36, 36) |

**Single rocks, as a centre and a radius:** (-97, 5) 1.8; (-86, 11) 2.0; (-67, 8) 3.3; (-45, 25) 1.8; (85, 25) 1.8; (48, 28) 2.0; (80, 35) 1.5.

**Main road, east to west:** (115, 12), (98, 6), (80, 5), (55, 0), (25, -4), (3, -6), (-12, -15), (-24, -16), (-35, -11), (-47, -3), (-51, 8), (-53, 22), (-60, 30), (-75, 31), (-93, 27), (-110, 21)

**Side routes:** to the lake end, (-24, -16) to (-24, -53). Towards the closed south road, (-51, 8), (-42, 12), (-33, 20), (-28, 35), (-18, 43), (-3, 52), (11, 61).

**Gates and door:** Lande gate at about (112, 13), arrival about (100, 9) facing west. Closed dungeon door at about (-112, 21).

**Packs, proposed:**

| Pack | About where | Level |
|---|---|---|
| 1 | (72, 18), beside the road past the entrance | 6 |
| 2 | (40, -2), on the road | 7 |
| 3 | (55, 40), south of the east spur | 7 |
| 4 | (-5, -12), at the first fork | 8 |
| 5 | (-22, -48), the lake end | 9 |
| 6 | (-5, 50), the south floor | 9 |
| 7 | (-60, -5), beyond the long wall | 10 |
| 8 | (-95, 25), before the far door | 11 |

## Outcome (builder fills in)

Built in two halves, rules then look, on 9 Nov 2026. The maintainer approved the plan in the viewer before any `render` work, and approved the look in the running game.

| Done means | Result |
|---|---|
| 1 | `pnpm check` passes: 556 tests, lint, types and the legacy guard |
| 2 | 23 tests in `packages/core/test/colosse.test.ts` cover the data checks, blocked ground, the road's width, routes with no `unit-gave-up`, and saves. 4 more in `packages/render/test/basin.test.ts` prove the land stays under the floor inside the outline, is highest beside the lake, and that drawing the zone changes no state |
| 3 | 62 runs, 193,013 per-tick digests of commands, events and all state bar the new record, identical old code against new. The 100-seed report matches S3f's Outcome (1.8 min, 10.4 upgrades, 40.2 marks, 7.8 potions, auto clear 100). The hashes move only because of the new record: spell tour 74be8540 to 80291be7, squad tour eea90d82 to b432cfc3 |
| 4 | Longest route, east tip to west flank: 1.25 ms (Node 24, 500-run means, 5 repeats), under the 2 ms limit. Grid build 62 ms median, 78 ms first |
| 5 | `pnpm test:e2e` adds the flow: cross from the Lande, walk west, cross back. All 33 browser tests pass; the new one also passed 4 repeats alone. It walks only 12 units west, short of the first pack, so no fight decides it |
| 6 | Every pack alive (38 monsters), camera turning through 5.4 full circles in 20 seconds, headless Chromium on an RTX 2080 Ti (Direct3D 11) at 1280 by 720, seed 1, frame limit off, three runs at each of three views, production build, game clock held: slowest 5% of frames 3.9 to 7.6 ms over the middle zoomed out, 5.1 to 5.5 ms over the middle at the default zoom, 2.4 to 3.0 ms over the east lavender. Inside 16.7 ms |
| 7 | `docs/DATA-MODEL.md` adds `basin` and names the zone. D-057 is in the register. `ARCHITECTURE.md` gains a Basins section |
| 8 | Tracked files, changed files and the built site hold no secrets, local paths or unintended personal information |
| 9 | Pending: the maintainer approves the exact file list and diff before each commit |
| 10 | Pending: CI on `master` after the approved push |
| 11 | The maintainer played it and said it looks good, 9 Nov 2026. The other three play questions (a place and a crossroads, the road walked twice, 240 by 240 for later fields) were not answered separately |

**Departures**

- The east tip was widened at the plan stage (decision 8): the traced tip was 3.1 wide at the gate and under 10.6 for the last 10 units. The road's narrowest is now 13.2 open units on the grid.
- The Lande's new gate is at (-68, 54), on the rim's south-west. A first try further north was walked into by bots, which changed several of the 62 runs.
- The grid covers x -120 to 120 and z -72 to 72, the walkable ground, not the whole 240 square. The ranges, the lake and the land beyond are `render` only.
- The sea is not drawn here: the zone is ringed by land.
- The river's look runs on past the end of the rules' river, through the southern range.

**Added beyond the brief**

- Rock between the camera and a living character dissolves in a soft circle, as a town's buildings fade. Without it the ranges hide the squad when the camera turns.
- `ZoneLook` gains an optional lantern strength, set to 12% here, because the full lantern left a yellow pool on the pale floor.

**Bugs found:** the new browser test first read the squad before its move order had landed, and failed. It now waits for the order, as the cave test does.

**Closing note:** the floor is flat to the eye as well as in the rules. The maintainer asked whether it could be uneven and left that for the graphics upgrade (S5).
