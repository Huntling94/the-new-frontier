# State

**Pickup point. Keep under 8 KB.**

## Now

Stage S2, Foundation. S1, S2.1, S2.2a, S2.2b and S2.2c are closed: the whole squad-test game runs with no browser, from the first camp to the boss, with loot, wipes, victory and auto-combat. Careful and sloppy bots play it through commands, through `pnpm sim` and `pnpm sim:report`. The dev-only viewer at `/viewer.html` plays replays and live bots on a 2D map. An empty island is still what the public page shows, unlinked. S2.3a and S2.3b are agreed. The design session's decisions are D-020 to D-030, with the model in `docs/DATA-MODEL.md`.

## Next

1. Build S2.3a, see and command.
2. Then build S2.3b, interface and feel.

## Open

- The last two classes (D-006).
- The bots never struggle: no wipes or characters down across 100 seeds. Balance has no brief yet, and the maintainer's own play in S2.3a and S2.3b will show how hard the boss is.
- Units have no pathfinding, enemies do not know their zone, and saves have no version number. S3 fixes all three (D-021, D-023, D-024).
- How consumables are used (D-025).
- Graphics keep the squad test's level of 3D until S5 (D-030). D-019 keeps the renderer replaceable.
- Replays match in Node only. Browsers round `sin`, `cos` and `atan2` slightly differently, so a replay recorded in a browser will not reproduce exactly in Node. Decision 13 of S2.2a allows this. It matters if a later brief wants browser runs checked on CI.

## Bugs

None open.
