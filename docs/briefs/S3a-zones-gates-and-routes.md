# Brief S3a — Zones, gates and routes

**Status:** agreed 8 Nov 2026.
**Read first:** `STATE.md`, `ARCHITECTURE.md`, `docs/DATA-MODEL.md`, brief S2.3a, D-007, D-011, D-015, D-018, D-019, D-021, D-022, D-023, D-029, D-030, D-038.
**Depends on:** S2.3b closed.
**Goal:** the squad walks from Lande de Montclaire through a gate into a walled cave, finds its own way round the walls, fights the pack that lives there, and walks back out, with the Lande as it was left.

## Why now

The core still thinks the world is one island. Every zone in `ZONES` is live at once, walkability asks every zone, enemies are kept in by any coast, and units walk in straight lines and give up after 0.7 seconds without progress, so a single wall would stop them (D-023). Trees and rocks are scattered by the seed, which D-022 ruled out. Saves (S3b) need a clean line between what lasts and what is dropped on leaving a zone, and this brief draws it.

S3's world foundation splits in three. This brief builds the world. S3b builds the family and reshapes items into types, slots and the store (D-025, D-028). S3c adds saves (D-024, D-032), after items, so the first save format already holds the new items (the maintainer, 8 Nov 2026).

## Decisions

1. **One zone runs at a time** (D-021). State names the current zone. Enemies, shots, enemy shots, drops and scheduled effects move into one live group on state, which is dropped on leaving and built fresh on entering. This changes `GameView`'s shape, so it is a deliberate change to the core's interface (D-019), and `render` and `app` follow it.
2. **Each zone has a lasting record** (D-021). The record holds what outlives a visit: the boss is dead, and when each cleared pack comes back. Packs return on the game clock, not on re-entry, after a respawn time set in data (proposed 180 seconds, a placeholder until balance). A pack due back while its zone runs appears at home; one due back while the squad is elsewhere is there on the next visit.
3. **Packs, the boss, the dummy, the anvil and the camp belong to the zone** (D-022). A scenario shrinks to the starting zone, point and heading, and may replace a zone's contents for tests. `EMPTY_SCENARIO` and `DUMMY_SCENARIO` keep working that way.
4. **Layouts are baked** (D-022). A tool in `packages/tools` places the island's trees and rocks once, with seed 1's current layout, and writes them to a data file that is committed. `buildZones` stops using the generator. Every seed then gets the same island, and the seed decides only rolls.
5. **A zone's ground is one of two shapes.** An island keeps its noisy coast. A walled zone is a rectangle with walls as axis-aligned boxes in data. Both turn into the same grid, so nothing after the grid knows the difference.
6. **One grid per zone, built on entry and never saved** (D-023). Cells are 1 world unit, so the island is about 190 by 190 cells. A cell is walkable if it is inside the ground and clear of every obstacle and wall, with obstacles grown by the unit radius, so a route never scrapes an edge. Movement, enemies, `pullOntoLand` and the gate checks all read it, in place of `isWalkable` asking every zone.
7. **A\* finds routes, with a binary heap** (D-023, D-029). A unit walks straight when the straight line is clear on the grid, and asks A\* only when it is not. A route is smoothed by skipping any corner the line of sight can cut, so units walk in long straight runs, not cell by cell. A destination on an unwalkable cell moves to the nearest walkable one. A unit with no route at all gives up at once, with the existing `unit-gave-up` event.
8. **Enemies know their zone,** and walk only its grid. They still chase in straight lines, because monsters fight in the open today. Enemy routes wait for the first zone where a monster must go round a wall to reach the squad (no brief yet).
9. **Gates are data on the zone they leave** (D-021): an area, the zone they arrive in, an arrival point and heading, requirements and a cost. Both lists are empty in this brief, and their shape is the shared requirement shape from `docs/DATA-MODEL.md`. A two-way link is two gates.
10. **A character crosses only by arriving inside a gate's area on an order,** and the whole squad goes with it, alive or down (D-021). Walking through on the way somewhere else, or being knocked in, does not cross (the maintainer, 8 Nov 2026). Gates work during a fight, and the zone left behind resets its live group. The core reports a `zone-changed` event, and the app fades out and in while `render` drops the old scene and builds the new one (S2.3a decision 10).
11. **A zone records its place in a shared world frame** (D-021). Rules ignore it for now. It keeps near-seamless travel open for later.
12. **Rules that must always hold are tested as data checks** (`docs/DATA-MODEL.md`): every zone is reachable from the start by breadth-first search over gates, every gate arrives on a walkable cell, every pack and camp stands on a walkable cell, and nothing outside the live group names an enemy once its zone has closed.
13. **Auto-combat and bots stay inside the current zone.** They read the current zone in place of `ZONES`, and the island run plays as before. Planning a route across zones waits for a brief that needs it.
14. **The viewer draws the grid and live routes,** dev-only, so the pathfinding can be seen and taught.
15. **Replays are re-recorded once.** Baking the layout changes what the generator is used for, so every hash moves. Both replays and the 100-seed bot report are recorded before and after, and differences are explained here.
16. **The island becomes Lande de Montclaire** (D-038), the first zone outside the town of Montclaire: a lavender heath. Its ID, name and palette change, and the baked trees become standing stones at the same places and sizes, so the rules see the same obstacles. Its packs, boss, anvil, camp and levels do not change. The town of Montclaire waits for the town brief (no brief yet).
17. **The second zone is a small cave,** kind `dungeon`, reached by a gate at the Lande's edge (the maintainer, 8 Nov 2026). It has an L-shaped wall that a straight walk cannot pass, and one pack of monsters at the Lande's level. Its name waits for the starting region's naming (D-038).

## Scope

**In:**

- The current zone, the live group and the zone record on state.
- Packs, boss, dummy, anvil and camp moved onto zone data, and scenarios trimmed to a start.
- The baking tool, and the island's baked layout.
- Walled ground, the grid, A\* with a binary heap and route smoothing.
- Units following routes, and enemies bound to their zone's grid.
- Gates, crossing, the `zone-changed` event, the fade and scene rebuild.
- Pack respawn on the game clock, and the boss staying dead in the zone record.
- The island renamed Lande de Montclaire, with a lavender heath palette and standing stones, at prototype level (D-030).
- The cave, with its look in `render` at prototype level (D-030).
- Data checks for reachability and placement.
- The viewer's grid and route overlay.
- `docs/DATA-MODEL.md` and `ARCHITECTURE.md` updated.

**Out:**

- The family, characters split from bodies, the triangle by place, item types, seven slots and the store (S3b).
- Saves (S3c).
- The town of Montclaire, NPCs, shops and quests (no brief yet).
- Rebalancing the Lande to levels 4 to 6 (no brief yet).
- Enemy routes (no brief yet, decision 8).
- Bots planning across zones (no brief yet, decision 13).
- Gate requirements and costs that do anything (no brief yet).
- Lands on the world map (no brief yet).
- Showing neighbouring zones as scenery (no brief yet, D-021).

## Done means

1. `pnpm check` passes.
2. Unit tests prove:
   - A\* finds the shortest route round the cave's wall, and a straight walk cannot.
   - A destination inside a wall moves to the nearest walkable cell.
   - An unreachable destination gives up at once.
   - A squad ordered into a gate crosses together, alive or down; one knocked in does not.
   - Crossing during a fight drops the old live group and resets its monsters.
   - A cleared pack returns after its respawn time, both while its zone runs and while the squad is away.
   - The island's boss stays dead after leaving and coming back.
   - Every data check in decision 12 passes, and fails on a deliberately broken zone.
3. The longest route on the island, corner to corner round the beacon, takes under 2 ms in Node on the build machine, and the time is recorded.
4. `pnpm sim:report --seeds 100` finishes as many runs as before for both bots and auto-combat, with no new stalls. Both reports, and the change in run time, are recorded here.
5. Replay hashes change once, for the reasons in decision 15. Before and after are recorded here.
6. `pnpm test:e2e` adds a flow: walk into the cave's gate, see the fade, reach a point behind the wall with one right click, and walk back out.
7. A bot run from start to victory in the real page raises no console errors.
8. Frame rate in the boss fight is measured as in S2.3b and recorded. The slowest 5% of frames stay inside 16.7 ms.
9. `docs/DATA-MODEL.md` moves zone, gate, zone record, live group, pack, grid, A\* and the zone graph to their new status, and `ARCHITECTURE.md` describes the live group.
10. A check on the tracked files and built site finds no secrets, local paths or unintended personal information.
11. The maintainer has approved the exact file list and diff before any commit.
12. CI is green on `master` after the maintainer's approved push.
13. **The maintainer has played it:** start a run on Lande de Montclaire, walk into the cave, order the squad round the wall, clear the pack, leave mid-fight once, come back, and finish the Lande. Questions:
    - Did the squad go where you sent it, without getting stuck?
    - Did crossing a gate feel clear, in and out?
    - Does the Lande read as a lavender heath, at prototype level?

## Stop and ask if

- A\* or the grid makes ticks slow enough that the 100-seed report takes more than twice as long.
- Units following routes change how the island run plays, beyond the hashes: fewer finished runs, or new stalls.
- The live group cannot be split from lasting state without changing a rule.
- Seed 1's layout fails a data check in decision 12, so baking it would mean moving obstacles.
- Any standing trigger in `CLAUDE.md` fires.

## Outcome (builder fills in)

Built on 8 Nov 2026, from `32e0f0f`. Waiting on the maintainer's play (done means 13), approval of the file list and diff (11), and CI on `master` (12).

**Stop trigger fired, and the maintainer chose the fix.** Seed 1's baked layout failed one decision 12 check: a standing stone stood 1.35 units from the centre of the Lande's second pack, at (38, 52), inside the stone's margin. The maintainer chose to move the pack's centre 2 units to (38, 50) and keep the stone (8 Nov 2026). Its monsters still land at random up to 6 units around it.

**Done means:**

| # | Result |
|---|---|
| 1 | `pnpm check` passes: 410 unit tests, lint, typecheck and the `legacy/` guard |
| 2 | All listed unit tests are in `packages/core/test/zones.test.ts` and `movement.test.ts`. The unreachable case uses a ring of rocks with open ground inside |
| 3 | The longest Lande routes, corner to corner round the beacon, take 1.1 to 1.25 ms in Node 24 on an Intel i9-9900K (four corner pairs, averaged over 500 runs each). Building the Lande's grid takes about 33 ms, once |
| 4 | See the reports below. Same finished runs, no stalls, no change in run time |
| 5 | See the hashes below |
| 6 | `e2e/zones.spec.ts`: walk into the cave's gate, see the fade, reach a point behind the wall with one right click, walk back out |
| 7 | The bot run from start to victory in the real page still passes with a clean console. All 21 browser tests pass |
| 8 | Boss fight, headless Chromium on an RTX 2080 Ti at 1280 by 720, seed 1, frame limit off, 20 seconds once the boss wakes, three runs: slowest 5% of frames 3.7 to 4.8 ms, 306 to 413 frames a second. Inside 16.7 ms, and level with S2.3b's 3.9 to 4.0 ms |
| 9 | `docs/DATA-MODEL.md` moves zone, zone record, live group, pack, grid, A\* and the zone graph to Built, and gate to Partial (requirements and costs do nothing yet). `ARCHITECTURE.md` describes the live group, the grid and baking |
| 10 | The changed files and the built site hold no local paths, personal details or secrets |

**100-seed report (done means 4).** Both run on the same machine back to back, the old code from `32e0f0f`:

| | Before | After |
|---|---|---|
| Careful bot | 100 of 100 finished, 0 stalled, 2.5 game minutes, 10.3 upgrades, 576.4 marks left | 100 of 100, 0 stalled, 2.5 minutes, 10.3 upgrades, 551.5 marks |
| Sloppy bot | 100 of 100, 0 stalled, 2.6 minutes, 10.3 upgrades, 500.4 marks | 100 of 100, 0 stalled, 2.6 minutes, 10.3 upgrades, 478.6 marks, 7.8 potions |
| Auto-combat | clear 100 | clear 100 |
| Run time | 170 s | 164 s |

Wipes, characters down, levels and refused orders do not change. Marks left fall by about 22, because the generator no longer places obstacles before the first roll, so every coin and potion roll moves (decision 15). A run takes about 2.5 game minutes, so packs rarely come back before the boss dies. An earlier report took 78 s on a quiet machine; timings here swing with load, which is why both were run back to back.

**Replay hashes (done means 5):**

| Replay | Before | After |
|---|---|---|
| Spell tour | `a54a5595` | `84876bf5` |
| Squad tour | `2937f4ba` | `ccb3ea79` |

Both change for the reasons in decision 15: the generator no longer lays out the island, so every roll moves, and state now holds the current zone, zone records, the live group and each unit's route. The squad tour also walks round stones by route instead of sliding.

**Built:**

- `state.zoneId`, `state.records` (boss dead, and the tick each cleared pack returns) and `state.live` (enemies, shots, enemy shots, scheduled effects, drops). `GameView`'s shape changes with them, as decision 1 planned.
- Zones hold their ground, camp, anvil, obstacles, packs, boss, gates, respawn time and place in the world frame (`packages/core/data/zones.ts`). A scenario names its zone, start and heading, and tests may replace a zone's contents, obstacles included.
- `pnpm bake` (`packages/tools/src/bake.ts`) writes `packages/core/data/lande-layout.ts`. It matches seed 1's old layout exactly, with trees as stones, and a test proves the committed file matches the tool.
- `packages/core/src/grid.ts`: the grid, connected areas, line of sight, A\* with a binary heap, smoothing, and nearest walkable point. `packages/core/src/zones.ts`: entering a zone, returns, kills noted in the record, and crossing. `packages/core/src/checks.ts`: the decision 12 checks.
- The cave, `lande-cave`, kind `dungeon`: 80 by 56 units, with an L-shaped wall and one level 4 pack of two Tide Crabs and three Sand Skitters. Its gate is at its south-west corner, and the Lande's gate to it is about 19 units south-west of camp.
- Render: the lavender heath palette, standing stones, the cave's floor and walls, and a pillared gate with a glowing ring. App: a 0.3 second fade out with the game held, then a 0.45 second fade in, a banner and log line on arrival.
- Viewer: a checkbox draws the grid (closed cells red, cells only enemies may use amber) and each unit's live route as a dashed line through its corners.

**Found while building, for the maintainer to confirm:**

- Enemies read only the grid's ground and walls, and still slide round stones by being pushed out of them. Closing stone cells to enemies too would stick a monster that chases in a straight line against the first stone it meets (decision 8).
- A step onto a closed cell is refused, except from a closed cell, so a unit pressed into a stone's margin can always walk away.
- A unit's place in the triangle, or in a line, is pulled in short of any wall or stone between it and the clicked point, so nobody is sent the long way round to a slot on the far side of a wall.
- Progress towards an order is measured along the route, so walking away from the goal to round a wall does not count as stuck. The 0.7 second give-up still applies when something holds a unit in place.
- Gate areas are circles. Each zone has its own camp, so a wipe in the cave returns the squad to the cave's mouth.
- Grids are built the first time a zone runs and kept in memory, not rebuilt on every entry. They are the same every time, so this changes nothing a player sees.
- In the cave, the HUD's objective drops the anvil and beacon, and the dust motes are left out, because against the dark they looked like stars.
- The browser test of a right click at four rotations expected the triangle's centre exactly under the click. A click beside a stone or the waystone now moves to the nearest walkable cell (decision 7), so the test allows up to 3.5 units there.
- Under heavy load on the build machine, the 100-seed auto-combat test and one core lint test ran past their timeouts once, then passed. The auto-combat test was already close to its 60-second limit: 51 s on the old code and 42 s on this build, on the same machine.
- The Ctrl + left click browser test failed once in a full run under load, then passed three times alone. It reads attack-move flags two ticks after a click, and is noted as a possible flake.
