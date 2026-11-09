# Brief S3i — Moving through narrow ground

**Status:** agreed 9 Nov 2026
**Read first:** `STATE.md`, `ARCHITECTURE.md`, `docs/DATA-MODEL.md`, briefs S3a and M2 (its Outcome), D-023, D-059.
**Depends on:** M2 built. It does not depend on S3g or S3h, and touches none of their work.
**Goal:** in Garganta da Cidadela, the squad walks every route with no character giving up, and monsters follow the squad round the canyon's bends instead of standing against the rock.

## Why now

M2 is the first zone with bends and pinches, and it found two faults. Both block M2 from closing (the maintainer, 9 Nov 2026).

- **A character can wedge on a rock tip and give up.** On one south-to-north trip with slightly varied clicks, 102 of 150 runs gave up at the outline's corner at (-29, 49). Across 300 varied trips over the zone, 6 did, at (0, 29). M2's browser walk through the sliver is marked `test.fixme` because of it.
- **Monsters stick on canyon rock.** They chase in straight lines (S3a decision 8). In 18 of 24 chases round a bend, at least one monster stood still for about 17 to 24 of 25 seconds, 16 to 67 units from the squad. It stays awake while stuck, and an awake monster refuses equipping and holds off autosave until the squad leaves the zone.

**The cause of the first fault is known.** A character following a route drops a corner as soon as it is within 0.6 of it (`ROUTE.cornerReach`), without checking that the next leg is clear from where it actually stands. Its next step then runs into closed cells, it slides along the rock into a notch, and it stops making progress. A tick-by-tick trace shows this at (-29, 49). Moving that corner of the outline only moved the problem, so the fix belongs in movement, not the map.

## Decisions

**Settled before agreeing** (the maintainer, 9 Nov 2026)

- **This only needs to work.** Movement belongs to the rules, which outlast the move to better graphics (D-019, D-030). This brief changes no look, and adds nothing beyond what the two faults need.
- **The Lande's bot runs may change.** The corner fix changes how every character walks, so the 62 runs cannot match the old code tick for tick. On a trial copy, both replays stayed identical, and 37 of the 60 bot runs changed length, by 933 ticks in all out of 192,953, or 15 net. Decision 8 replaces the tick-for-tick test for that step.
- **Monsters keep chasing as they do today,** until one side is dead or the squad leaves the zone. A limit on the chase is a balance question for later.

**Characters**

1. **A route corner is dropped only when the next leg is clear from where the character stands** (D-023). Being near the corner no longer drops it. This is one condition in `steer`, in `packages/core/src/movement.ts`. On a trial copy of `core` it took both counts above to 0, and every narrow-stretch walk in M2's list still arrived.
2. **The give-up rule does not change.** A character still gives up after 0.7 seconds with no progress. This brief removes a cause, and does not hide the symptom by waiting longer.

**Monsters**

3. **A monster takes a route only when a straight line to its target is blocked (D-060, new).** This replaces S3a decision 8. It finds the route with the same A\* and smoothing the squad uses (D-023), and follows it as a character does, with decision 1's rule.
4. **What counts as blocked is the enemy's own ground.** The line is tested on cells a monster may stand on, so a monster still slides round a stone by being pushed out of it, as S3a chose. Stones do not start a route, so the open fields should not change.
5. **A route is found again only when the target has moved more than `ROUTE.goalDrift`, and no more than twice a second for each monster.** A pack shares the work of a chase rather than repeating it every tick. The numbers are starting points, and go in `packages/core/data/movement.ts`.
6. **The boss does not change.** It still walks through what it meets. No boss is in play (D-052).
7. **A route belongs to the live group,** so it is never saved and saves need no migration (S3d decision 10).

**Proving it**

8. **The change lands in two steps, each with its own proof.**
   - Step 1, the corner rule. Bot runs may differ from the old code, and the two replays should not, as on the trial copy. Every bot run still finishes, none stalls, and the 100-seed report is recorded beside M2's with any difference explained.
   - Step 2, monster routes. Against step 1, the 62 runs match tick for tick, with the new route fields left out of the comparison, because no open-field monster should take a route. Any run that differs is a stop and ask.

## Scope

**In:**

- The corner rule for characters.
- Routes for monsters when a straight line is blocked.
- A varied-trip test of Garganta da Cidadela, so a hand-picked walk cannot hide a wedge again.
- M2's browser walk through the sliver, back on.
- D-060 in the register, and `docs/DATA-MODEL.md`.

**Out:**

- Monsters giving up a chase (no brief yet).
- Squad formation changes in narrow ground, such as a deliberate single file. D-059 allows the triangle to break, and it breaks well enough (no brief yet).
- Changes to Garganta da Cidadela's layout (M2, frozen).
- Monster types, balance and level tuning (no brief yet).
- M2's play-through and closing note, which follow this brief (M2).

## Done means

1. `pnpm check` passes.
2. Unit tests prove:
   - Across at least 300 varied trips over Garganta da Cidadela, covering every route in M2's appendix each way, no character gives up. The trips are seeded, so a failure repeats.
   - The (-29, 49) trip that gave up in 102 of 150 runs now gives up in none.
   - A character near a corner whose next leg is blocked keeps the corner.
   - In the 24 chases M2 measured, no awake monster out of reach stands still for more than 3 seconds.
   - A monster with a clear straight line takes no route, and a stone alone does not start one.
3. Decision 8's two steps are met, and the Outcome records both 100-seed reports and any hash that moves, with why. New route fields on monsters are expected to move both hashes in step 2.
4. `pnpm test:e2e` passes with M2's walk through the sliver back on.
5. Frame rate as in S3a, with every pack in Garganta da Cidadela awake and chasing. The slowest 5% of frames stay inside 16.7 ms.
6. `docs/DATA-MODEL.md` is updated, and D-060 is in the register.
7. A check on the tracked files and built site finds no secrets, local paths or unintended personal information.
8. The maintainer has approved the exact file list and diff before any commit.
9. CI is green on `master` after the maintainer's approved push.
10. **The maintainer has played it:** in Garganta da Cidadela, wake a pack, then walk round a bend and through the sliver. Does anyone get left behind, and do the monsters reach the squad?

## Stop and ask if

- The corner rule makes any bot run stall or fail to finish, or a character walk visibly worse in open ground.
- Any of the 62 runs differs in step 2.
- A character still gives up on rock after the corner rule. A second cause would need its own look.
- Monsters jam in a corridor so that a pack cannot reach the squad. That would raise how monsters queue, which this brief does not plan.
- The frame rate in Done means 5 is missed.
- Saves need a change to their data.
- Any standing trigger in `CLAUDE.md` fires.

## Outcome (builder fills in)

Departures, bugs found, final numbers, and the closing note.
