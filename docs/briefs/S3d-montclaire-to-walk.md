# Brief S3d — Montclaire to walk

**Status:** draft.
**Read first:** `STATE.md`, `ARCHITECTURE.md`, `docs/DATA-MODEL.md`, briefs S3a and S3c, D-021, D-022, D-023, D-030, D-038, D-039, D-043.
**Depends on:** S3c closed.
**Goal:** the maintainer starts a new game in the town of Montclaire, walks the squad through its streets and square, with no building ever hiding them, and leaves by the gate onto Lande de Montclaire.

## Why now

The game starts in a field, and the only town is a name in D-038. Every system still to come in S3, from the smith and the shop to trainers and quest givers, lives in a town (D-011, D-039). The maintainer chose to build the town first as a place to walk, then add one system at a time (D-043). This slice also tests the riskiest parts of a town before any system depends on them: narrow streets for a squad that walks in a triangle, and buildings that block a camera that turns freely.

## Decisions

1. **Montclaire is a zone of kind `town`** (D-021), a walled rectangle like the cave (S3a decision 5). Buildings are axis-aligned boxes in its rules data, so the grid, A\* and route smoothing work unchanged (D-023). It has no packs, no boss and no dummy, so no fight can happen there.
2. **The layout is hand-placed and frozen** (D-022), and agreed before the look is built. It has one main street from the gate to a central square, at least two side streets, and one loop, so the squad can walk round a block rather than only up and back. The builder shows the maintainer a top-down plan in the viewer, with the grid drawn, before any `render` work. Proposed size: about 100 by 80 units.
3. **Streets fit the triangle.** Every street is at least 8 units wide and the square at least 24 across, so the formation passes without being pulled in at every step. S3a already pulls a slot in short of a wall, and that stays the fallback.
4. **Lots are kept for the systems to come** (D-043): a smithy, a shop and an inn, each a closed building on the square or the main street, with a sign in `render` only. Nothing inside them works yet. Their places are data, so the smith's brief (S3e) puts the smith at the smithy without moving anything.
5. **Two gates, one each way** (D-021, D-038): Montclaire's edge to a new arrival point on the Lande near its camp, and a new gate on the Lande back to Montclaire. Both have empty requirements and no cost. The Lande's cave gate, packs, boss, camp and anvil do not move.
6. **A new game starts in Montclaire** (S3b decision 2, D-043): a new `TOWN_SCENARIO` becomes the real game's start, at the square. `ISLAND_SCENARIO` stays as it is.
7. **Replays, bots and the 100-seed report keep starting on the Lande** through `ISLAND_SCENARIO`, `EMPTY_SCENARIO` and `DUMMY_SCENARIO`, so every tick of every run is unchanged. A bot run in the real page (`?bot=careful`) also starts on the Lande. Bots that walk to town arrive with the smith (S3e), where a reason to walk there first exists.
8. **The theme follows the 2019 game's feel** (D-038, D-043): a Provençal market town to match the Lande's lavender heath. Pale limestone walls, terracotta roofs, cobbled streets, a fountain in the square, plane trees and lavender in planters. Prototype level (D-030): boxes, roofs and simple props, composed with care. Props that block movement are in the rules data. Props that do not are in `render`.
9. **Buildings fade when they hide the squad** (D-043). Each frame, any building between the camera and a living character in the active three fades to about 30% opacity, and back once it is clear. This is called occlusion handling. It is `render` only, so it changes no rule and no event.
10. **Saves need no migration.** A new zone is a new ID, and the starting zone matters only to new games. A version 1 save made on the Lande, or in the cave, loads and plays as before (S3c).
11. **In town, the HUD's objective reads "Head out to Lande de Montclaire",** and `Space` has nothing to fight, so auto-combat stops at once with its cleared-zone message (D-036). The fade, banner and log line on crossing are S3a's.

## Scope

**In:**

- The Montclaire zone, its baked layout and the two gates.
- The town's look in `render`, at prototype level, with the building fade.
- `TOWN_SCENARIO` as the real game's start.
- The viewer showing the town's grid.
- `docs/DATA-MODEL.md` (town and its status) and `ARCHITECTURE.md` (the building fade, if `render` gains a new part for it).

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
   - Every street and the square are at least 8 units wide on the grid, and the loop exists: from the square, two routes to the gate share no street.
   - A squad ordered from the square to the gate, and to the far end of each street, arrives without a `unit-gave-up` event.
   - A version 1 save made on the Lande loads and plays on unchanged.
3. Replays, the bot runs and the 100-seed report match S3c's Outcome tick for tick, because they start on the Lande (decision 7). Hashes do not change.
4. `pnpm test:e2e` adds a flow: start a new game, see Montclaire, walk to the gate, cross onto the Lande, walk back in.
5. Frame rate in the square, with the camera turning through a full circle, is measured as in S3a and recorded. The slowest 5% of frames stay inside 16.7 ms.
6. `docs/DATA-MODEL.md` moves town to Built and adds Montclaire to the zone row.
7. A check on the tracked files and built site finds no secrets, local paths or unintended personal information.
8. The maintainer has approved the exact file list and diff before any commit.
9. CI is green on `master` after the maintainer's approved push.
10. **The maintainer has played it:** start a new game, walk every street, turn the camera behind buildings, leave for the Lande and come back. Questions:
    - Does Montclaire feel like a town you would come back to?
    - Did a building ever hide the squad, or did the squad ever get stuck or bunch up in a street?
    - Is the gate out obvious?

## Stop and ask if

- The maintainer has not approved the top-down plan before `render` work starts (decision 2).
- A street that fits the plan cannot be made 8 units wide.
- The building fade needs anything from the core, or changes any event.
- Keeping replays and bots on the Lande changes any hash (decision 7).
- Any standing trigger in `CLAUDE.md` fires.

## Outcome (builder fills in)
