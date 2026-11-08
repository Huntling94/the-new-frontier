# State

**Pickup point. Keep under 8 KB.**

## Now

Stage S2, Foundation, is done: the game plays from a public URL, with tests and the bot in CI. S1 to S3d are closed. The family is on state: each character has a name, a class, a level, an art and seven slots, and a live body in the field that a gate moves whole. Items are instances of item types with their own IDs, sit in exactly one place (the inventory or a slot), and are moved on the inventory screen (`Alt` + `E`). The anvil upgrades all seven slots. The game saves itself in the browser when no fight is on, and after every anvil result; the start screen offers Continue, New game, and export and import of the save as a `.json` file. Saves carry a version and a migration chain, and are checked before use. Every tick of 62 runs is unchanged from S3b, through the store's rename to the inventory (D-041), saves and the town; bots, replays and test pages still start on the Lande. A new game starts in the town of Montclaire: a plaza with a fountain, a loop of cobbled streets and a gate street, filled with limestone houses that fade when they would hide the squad, and lots kept for the smithy, shop and inn. A gate at its south end leads onto the island, Lande de Montclaire, a lavender heath with baked standing stones, where a second gate leads to a small walled cave. Units find their way round walls by A\*, one zone runs at a time, and cleared packs come back on the game clock. The game plays in the browser from the start screen to victory, with the squad test's HUD, anvil, screens, synthesised sound, floating text, hit-stop and camera shake. Auto-combat fights bosses (D-036), and the camera follows a character selected alone (D-037). Bots play the whole game headless through `pnpm sim`, and in the real page with `?bot=careful`. The dev-only viewer is at `/viewer.html`. The README now links to the public page.

## Next

1. S3e, the smith (agreed, D-042 to D-044). Then the shop, the Enhancer, a first quest giver, and the bank once items drop (D-044 to D-048).
2. The two S3c play questions, on what Continue brought back and whether saving was clear, were not answered separately.

## Open

- The maintainer will revisit Montclaire's layout later; S3d's is a start (8 Nov 2026). Its streets are 12 wide, which leaves about 10 units open on the grid against the 10.6 the triangle needs unsqueezed. The maintainer kept 12 (S3d).
- The start screen's text still describes only the island (S3d).
- Montclaire's buildings should feel taller against the characters, closer to true scale, so the town feels like a city, with less of a bird's-eye view that sees the whole town at once (maintainer, 8 Nov 2026). Needs a brief: building heights, and the camera's height and tilt in towns.
- The last two classes (D-006).
- The bots never struggle: no wipes or characters down across 100 seeds. Auto-combat alone now beats the boss on every seed tried, with no wipes (D-036). Balance has no brief yet.
- Two of the squad test's four questions, on commanding a team and losing the Healer, were not answered separately in S2.3b. The maintainer will come back to the feel later.
- The HUD costs about 1.5 ms a frame, because its page elements sit over WebGL. Measuring later briefs against a frame budget, not the last build, is proposed and not yet agreed (S2.3b).
- One save per browser, and no cloud saves yet (D-033, proposed).
- Loading builds the zone's packs, which draws from the generator, so rolls after a reload differ from a run with no reload. An anvil result is saved at once, so it cannot be undone by reloading (S3c).
- A save keeps the squad's position but not dropped coins or potions on the ground, or a half-cleared pack, which comes back whole (S3c).
- Browser tests turn saving on with `?save`, beside `?test` (S3c).
- Pack respawn is 180 seconds, a placeholder until balance (S3a).
- Enemies chase in straight lines and slide round stones. Enemy routes wait for a zone where a monster must go round a wall (S3a decision 8).
- Bots and auto-combat stay inside the zone that runs. Planning across zones has no brief yet.
- Gate requirements and costs are data only, and nothing checks them yet.
- The cave's name waits for the starting region's naming (D-038).
- How consumables are used (D-025).
- Graphics keep the squad test's level of 3D until S5 (D-030). D-019 keeps the renderer replaceable.
- The maintainer wants upgrades to work differently from D-005 (8 Nov 2026). S3b keeps today's rules and spares exactly; the new rules need their own brief and a decision replacing D-005.
- Character names are placeholders until names are chosen (S3b decision 3). Items are named by category until a naming session (D-038).
- The inventory should not pause the game (maintainer, 8 Nov 2026). S3b decision 20 made it pause like the anvil; changing it needs a brief, including what equipping mid-fight then means while `in-fight` refuses it.
- The inventory's UX wants its own pass later (maintainer, 8 Nov 2026).
- The 3D figures still hold their class's weapon, whatever is in the main hand.
- The unarmed type, and the cap, buckler and necklace numbers, are placeholders until balance. Which spells need which weapon (cleave a sword, the Sniper's three a rifle) was set in S3b for the maintainer to confirm.
- Firefox and WebKit are not tested yet. The code avoids engine-only features (S2.3a).
- Replays match in Node only. Browsers round `sin`, `cos` and `atan2` slightly differently, so a replay recorded in a browser will not reproduce exactly in Node. Decision 13 of S2.2a allows this. It matters if a later brief wants browser runs checked on CI.

## Bugs

- The unit test "core lint rules rejects three" timed out once at 5 s in a full `pnpm check` under load during S3c, then passed. It is ESLint's first, cold run.
- The browser test "Ctrl and a left click attack-moves" failed once in a full run under load during S3a, then passed three times alone. It reads attack-move flags two ticks after the click.
- Some browser tests time key holds by the wall clock, so on slow frames the camera turns less and the test lands somewhere else. "A right click moves the squad … at four rotations" failed once locally in 31 runs, and once more in a full run in S3c (3.1 against 3), passing three times alone: the squad settled 3.8 from the click, against a limit of 3, likely blocked by something at a point it does not usually reach. Its hold of `Period` should wait for the turn, as the camera test now does (S2.3b).
