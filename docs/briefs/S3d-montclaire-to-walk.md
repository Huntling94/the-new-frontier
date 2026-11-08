# Brief S3d — Montclaire to walk

**Status:** agreed 8 Nov 2026, after a refresh for what S3c built.
**Read first:** `STATE.md`, `ARCHITECTURE.md`, `docs/DATA-MODEL.md`, briefs S3a and S3c, D-021, D-022, D-023, D-030, D-038, D-039, D-043.
**Depends on:** S3c closed.
**Goal:** the maintainer starts a new game in the town of Montclaire, walks the squad through its streets and plaza, with no building ever hiding them, and leaves by the gate onto Lande de Montclaire.

## Why now

The game starts in a field, and the only town is a name in D-038. Every system still to come in S3, from the smith and the shop to trainers and quest givers, lives in a town (D-011, D-039). The maintainer chose to build the town first as a place to walk, then add one system at a time (D-043). This slice also tests the riskiest parts of a town before any system depends on them: narrow streets for a squad that walks in a triangle, and buildings that block a camera that turns freely.

## Decisions

1. **Montclaire is a zone of kind `town`** (D-021) whose ground is its streets (the maintainer chose angled streets, 8 Nov 2026). A third ground shape, `streets`, joins the island and the walled rectangle (S3a decision 5): walkable ground is every point inside a street shape in the rules data, either a street (a centreline through a few points, so it can bend, and a width) or an open place such as the plaza (an outline of points). Streets need not be straight, and the plaza has an oval feel rather than a perfect oval, with straight stretches where buildings push in (the maintainer, 8 Nov 2026). Like the island's coast, the shapes become the grid, so A\* and route smoothing work unchanged (D-023), and angled or bending streets need no stepped edges. The rules store only numbers for the shapes, so they compute no sine or cosine. It has no packs, no boss and no dummy, so no fight can happen there.
   - **Buildings are look, not rules** (D-022). `render` fills the ground the streets leave with buildings, so a building can never block a street the rules allow. A place kept for a later system is a **lot** in the rules data: an ID (`smithy`, `shop`, `inn`), a door point on a walkable cell where that system's NPC will stand, and the way the door faces. This adds the `streets` ground and a lots field to `ZoneData`, a deliberate change to the core's interface (D-019), and rows for street and lot in `docs/DATA-MODEL.md`.
2. **The layout is hand-placed and frozen** (D-022), agreed on 8 Nov 2026 from the maintainer's sketch. Montclaire is 120 by 120 units. A plaza with an oval feel, about 82 by 32 with the fountain at its centre, sits in the north. A left street runs about 52 units down from the plaza's lower left, leaning slightly west. A right street runs about 40 units from its lower right towards five o'clock. A bottom street, about 105 units, joins their lower ends, rising to the east. The gate street drops about 30 units straight south from the bottom street, a third of the way along from the west, to the gate. The loop is the ring of plaza, left, bottom and right streets, with a large block inside it. The maintainer will revisit the layout later; this is a start. The builder shows the maintainer this plan in the viewer, with the grid drawn, before any `render` work.
3. **Streets fit the triangle** (the maintainer, 8 Nov 2026). The two back places of the triangle walk 4.6 units either side of its centre, and the grid closes 0.7 units inside every wall, so the triangle needs about 10.6 units to pass unsqueezed. The main street and the loop are at least 12 units wide, side streets at least 10, and the plaza at least 24 across. S3a already pulls a slot in short of a wall, and that stays the fallback.
4. **Lots are kept for the systems to come** (D-043, the maintainer, 8 Nov 2026): the smithy and the shop on the left street, facing it from the central block, and the inn beside the gate street. Each is a closed building with a sign in `render` only. Nothing inside them works yet. Their places are data, so the smith's brief (S3e) puts the smith at the smithy without moving anything.
5. **Two gates, one each way** (D-021, D-038): Montclaire's edge to a new arrival point on the Lande near its camp (proposed about 20 units south-east of camp, mirroring the cave gate to the south-west, and shown on the plan), and a new gate on the Lande back to Montclaire. Both have empty requirements and no cost. The Lande's cave gate, packs, boss, camp and anvil do not move.
6. **A player's new game starts in Montclaire** (S3b decision 2, D-043, the maintainer, 8 Nov 2026): a new `TOWN_SCENARIO` becomes the real game's start, at the plaza. `ISLAND_SCENARIO` stays as it is. A page with `?bot=` or `?test` keeps starting on the Lande, unless a test page's address also has `?town`, which only the new browser flow uses. So the existing browser tests do not change. The start screen's slow circle round the world gets a closer orbit for the town.
7. **Replays, bots and the 100-seed report keep starting on the Lande** through `ISLAND_SCENARIO`, `EMPTY_SCENARIO` and `DUMMY_SCENARIO`, so every tick of every run is unchanged. A bot run in the real page (`?bot=careful`) also starts on the Lande. Bots that walk to town arrive with the smith (S3e), where a reason to walk there first exists.
   - **The replay hashes still move** (the maintainer, 8 Nov 2026). Every game holds one zone record per zone, and the hash covers all of state, so Montclaire's empty record changes both hashes. As in S3c, every tick's commands, events and character stats are recorded for both replays and 20 seeds each of the careful bot, the sloppy bot and auto-combat, on the old code and the new. The 62 runs must match, and then the two hashes are updated as a deliberate edit.
8. **The theme follows the 2019 game's feel** (D-038, D-043): a Provençal market town to match the Lande's lavender heath. Pale limestone walls, terracotta roofs, cobbled streets, a fountain in the plaza, plane trees and lavender in planters. Prototype level (D-030): boxes, roofs and simple props, composed with care. Props that block movement are in the rules data. Props that do not are in `render`.
9. **Buildings fade when they hide the squad** (D-043). Each frame, any building between the camera and a living character in the active three fades to about 30% opacity, and back once it is clear. This is called occlusion handling. It is `render` only, so it changes no rule and no event.
10. **Saves need no migration, and stay at version 1.** A new zone is a new ID, and the starting zone matters only to new games. `fromSave` already gives any zone the save does not name a fresh record, so a version 1 save made on the Lande, or the frozen example in the cave (`packages/core/test/saves/v1.json`), loads and plays as before (S3c). A save made in Montclaire is an ordinary version 1 save. `packages/core/src/migrations.ts` does not change.
11. **In town, the HUD's objective reads "Head out to Lande de Montclaire",** and `Space` has nothing to fight, so auto-combat stops at once with its cleared-zone message (D-036). The fade, banner and log line on crossing are S3a's.

## Scope

**In:**

- The Montclaire zone, its baked layout and the two gates.
- The `streets` ground shape and lots in `ZoneData`.
- The town's look in `render`, at prototype level, with the building fade.
- `TOWN_SCENARIO` as the real game's start.
- The viewer showing the town's grid.
- `docs/DATA-MODEL.md` (town, street and lot, and their status) and `ARCHITECTURE.md` (the building fade, if `render` gains a new part for it).

**Out:**

- NPCs, talking, the smith and the anvil's move to town (S3e).
- Shops, buying and selling, and the inventory changes after S3b (S3f).
- Trainers and arts beyond each class's first (no brief yet).
- Bots planning a route across zones (S3e).
- Respawning in town after a wipe (no brief yet). A wipe still returns the squad to the camp of the zone it fell in.
- Names for streets, buildings and townsfolk (the naming session, no brief yet).
- Art beyond prototype level (S5, D-030).

## Done means

1. `pnpm check` passes.
2. Unit tests prove:
   - S3a's data checks (rule 6 in `docs/DATA-MODEL.md`) pass with Montclaire in the world: it is reachable, both gates arrive on walkable cells, and the start stands on one.
   - Every street and the plaza are as wide as decision 3 sets, measured on the grid, and every lot's door stands on a walkable cell.
   - The loop exists: with the left street closed in a test copy of the town, the squad still reaches the gate from the plaza by the right and bottom streets.
   - A squad ordered from the plaza to the gate, and to each end of each street, arrives without a `unit-gave-up` event.
   - A version 1 save made on the Lande, and the frozen example in the cave, load and play on unchanged, with Montclaire given a fresh record. A save made in Montclaire loads back in Montclaire.
3. The 62 runs of decision 7 match the old code tick for tick, and the 100-seed report matches S3c's Outcome. The two replay hashes move only because state holds Montclaire's record, and the Outcome records old and new.
4. `pnpm test:e2e` adds a flow: start a new game, see Montclaire, walk to the gate, cross onto the Lande, walk back in.
5. Frame rate in the plaza, with the camera turning through a full circle, is measured as in S3a and recorded. The slowest 5% of frames stay inside 16.7 ms.
6. `docs/DATA-MODEL.md` moves town to Built, adds Montclaire to the zone row, and adds street and lot.
7. A check on the tracked files and built site finds no secrets, local paths or unintended personal information.
8. The maintainer has approved the exact file list and diff before any commit.
9. CI is green on `master` after the maintainer's approved push.
10. **The maintainer has played it:** start a new game, walk every street, turn the camera behind buildings, leave for the Lande and come back. Questions:
    - Does Montclaire feel like a town you would come back to?
    - Did a building ever hide the squad, or did the squad ever get stuck or bunch up in a street?
    - Is the gate out obvious?

## Stop and ask if

- The maintainer has not approved the top-down plan before `render` work starts (decision 2).
- A street that fits the plan cannot be made as wide as decision 3 sets.
- The building fade needs anything from the core, or changes any event.
- Any of the 62 runs differs from the old code in any tick (decision 7), or the hashes move for any reason other than Montclaire's record.
- Saves need a change to their data, which would mean a migration step (decision 10).
- Any standing trigger in `CLAUDE.md` fires.

## Outcome (builder fills in)
