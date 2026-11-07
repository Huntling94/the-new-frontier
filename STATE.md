# State

**Pickup point. Keep under 8 KB.**

## Now

Stage S2, Foundation. S1 to S2.3a are closed. The squad is drawn in 3D on the island and commanded with the squad test's camera, the keys in D-031 and D-034, and per-character auto-combat (D-035). Bots play the whole game headless through `pnpm sim`, and in the real page with `?bot=careful`. The dev-only viewer is at `/viewer.html`. The public page is still unlinked.

## Next

1. Build S2.3b, interface and feel. It should check the boss fight: S2.3a's play did not answer whether all three can be followed there.

## Open

- The last two classes (D-006).
- The bots never struggle: no wipes or characters down across 100 seeds. Balance has no brief yet, and the maintainer's own play in S2.3a and S2.3b will show how hard the boss is.
- Units have no pathfinding, enemies do not know their zone, and saves have no version number. S3 fixes all three (D-021, D-023, D-024).
- How consumables are used (D-025).
- Graphics keep the squad test's level of 3D until S5 (D-030). D-019 keeps the renderer replaceable.
- The core still assumes one character per class: `createGame` builds one of each, and the triangle slot comes from the class. S3 fixes both (D-025).
- Firefox and WebKit are not tested yet. The code avoids engine-only features (S2.3a).
- Camera shake on big hits is in the squad test, but in neither S2.3 brief.
- Replays match in Node only. Browsers round `sin`, `cos` and `atan2` slightly differently, so a replay recorded in a browser will not reproduce exactly in Node. Decision 13 of S2.2a allows this. It matters if a later brief wants browser runs checked on CI.

## Bugs

None open.
