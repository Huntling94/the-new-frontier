# State

**Pickup point. Keep under 8 KB.**

## Now

Stage S2, Foundation, is done: the game plays from a public URL, with tests and the bot in CI. S1 to S2.3b are closed. The game plays in the browser from the start screen to victory, with the squad test's HUD, anvil, screens, synthesised sound, floating text, hit-stop and camera shake. Auto-combat fights bosses (D-036), and the camera follows a character selected alone (D-037). Bots play the whole game headless through `pnpm sim`, and in the real page with `?bot=careful`. The dev-only viewer is at `/viewer.html`. The README now links to the public page.

## Next

1. Write S3's first brief: the world foundation, with zones, gates, pathfinding and saves (D-021, D-023, D-024, D-032).

## Open

- The last two classes (D-006).
- The bots never struggle: no wipes or characters down across 100 seeds. Auto-combat alone now beats the boss on every seed tried, with no wipes (D-036). Balance has no brief yet.
- Two of the squad test's four questions, on commanding a team and losing the Healer, were not answered separately in S2.3b. The maintainer will come back to the feel later.
- The HUD costs about 1.5 ms a frame, because its page elements sit over WebGL. Measuring later briefs against a frame budget, not the last build, is proposed and not yet agreed (S2.3b).
- Units have no pathfinding, enemies do not know their zone, and saves have no version number. S3 fixes all three (D-021, D-023, D-024).
- How consumables are used (D-025).
- Graphics keep the squad test's level of 3D until S5 (D-030). D-019 keeps the renderer replaceable.
- The core still assumes one character per class: `createGame` builds one of each, and the triangle slot comes from the class. S3 fixes both (D-025).
- Firefox and WebKit are not tested yet. The code avoids engine-only features (S2.3a).
- Replays match in Node only. Browsers round `sin`, `cos` and `atan2` slightly differently, so a replay recorded in a browser will not reproduce exactly in Node. Decision 13 of S2.2a allows this. It matters if a later brief wants browser runs checked on CI.

## Bugs

- Some browser tests time key holds by the wall clock, so on slow frames the camera turns less and the test lands somewhere else. "A right click moves the squad … at four rotations" failed once locally in 31 runs: the squad settled 3.8 from the click, against a limit of 3, likely blocked by something at a point it does not usually reach. Its hold of `Period` should wait for the turn, as the camera test now does (S2.3b).
