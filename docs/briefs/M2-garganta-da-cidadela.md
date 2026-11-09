# Brief M2 — Garganta da Cidadela

**Status:** agreed 9 Nov 2026
**Read first:** `STATE.md`, `ARCHITECTURE.md`, `docs/DATA-MODEL.md`, briefs S3a, S3d and M1, D-021, D-022, D-023, D-030, D-038, D-050, D-052, D-057, D-058.
**Depends on:** M1 closed. It does not depend on S3g or S3h, and touches none of their work.
**Goal:** the maintainer leaves Carrefour du Colosse by its west gate, arrives at the south end of a narrow canyon, and fights north up the corridor to a causeway across a lake, ending at the closed door of a walled citadel.

## Why now

Carrefour du Colosse ends at a closed door, so the world stops at two fields. Farming (D-053) needs a next step in levels, and the first dungeon needs a way to reach it. Every field so far has been open ground. This one is a corridor, so it also tests something the game has not tried: a squad that has to go single file.

## Decisions

**Settled before agreeing** (the maintainer, 9 Nov 2026)

- **The layout is original.** The maintainer drew the sketch this brief is traced from, and confirmed on 9 Nov 2026 that it is the maintainer's own design (D-038).
- **The names.** The zone is Garganta da Cidadela, "throat of the citadel" in Portuguese. The dungeon is Cidadela do Lago, "citadel of the lake" (D-038).
- **The width,** as in decision 3, and the crater at H7, a shallow dip in the range that cannot be reached.
- **The ways in and out.** Carrefour du Colosse's west road leads into this zone's south end, the north is the dungeon, and the north-east is the gate to the falls, as in decisions 7 and 8. Gates need not match a compass, so a west road can arrive at a south end.
- **The levels** are 11 to 14 for now, starting from Carrefour's top level of 11. They are starting points, to be tuned.
- **The look** matches Carrefour du Colosse, as in decisions 6 and 11.

**The zone**

1. **Garganta da Cidadela is a zone of kind `field`** (D-021), the third in the starting region, between Carrefour du Colosse, the first dungeon and the falls. There are no bosses for now (D-052), so `boss` is null.
2. **The footprint is the 240 by 240 default** (D-057). The walkable ground is much smaller than Carrefour's, about 5,900 square units against 14,000, because this zone is a corridor. The way from the south gate to the citadel door is about 246 units, and the branch from the junction to the falls about 168.
3. **The canyon is the sketch's trace, widened by 2 units each side, with the large pillar moved east** (the maintainer, 9 Nov 2026). The appendix holds the result.
4. **Stretches may be narrower than the squad's triangle (D-059, new).** The squad need not keep its triangle, and going single file through a narrow stretch is fine (the maintainer, 9 Nov 2026). This replaces the width rule M1 applied to its own road, for this zone and those after it. Every stretch of a route here is at least 4 units wide in any direction, as the appendix shapes measure. The narrowest is 4.3, between the pillars. Stretches 10.6 or wider still fit the triangle.
5. **It uses the `basin` shape from M1,** with no new kind of ground. The layout is hand-placed and frozen (D-022). The builder shows the maintainer the plan in the viewer, with the grid drawn, before any `render` work.
6. **Height is look only** (D-022), and the height treatment is M1's: flat floor, with the ranges built the same way and to the same heights. The fortress walls and lake sit outside the outline, so they are `render` only. The ranges are highest beside the lake and lower to the south.

**Ways in and out**

7. **Carrefour du Colosse leads to the south end** (the maintainer, 9 Nov 2026). Its closed west door becomes a pair of gates, with empty requirements and no cost. This changes M1's look at that spot and the test that says the door is off the rules' ground, and the Outcome records both. Pack 8 of Carrefour stands near the door at (-95, 25), so the plan shows the arrival point clear of it.
8. **The dungeon and the falls do not exist yet,** so each end is closed by look only, with no gate (M1 decision 6). The citadel door is in the gap in the fortress wall, at the north end of the causeway. The falls end is at the top of the east spur, in the north-east. Each becomes a real gate when the zone behind it is built.

**What lives there**

9. **Four packs, placed by hand** (D-022, the maintainer, 9 Nov 2026), in the wider stretches, as in the appendix. Narrow stretches are for passing through, not fighting in.
10. **They are the four S3f monsters for now.** New types and families wait for their own brief (D-050). Respawn is the same 180 seconds.
11. **The look is prototype level** (D-030) **and matches Carrefour du Colosse** (the maintainer, 9 Nov 2026): the same dry limestone, grey ranges, pale lake, light and feel, reusing M1's materials. The canyon opens onto that lake, with a pale causeway and a dark fortress wall as the only new pieces. The maintainer approves the look in the running game before this brief closes (D-058). Art beyond prototype level is S5.

**What stays the same**

12. **Bots, replays and the 100-seed report still run on the Lande.** The new zone and gates are new records in state, so both replay hashes move, as in M1. The same 62-run comparison proves nothing else did.
13. **Saves need no migration.** A new zone is a new ID, and any zone a save does not name gets a fresh record (S3d decision 10).

## Scope

**In:**

- The zone, its frozen layout, its packs and its gates, plus the matching gate at Carrefour du Colosse.
- The zone's look in `render`, at prototype level, and the closed citadel door and falls end.
- D-059 in the register, and the zone named in `docs/DATA-MODEL.md`.

**Out:**

- Cidadela do Lago itself (no brief yet).
- The falls and the zones beyond them (no brief yet).
- Any boss (D-052, no brief yet).
- New monster types (no brief yet).
- Drops and the shop (S3g), and farming while away (S3h).
- Height that affects the rules (no brief yet).
- Art beyond prototype level (S5, D-030).

## Done means

1. `pnpm check` passes.
2. Unit tests prove:
   - The world data checks (rule 6 in `docs/DATA-MODEL.md`) pass with the new zone and it can be reached both ways.
   - Every monster's spawn spot in every pack is walkable, as M1's review required.
   - The lake, fortress walls, sliver, island and pillars are not walkable.
   - Every stretch in the appendix's table is at least as wide as decision 4 sets, measured in any direction.
   - The squad, ordered from the south gate to the citadel door, to the falls end and to the pocket behind the pillars, arrives with no `unit-gave-up` event, by each side of the sliver.
   - The squad can start a fight at each pack, and carry on walking after it.
   - A save from before this zone loads and plays. A save made in the zone loads back in it.
3. The 62 runs of decision 12 match the old code tick for tick, and the 100-seed report matches M1's Outcome. The hashes move only because of the new records, and the Outcome records old and new.
4. Building the grid and finding the longest route are timed and recorded. A route from the south gate to the citadel door takes under 2 ms, on the machine and method S3a used.
5. `pnpm test:e2e` adds a flow: cross from Carrefour du Colosse, walk north through the sliver, cross back.
6. Frame rate with every pack alive and the camera turning, as in S3a. The slowest 5% of frames stay inside 16.7 ms.
7. `docs/DATA-MODEL.md` names the zone, and D-059 is in the register.
8. A check on the tracked files and built site finds no secrets, local paths or unintended personal information.
9. The maintainer has approved the exact file list and diff before any commit.
10. CI is green on `master` after the maintainer's approved push.
11. **The maintainer has played it:** cross from Carrefour du Colosse, fight north up the corridor, go out along the causeway, then come back and take the east branch to the falls end. Questions:
    - Does it look good enough to close this zone?
    - Does going single file through the sliver and the pillars feel right, or clumsy?
    - Is there enough room to fight, and enough to fight?
    - Does the causeway feel like arriving somewhere?

## Stop and ask if

- The maintainer has not approved the plan before `render` work starts (decision 5).
- The squad gives up, or takes more than about twice the straight walking time, in a stretch under 10.6 wide. The rules have only been proven on small squeezes (S3d), so this may need a change to movement, which this brief does not plan.
- Monsters get stuck on the canyon's rocks and walls while chasing. They chase in straight lines and slide round stones (S3a decision 8), and this zone may be where they need real routes. That would be its own brief.
- The time in Done means 4 or the frame rate in Done means 6 is missed.
- Any of the 62 runs differs from the old code in any tick, or the hashes move for any reason other than the new records.
- Saves need a change to their data, which would mean a migration step.
- Any standing trigger in `CLAUDE.md` fires.

## Appendix: the layout

Game units, centred on (0, 0), with x running east and z running south. One sketch square is 20 units. Traced by eye, then widened as in decision 3.

**Canyon outline:** (-19, -120), (-19, -104), (-24, -104), (-16, -95), (-16, -60.5), (-32.5, -60), (-31, -44.5), (-20, -34.5), (-15.5, -17.5), (-13.5, 7), (-15.5, 18.5), (-21.5, 23), (-33, 28.5), (-40.5, 36), (-40, 51.5), (-32, 63.5), (-16.5, 72.5), (-4.5, 81), (-0.5, 90), (-0.5, 104), (11.5, 104), (13, 98.5), (11, 80), (2, 69), (-9.5, 61.5), (-23, 55.5), (-29, 49), (-27.5, 41), (-1, 29.5), (4, 35), (5.5, 40), (9.5, 47.5), (20.5, 51.5), (34.5, 48), (50, 50.5), (62.5, 42), (64, 34), (59, 24), (54.5, 7), (55, -4.5), (63, -11.5), (73, -18.5), (70, -27.5), (77, -35), (73, -42), (64.5, -41), (61.5, -32.5), (50, -11.5), (46, -1), (46, 12), (48.5, 24), (44.5, 31), (38.5, 33), (34.5, 24), (33.5, 9.5), (26.5, 6), (22, 12.5), (17.5, 10), (9, 11.5), (9.5, 18), (13, 23), (10, 23.5), (2.5, 20), (0, 13), (-1, 4), (-4, -10.5), (-3.5, -27.5), (0, -43.5), (9, -53.5), (9, -60.5), (-6, -60.5), (-6, -95), (2.5, -104), (-2.5, -104), (-3, -120)

**Lake, look only, beyond the outline:** (-33, -103), (-21, -104), (-3, -104), (12, -103), (21, -88), (24, -78), (22, -70), (16, -60), (7, -56), (-26, -56), (-33, -56), (-42, -64), (-46, -73), (-47, -83), (-42, -94)

**Fortress walls, look only, beyond the outline:**

| Name | Points |
|---|---|
| West wall | (-72, -72), (-72, -82), (-63, -98), (-50, -109), (-33, -117), (-19, -120), (-19, -104), (-33, -103), (-42, -94), (-47, -83), (-46, -72) |
| East wall | (-3, -120), (14, -120), (27, -113), (40, -104), (48, -82), (48, -73), (24, -74), (21, -88), (12, -103), (-2, -104) |

**Blocked outlines:**

| Name | Points |
|---|---|
| Sliver | (-8, 7.5), (-5, 14.5), (-5, 21), (-9, 21), (-10, 17) |
| Rock island | (-13, 24.5), (-8, 22), (-4, 23), (-5, 27), (-10.5, 29), (-14, 27) |
| Left pillar | (11, 28), (17, 26), (18, 39.5), (14.5, 44), (11, 41.5), (9.5, 34.5) |
| Large pillar | (22, 24.5), (31, 22), (37, 29.5), (36, 37), (29, 40), (22.5, 38) |

**Routes:**

- South gate to the citadel door: (6, 101), (5, 87), (-4, 74), (-18, 66), (-30, 58), (-34, 44), (-34, 37), (-26, 30), (-17, 24), (-13, 18), (-12, 8), (-9, 0), (-9, -16), (-10, -36), (-10, -50), (-11, -60), (-11, -96), (-11, -117)
- Junction to the falls end: (-9, 0), (-4, 12), (-2, 22), (6, 28), (8, 38), (21, 44), (40, 40), (54, 34), (52, 20), (50, 7), (54, -8), (63, -18), (69, -36)
- Pocket behind the pillars: (21, 44), (20, 37), (20, 27), (22, 18)

**Widths, measured on these shapes:**

| Stretch | Width |
|---|---|
| South canyon | 12.2 |
| Corridor | 10.7 |
| West arm | 10.3 |
| Causeway | 10.0 |
| Below the pillars | 8.8 |
| East spur | 7.0 |
| North of the rock island | 6.7 |
| East of the sliver | 5.1 |
| West of the sliver | 5.0 |
| Beside the left pillar | 4.8 |
| Between the pillars | 4.3 |

**Gates and ends:** gate at about (6, 101), arrival about (5, 92) facing north. Closed citadel door at about (-11, -117). Closed falls end at about (69, -36).

**Packs, proposed:**

| Pack | About where | Level |
|---|---|---|
| 1 | (-4, 74), the south canyon | 11 |
| 2 | (-35, 45), the west arm | 12 |
| 3 | (40, 41), below the pillars, on the way to the falls | 13 |
| 4 | (-11, -50), the foot of the causeway | 14 |

## Outcome (builder fills in)

Departures, bugs found, final numbers, and the closing note.
