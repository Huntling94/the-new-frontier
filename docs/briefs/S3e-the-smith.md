# Brief S3e — The smith

**Status:** agreed 8 Nov 2026, after a refresh for what S3d built and D-044.
**Read first:** `STATE.md`, `ARCHITECTURE.md`, `docs/DATA-MODEL.md`, briefs S3b, S3c and S3d, D-005, D-024, D-028, D-031, D-039, D-042, D-043, D-044.
**Depends on:** S3d closed.
**Goal:** the maintainer walks into Montclaire, talks to the smith, upgrades a rifle straight from the inventory, sees the odds before each step past +4, breaks one, and has it repaired to +4.

## Why now

Montclaire exists (S3d) but nothing happens there. The smith is the first step of the core loop to move into town: fight in the field, earn marks, spend them on gear (D-043). The upgrade rules also change. A miss now breaks an item rather than destroying it, the player picks an item rather than a slot, and the spare goes (D-042). The field anvil on the Lande was always a stand-in, and comes out (D-039).

## Decisions

**The smith**

1. **NPCs are definitions placed on a zone** (D-029, D-044): an ID, a name, a point in the zone, a list of services and a list of quests. Any zone can hold one, and either list may be empty. This brief builds the one service it needs, `smith`, and leaves the quest list empty; the other services arrive with their own briefs. The smith is the first NPC, standing at the door of the smithy lot S3d kept, a placeholder name until the naming session (D-038). A data check holds the smith to towns (D-039).
2. **Left-click an NPC to talk** (the maintainer, 8 Nov 2026). Hovering over an NPC changes the cursor and highlights the NPC, so it reads as something to click before you click it. A left drag that starts on an NPC is still a box-select, and a right click on one is an ordinary move. The selected characters walk to the NPC like an order to a point. The smith's screen opens when a living character in the active three is within reach, the anvil's reach today. Talking is refused while any enemy is awake (D-044), as equipping is.
3. **The field anvil is removed** from the Lande's data and look (D-039). `Y`, the anvil's key (D-031), stops doing anything, since talking is by click (the maintainer, 8 Nov 2026).
4. **The smith's screen does not pause the game.** Towns hold no monsters (S3d decision 1), and no one can talk during a fight (D-044), so nothing can happen while it is open. The inventory's own pause changes in S3f.

**Upgrade rules** (D-042)

5. **The smith lists every weapon and armour item the family owns,** worn or in the inventory, grouped by who wears it, then the inventory. Jewellery is not listed.
6. **The odds do not change.** Every step up to +4 succeeds. From +4 to +5 it is 50%, then 25% and halving to +10. Before a step that can fail, the screen shows the chance and "a miss breaks the item", and the player confirms.
7. **A miss breaks the item.** It keeps its type and the level it broke at, and is marked broken. A worn item that breaks goes to the inventory, and its slot is left empty. An empty main hand fights with the unarmed type (S3b decision 12). A broken item cannot be equipped, with a new refusal, `broken`, which the inventory screen explains.
8. **The smith repairs a broken item to +4.** The fee is half of what the failed step cost, a placeholder in data until balance. Repair never fails.
9. **Upgrade costs do not change:** today's formula, with the main hand's share applied to every weapon, wherever it is.
10. **A save follows every upgrade and every repair** (D-024, S3c decision 6).

**The spare and the save**

11. **The plain item types go** (D-042): Plain Sword, Plain Rifle, Plain Staff, and the plain armour, gloves, boots, cap, buckler and necklace. Each item type loses its `spare`, and items lose their quality. The squad test's spare numbers no longer need to match.
12. **Saves move from version 1 to 2.** This is the first real step in S3c's chain. Each plain item becomes the type it stood in for, with its ID and upgrade kept, and every item gains `broken: false`. The frozen version 1 example save loads into version 2, and a version 2 example is frozen beside it. Rule 9 in `docs/DATA-MODEL.md` holds, because the step names every ID it retires.

**Bots**

13. **Bots walk to town to upgrade** (D-039). With the zone clear and an upgrade affordable, the careful and sloppy bots find the way to Montclaire by breadth-first search over gates, walk to the smith, upgrade, and walk back to fight the boss. This is the first planning across zones. It stays as small as this need: a route of gates, then A\* inside each zone. Bots still stop at +3 (`BOTS.upgradeBelow`), so they never risk a break.
14. **Auto-combat does not upgrade,** as today, and stays inside the zone that runs (S3a decision 13). `Space` never walks the squad to town (the maintainer, 8 Nov 2026).
15. **Replays and the 100-seed report change once.** Bots now walk to town and back, so runs take longer and hashes move. Before and after are recorded, and every bot still finishes.

## Scope

**In:**

- NPCs as data, talking by left click with a hover highlight, and the smith at Montclaire's smithy.
- The smith's screen: upgrade any weapon or armour item, the odds shown, broken items and repair.
- Removing the field anvil, the plain item types and quality.
- The save migration from version 1 to 2.
- Bots walking to town and back by a route across zones.
- `docs/DATA-MODEL.md` (NPC, item, item type, save version, the hand-over from D-005 to D-042) and `ARCHITECTURE.md` (NPCs, and planning across zones).

**Out:**

- The shop, buying and selling (S3f).
- The inventory not pausing, and its UX pass (S3f).
- Any NPC other than the smith, and the `enhancer`, `bank` and `shop` services (S3f and later, D-044 to D-047).
- Quests, and several arts with one active (D-044, D-048).
- Jewellery's value beyond its stats (no brief yet, D-042).
- New costs or odds (balance, no brief yet).
- Auto-combat walking to town (no brief yet, decision 14).

## Done means

1. `pnpm check` passes.
2. Unit tests prove:
   - An item in the inventory and an item worn can both be upgraded, and jewellery cannot.
   - Steps to +4 always succeed. Each step after has the right chance across 10,000 seeded tries, within 1%.
   - A miss leaves the item broken, at its level, in the inventory, and its slot empty.
   - A broken item cannot be equipped, and the refusal is `broken`.
   - Talking to an NPC is refused while any enemy is awake, and works once none is.
   - An NPC with no services can stand in a zone that is not a town, and the data check refuses a smith outside a town.
   - Repair returns the item to +4, unbroken, for the fee in data.
   - The version 1 example save migrates to version 2: every plain item becomes its replacement type with ID and upgrade kept, and no item ID appears twice.
   - A bot on the Lande with an affordable upgrade reaches the smith in Montclaire, upgrades, and returns to the Lande.
3. `pnpm sim:report --seeds 100`: the careful and sloppy bots each finish 100 of 100 with no stalls, and auto-combat clears all 100. The longer run times and moved hashes are recorded, before and after.
4. `pnpm test:e2e` adds flows:
   - Hover over the smith and see it highlighted, left-click to talk, upgrade an inventory item to +5 on a seed where it succeeds, and reload: it stands.
   - On a seed where +4 to +5 fails, see the item broken in the inventory, try to equip it and read why not, then repair it to +4.
   - A version 1 save from S3c, with a spare in it, loads and shows the replacement item.
5. `docs/DATA-MODEL.md` moves NPC to Partial, changes item and item type, drops the spare from the glossary, and names the migration test.
6. A check on the tracked files and built site finds no secrets, local paths or unintended personal information.
7. The maintainer has approved the exact file list and diff before any commit.
8. CI is green on `master` after the maintainer's approved push.
9. **The maintainer has played it:** fight on the Lande, walk back to Montclaire, upgrade a worn item and an inventory item, push one past +4 until it breaks, repair it, and finish the Lande. Questions:
   - Was it clear what you risked before each step past +4?
   - Did breaking and repairing feel like a loss worth fearing, but not a disaster?
   - Was the walk back to town worth it, or a chore?

## Stop and ask if

- Any open question under Decisions is still open when building starts.
- The migration cannot turn every spare into a replacement type without changing a number the player sees beyond the spare's own lost quality.
- Planning across zones needs more than a breadth-first search over gates plus A\* in each zone.
- Any bot run stops finishing.
- Any standing trigger in `CLAUDE.md` fires.

## Outcome (builder fills in)
