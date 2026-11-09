# State

**Pickup point. Keep under 8 KB.**

## Now

Stage S2, Foundation, is done: the game plays from a public URL, with tests and the bot in CI. S1 to S3f, S3i, M1 and M2 are closed. The family is on state: each character has a name, a class, a level, an art and seven slots, and a live body in the field that a gate moves whole. Items are instances of item types with their own IDs, sit in exactly one place (the inventory or a slot), and are moved on the inventory screen (`Alt` + `E`). Gaspard, the smith at Montclaire's smithy, upgrades any weapon or armour by right click; a miss breaks the item, and he repairs it to +4 (D-042). The game saves itself in the browser when no fight is on, and after every smith result; the start screen offers Continue, New game, and export and import of the save as a `.json` file. Saves carry a version and a migration chain, and are checked before use. Bots walk to town to upgrade and back; bots, replays and test pages still start on the Lande. A new game starts in the town of Montclaire: a plaza with a fountain, a loop of cobbled streets and a gate street, filled with limestone houses that fade when they would hide the squad, and lots kept for the smithy, shop and inn. A gate at its south end leads onto the island, Lande de Montclaire, a lavender heath with baked standing stones, where a second gate leads to a small walled cave and a third to Carrefour du Colosse (M1), a dry limestone basin under grey ranges, with eight packs at levels 6 to 11, a pale lake, and a closed south road. Its west door leads to Garganta da Cidadela (M2), a canyon with four packs at levels 11 to 14 and a causeway. Units find their way round walls by A\*, one zone runs at a time, and cleared packs come back on the game clock. The Lande and cave hold wasps, roosters, vipers and wild boars on one shared combat sheet (D-049, D-050, D-056). There is no boss in play and nothing to win (D-052), and cleared packs keep coming back. The game plays in the browser with the squad test's HUD, screens, synthesised sound, floating text, hit-stop and camera shake. The camera follows a character selected alone (D-037). Bots play headless through `pnpm sim`, and in the real page with `?bot=careful`. A headless run finishes once every pack has been cleared at least once and the marks are spent. The dev-only viewer is at `/viewer.html`. The README now links to the public page.

## Next

1. S3g, drops and the shop, and S3h, farming while away, each need a brief (D-053 to D-055). Then the Enhancer, a first quest giver, and the bank once items drop (D-044 to D-048).
2. The two S3c play questions, on what Continue brought back and whether saving was clear, were not answered separately.

## Open

- The maintainer will revisit Montclaire's layout later; S3d's is a start (8 Nov 2026). Its streets are 12 wide, which leaves about 10 units open on the grid against the 10.6 the triangle needs unsqueezed. The maintainer kept 12 (S3d).
- Montclaire's buildings should feel taller against the characters, closer to true scale, so the town feels like a city, with less of a bird's-eye view that sees the whole town at once (maintainer, 8 Nov 2026). Needs a brief: building heights, and the camera's height and tilt in towns.
- M1 play questions not answered separately: whether Carrefour du Colosse feels like a place and a crossroads, whether its road is a pleasure to walk twice, and whether 240 by 240 suits later fields.
- Carrefour du Colosse's floor is flat to the eye as well as in the rules. The maintainer wondered about uneven ground and left it for the graphics upgrade (S5, 9 Nov 2026).
- The last two classes (D-006).
- The bots never struggle: no wipes or characters down across 100 seeds. The careful and sloppy bots differ only against a boss, so they now play identically (S3f). Balance has no brief yet.
- Two of the squad test's four questions, on commanding a team and losing the Healer, were not answered separately in S2.3b. The maintainer will come back to the feel later.
- The HUD costs about 1.5 ms a frame, because its page elements sit over WebGL. Measuring later briefs against a frame budget, not the last build, is proposed and not yet agreed (S2.3b).
- One save per browser, and no cloud saves yet (D-033, proposed).
- Loading builds the zone's packs, which draws from the generator, so rolls after a reload differ from a run with no reload. An anvil result is saved at once, so it cannot be undone by reloading (S3c).
- A save keeps the squad's position but not dropped coins or potions on the ground, or a half-cleared pack, which comes back whole (S3c).
- Browser tests turn saving on with `?save`, beside `?test` (S3c).
- Pack respawn is 180 seconds, a placeholder until balance (S3a). Monster numbers are starting points. A monster's attack speed is its wait after a strike lands, with the wind-up on top (S3f).
- Monsters chase until one side is dead or the squad leaves. A limit on the chase is a balance question (S3i).
- Auto-combat stays inside the zone that runs (S3e decision 14).
- Marks ran out before +4 to +5 in play, so the maintainer has not seen a break, and whether it feels like a loss worth fearing is unanswered (S3e). Balance has no brief.
- Gate requirements and costs are data only, and nothing checks them yet.
- The cave's name waits for the starting region's naming (D-038).
- How consumables are used (D-025).
- Graphics keep the squad test's level of 3D until S5 (D-030). D-019 keeps the renderer replaceable.
- Character names are placeholders until names are chosen (S3b decision 3). Items are named by category until a naming session (D-038).
- The inventory should not pause the game (maintainer, 8 Nov 2026). S3b decision 20 made it pause like the anvil; changing it needs a brief, including what equipping mid-fight then means while `in-fight` refuses it.
- The inventory's UX wants its own pass later (maintainer, 8 Nov 2026).
- The 3D figures still hold their class's weapon, whatever is in the main hand.
- The unarmed type, and the cap, buckler and necklace numbers, are placeholders until balance. Which spells need which weapon (cleave a sword, the Sniper's three a rifle) was set in S3b for the maintainer to confirm.
- Firefox and WebKit are not tested yet. The code avoids engine-only features (S2.3a).
- Replays match in Node only. Browsers round `sin`, `cos` and `atan2` slightly differently, so a replay recorded in a browser will not reproduce exactly in Node. Decision 13 of S2.2a allows this. It matters if a later brief wants browser runs checked on CI.
- Backlog: random placement of monsters, with a collision test before placing, a zone maximum and a spread algorithm (maintainer, 9 Nov 2026).
- Backlog: random empowered monsters during long farming, and quest or raid bosses (D-052).
- S3g must settle what a dropped item's "unknown" enhancements mean in play, and the drop rates. S3h starts by proving the game runs in a hidden tab, perhaps with `core` in a Web Worker (D-053).

## Bugs

- The browser test "the camera grips, rotates, tilts and zooms" failed once on CI at `91b5901`: -0.7984 against -0.8.
- The unit test "core lint rules rejects three" timed out once at 5 s in a full `pnpm check` under load during S3c, then passed. It is ESLint's first, cold run.
- The browser test "Ctrl and a left click attack-moves" failed once in a full run under load during S3a, then passed three times alone. It reads attack-move flags two ticks after the click.
- Some browser tests time key holds by the wall clock, so on slow frames the camera turns less and the test lands somewhere else. "A right click moves the squad … at four rotations" failed once locally in 31 runs, and once more in a full run in S3c (3.1 against 3), passing three times alone: the squad settled 3.8 from the click, against a limit of 3, likely blocked by something at a point it does not usually reach. Its hold of `Period` should wait for the turn, as the camera test now does (S2.3b).
