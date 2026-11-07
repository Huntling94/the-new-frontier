# State

**Pickup point. Keep under 8 KB.**

## Now

Stage S2, Foundation. S1, S2.1, S2.2a, S2.2b and S2.2c are closed: the whole squad-test game runs with no browser, from the first camp to the boss, with loot, wipes, victory and auto-combat. Careful and sloppy bots play it through commands, through `pnpm sim` and `pnpm sim:report`. The dev-only viewer at `/viewer.html` plays replays and live bots on a 2D map. An empty island is still what the public page shows, unlinked. S2.3 is drafted.

## Next

1. Agree what the design session on the build and world proposes.
2. Agree brief S2.3, then build it.

## Open

- The last two classes (D-006).
- The bots never struggle: no wipes or characters down across 100 seeds. Balance has no brief yet, and the maintainer's own play in S2.3 will show how hard the boss is.
- Units have no pathfinding, so dungeons will need it. Enemies do not know their zone, and saves have no version number. All three are with the design session.
- Graphics need a big step up, after the base game works. No brief yet. D-019 keeps the renderer replaceable.
- Replays match in Node only. Browsers round `sin`, `cos` and `atan2` slightly differently, so a replay recorded in a browser will not reproduce exactly in Node. Decision 13 of S2.2a allows this. It matters if a later brief wants browser runs checked on CI.

## Bugs

None open.
