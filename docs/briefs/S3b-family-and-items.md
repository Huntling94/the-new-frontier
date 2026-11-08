# Brief S3b — Family and items

**Status:** agreed 8 Nov 2026.
**Read first:** `STATE.md`, `ARCHITECTURE.md`, `docs/DATA-MODEL.md`, briefs S3a and S3c, D-005, D-006, D-019, D-025, D-026, D-027, D-028, D-029, D-038, D-039, D-040.
**Depends on:** S3a closed.
**Goal:** the maintainer opens the inventory screen, moves a cap from the store onto the Fighter, sees the Sniper's rifle fill both hands, and upgrades a character's gear at the anvil in seven slots, with the run playing as it does today.

## Why now

The core still holds the squad test's shape. `createGame` builds one character per class, a character's place in the triangle comes from its class, and the boss and bots look for "the Healer" by class (D-025). Each character has four fixed gear slots, and a weapon's numbers come from its class, not from an item (D-028). Items have no identity, so nothing can sit in a store or move between characters. S3c saves the family, so its shape should settle first, and the first save format then holds the new items.

## Decisions

**The family**

1. **The family is on state** (D-025, D-029). It holds the characters, the active three in order, the store, marks and potions. A character is lasting: ID, class, level, XP and its equipped items. Its body is live: position, orders, S3a's route and route goal, health, mana, target and timers. Bodies belong to the squad, not to the zone's live group, and point at their character by ID. S3a drops the live group at every gate and builds it fresh (`crossGate` and `enterZone` in `packages/core/src/zones.ts`), so a body there would lose its health, mana and cooldowns on each crossing. A gate moves the squad's bodies instead. Whether a loaded save rebuilds them whole at camp is left to S3c. `Unit` splits into the two, which changes `GameView` (D-019), and `render` and `app` follow it.
2. **`createGame` builds from a starting family in data,** one of each class in today's order, so the normal game starts as now: a Fighter, a Sniper and a Healer at the camp in Lande de Montclaire. When the town of Montclaire is built, the start moves there by changing data. Tests may pass any family, such as three Fighters.
3. **Each character has a name,** set in the starting family's data, with a placeholder for each class until names are chosen. The HUD cards and the inventory screen show it. Names arrive now, before saves (S3c), so the first save format holds them and no migration is needed later. Players cannot rename characters until character creation.
4. **A character's place in the triangle comes from its place in the active three** (D-025). Slots and start offsets move from each class to one formation table of three places. With today's family the numbers do not change. Every caller of `triangleSlot(classId, …)` moves to the place: `standInTriangle` in `zones.ts` (gate arrival and camp return), `slotTarget` in `movement.ts`, and `formTriangle` in `orders.ts`.
5. **Class checks become data.** The boss charges and summons near a character whose class auto-heals, not one whose class is `healer`. Bots find a caster by its spells, and buy upgrades by place in the three and slot.
6. **Potions stay a shared count on the family** (D-025). How consumables are used stays open.

**Items**

7. **Item types are definitions, and items are instances** (D-028, D-029). An item type lists the slots it fits and fills, its stats, its requirements and its price. An item is its type plus its upgrade, with its own ID from a separate counter, so unit and enemy IDs do not move.
8. **Seven slots** (D-028): main hand, off hand, head, chest, gloves, boots and necklace, as a list in data. Any slot may be empty.
9. **Every item type has a category, from the genre's usual set** (D-027, D-028, the maintainer, 8 Nov 2026). Weapons: sword, great sword, dagger, spear, pistol, rifle and staff, with shields for the off hand. Armour: leather, metal and coat. The categories are a list in data, so more can be added. The starting items are a sword for the Fighter, a rifle for the Sniper and a staff for the Healer. Their armour is metal, leather and coat by class, all with today's shared numbers, so no stat changes. Arts permit weapon categories (D-027). Any class may wear any armour, and the class's armour skill still scales it.
10. **Weapons move from class to item type** (D-028). Range, base attack speed, knockback, melee or ranged, and the attack stat move off the class onto each class's starting weapon type, with today's numbers. The Sniper's rifle and the Healer's staff fill both hands. The Fighter's sword fills one, leaving the off hand free.
11. **Armour types are shared, and each class keeps its armour skill** (D-028). Chest, gloves and boots become shared item types with today's numbers, and `armourScale` stays on the class.
12. **An empty main hand fights with a basic unarmed type in data,** so a character never stands idle.
13. **The smith's spare is a basic item type for its slot** (D-005, D-028), with today's 85% and 80% shares built into its numbers. The upgrade odds do not change.
14. **Stats are worked out from items, as today.** Level still scales attack and health until attributes arrive (D-026), so this brief changes where the numbers come from, not what they are.

**Arts and the store**

15. **Each class starts with one art, known from the start** (D-027). It unlocks the class's three spells and its starting weapon category. A spell needs its art, and a matching weapon in hand unless it names none. Trainers and more arts come with the town.
16. **The store holds every item not equipped** (D-025). An item is in exactly one place: the store, or one character's slot (rule 1 in `docs/DATA-MODEL.md`).
17. **Two new commands: equip and unequip.** Equip moves an item from the store into a slot, sending whatever was there, and anything a two-handed item displaces, back to the store. Both are refused during a fight (any enemy awake), or if the character misses a requirement: an art known or a level reached. Unequip sends an item back to the store.
18. **The starting store holds a few basic items** so the screen has something to show: a cap, a buckler and a plain necklace, with small stats. Their numbers are placeholders until balance.
19. **The anvil upgrades what a character has equipped,** in all seven slots, by place and slot. Its odds and costs do not change (D-005). It stays the field stand-in on the Lande until the town brief puts it behind a smith in Montclaire (D-039), so nothing here should assume where it is.

**The screen**

20. **The inventory screen** (D-025). The store sits on the left, as tiles showing each item's category and upgrade. The active three sit on the right, one column each, with name, class and seven slots. Click a store item, then a slot, to equip; click an equipped item to send it back. Holding an item over a slot shows each key stat before and after. A refusal says why: a level needed, an art the class lacks, or a fight on. A two-handed item shows what it would push off the off hand. It opens and closes with `Alt` + `E` (D-040), or `Esc`, anywhere, and pauses the game like the anvil. Names and looks come from the lookup in `render`, keyed by item type ID (D-029). It grows into the Family House in S4.

**Settled with the maintainer, 8 Nov 2026:** the inventory opens with `Alt` + `E` (D-040). Items are named by their category for now (Sword, Rifle, Staff, Leather Armour, Metal Armour, Coat and so on), and named items come with a naming session in the D-038 style, built round the 2019 item tiers. This is one brief, built in two steps with a check between them: step one splits the family and must leave every event unchanged, and step two adds items.

## Scope

**In:**

- The family on state, characters split from bodies, and the starting family in data, with a name for each character.
- The triangle by place, and class checks turned into data.
- Item types, item instances with IDs, seven slots, two-handed weapons and the unarmed type.
- Weapon values moved from class to item type, and shared armour types.
- The smith's spare as an item type.
- One art per class, and the requirement check.
- The store, equip and unequip, and the starting store.
- The anvil over seven slots.
- The inventory screen.
- `docs/DATA-MODEL.md` and `ARCHITECTURE.md` updated.

**Out:**

- Saves (S3c).
- Attributes, spent points and the new hit order (no brief yet, D-026).
- Shops, buying and selling, and trainers (the town brief, no brief yet).
- Gear dropped as loot (no brief yet).
- Item boosts, and whether they vary between items (no brief yet, D-028).
- Rings and other slots beyond seven (no brief yet).
- The Family House and benched characters (S4, D-006).
- Character creation: naming the family and picking three of the five classes (no brief yet, after D-006's last two classes).
- Balance (no brief yet).

## Done means

1. `pnpm check` passes.
2. **Step one keeps the game the same.** After the family split, every tick's commands and events, and every character's stats on every tick, match across both replays and 20 seeds each of the careful bot, the sloppy bot and auto-combat. Only then does step two start.
3. **Step two keeps the numbers the same.** After items, the same runs match again, with slot names mapped (`weapon` to `main-hand`). Hashes change once, and before and after are recorded here.
4. Unit tests prove:
   - A family of three Fighters stands in three places, each with its own row of spells.
   - An item is always in exactly one place, across a run of random equips and unequips.
   - A squad crossing a gate keeps every character's health, mana and cooldowns.
   - S3a's `strayEnemyReferences` check in `packages/core/src/checks.ts` reads the body's target, and still passes.
   - A two-handed weapon empties the off hand into the store.
   - Equip is refused during a fight, and for a missing art or level.
   - An empty main hand fights with the unarmed type.
   - A destroyed item becomes the spare for its slot.
5. `pnpm test:e2e` adds a flow: open the inventory screen, equip the cap on the Fighter, see the stat change, close it, and see the game resume.
6. `pnpm sim:report --seeds 100` matches S3a's Outcome: the careful and sloppy bots each finish 100 of 100 with no stalls, and auto-combat clears all 100. Marks may drift, because any change to the order of random rolls moves them, and any drift is explained here.
7. `docs/DATA-MODEL.md` moves family, character, item type, item, art and store to their new status, and rules 1 and 2 have tests.
8. A check on the tracked files and built site finds no secrets, local paths or unintended personal information.
9. The maintainer has approved the exact file list and diff before any commit.
10. CI is green on `master` after the maintainer's approved push.
11. **The maintainer has played it:** open the inventory screen, equip and unequip, try to equip during a fight, upgrade in a new slot at the anvil, and finish the Lande. Questions:
    - Is it clear what each character wears, and what is in the store?
    - Does the game still play as it did before S3b?

## Stop and ask if

- Step one changes any event or stat in done means 2.
- A body would need to sit in the zone's live group, or a gate would reset its health, mana or cooldowns.
- Moving weapon values onto items changes any number a character fights with.
- The family split needs `render` or `app` to know a character's class beyond its looks.
- A browser keeps `Alt` + `E` for itself (on Windows, Chrome and Edge open their own menu with it) and the page cannot stop it. Find out first, before building the screen.
- Any standing trigger in `CLAUDE.md` fires.

## Outcome (builder fills in)

Built on 8 Nov 2026, from `f43a073`, in the two steps the brief set. The maintainer played it and approved the diff on 8 Nov 2026 (done means 9 and 11): "looks good". Two notes for later, now in `STATE.md`: the inventory should not pause the game, against decision 20, and its UX wants a pass of its own. CI on `master` is done means 10.

**Asked and answered while building:**

- **`Alt` + `E` (stop trigger, checked first).** The maintainer pressed `Alt` + `E` on a test page in Chrome and Edge on Windows: the page received it every time and the browser's own menu did not open. The screen uses it as D-040 says.
- **The smith's spare.** One spare type per slot could not give the Fighter a sword and the Sniper a rifle, and building the 80% into a shared armour type's numbers rounds differently (a Sniper's spare chest would be 20 Def, not 21). The maintainer said upgrades should not work this way at all, and chose to keep today's rules exactly in S3b and give new upgrade rules their own brief later. So each item type names its spare (Plain Sword, Plain Rifle, Plain Staff, and Plain Armour, Gloves, Boots, Cap, Buckler and Necklace), and a spare carries a quality of 0.85 or 0.8, applied after the class's armour skill. Every spare number matches the squad test, which a test checks for every class and slot.

**Done means:**

| # | Result |
|---|---|
| 1 | `pnpm check` passes: 432 unit tests, lint, typecheck and the `legacy/` guard |
| 2 | After step one, every tick's commands, events and character stats matched S3a across both replays and 20 seeds each of the careful bot, the sloppy bot and auto-combat: 62 runs, 244,343 ticks, no difference. Checked before step two began |
| 3 | After step two, the same 62 runs matched again, with `weapon` mapped to `main-hand`: no difference. Hashes below |
| 4 | `packages/core/test/family.test.ts` (three Fighters in three places, each with its own spells and cooldowns; class checks as data), `items.test.ts` (rule 1 across 400 random equips and unequips, two-handed weapons both ways, every refusal, the unarmed type, spares for every class and slot, the anvil over seven slots) and `zones.test.ts` (a gate keeps health, mana and cooldowns). The `strayEnemyReferences` test now reads the body's target, and passes |
| 5 | `e2e/inventory.spec.ts`: `Alt` + `E` opens the screen without casting, the cap goes on the Fighter, the preview shows Def rising, the game stays paused, and closing resumes it. A second flow shows a refusal's reason and closes on `Esc`. All 23 browser tests pass |
| 6 | See the report below |
| 7 | `docs/DATA-MODEL.md` moves family, character, item type, item, category and store to Built, art to Partial, and adds the body. Rules 1 and 2 name their tests. `ARCHITECTURE.md` describes characters, bodies and items |
| 8 | The changed files and the built site hold no local paths, personal details or secrets |

**Replay hashes:**

| Replay | S3a | After step one | After step two |
|---|---|---|---|
| Spell tour | `84876bf5` | `84673f56` | `0e276c1d` |
| Squad tour | `ccb3ea79` | `4530abbc` | `be8c024b` |

Both change at each step only because state's shape changed (the family and bodies, then items and the store); every event and stat matched. Against `master`, the hashes change once.

**100-seed report (done means 6).** Both run on the same machine, the old code from `f43a073`:

| | S3a | S3b |
|---|---|---|
| Careful bot | 100 of 100 finished, 0 stalled, 2.5 game minutes, 10.3 upgrades, 551.5 marks, 8.0 potions | the same |
| Sloppy bot | 100 of 100, 0 stalled, 2.6 minutes, 10.3 upgrades, 478.6 marks, 7.8 potions | the same |
| Auto-combat | clear 100 | clear 100 |
| Run time | 83 s | 71 s |

Nothing drifts, marks included: item IDs have their own counter and no random roll moved, so every coin and potion roll lands as before. Wipes, characters down, levels and refused orders do not change either. The final code was traced once more against S3a after the report: 62 runs, no difference.

**Built:**

- `state.family` (characters, active three, store, marks, potions), `state.bodies` and `state.nextItemId`. A character holds its name, class, level, XP, arts and seven slots; a body holds everything live. `GameView` changes with them, as decision 1 planned.
- `STARTING_FAMILY` and `FORMATION` in `packages/core/data/squad.ts`. A scenario may pass any family. The names are placeholders: Aurelio, Inês and Mireille.
- `packages/core/data/items.ts`: the seven slots, twelve categories, three arts, which spells need which weapon, 24 item types, the unarmed type and the starting store. `packages/core/src/items.ts`: equip, unequip, requirements, weapons in hand, and the rule 1 listing.
- Two commands, `equip` and `unequip`, and two events, `equipped` and `unequipped`. Refusals: `unknown-item`, `wrong-slot`, `slot-empty`, `needs-level`, `needs-art`, `needs-weapon` and `in-fight`.
- Reads for the screen: `itemInfo`, `previewChange` (plays the command on a copy and returns stats before and after, and what goes back to the store), `whyNotUse`, `fightOn` and `GEAR_SLOTS`.
- Render: item and slot names and category colours, keyed by type ID. App: the inventory screen, the anvil over seven slots, and names on the HUD cards, anvil and log.

**Found while building, for the maintainer to confirm:**

- Which spells need a weapon: cleave needs a sword, and the Sniper's three shots a rifle. Taunt, guard and the healing spells need none.
- The buckler is a shield, which the Fighter's art (Swordplay) permits, so only the Fighter can hold it. The necklace needs level 4, so a new family sees a level refusal. The cap fits anyone.
- A fight is any enemy awake, not counting the training dummy.
- The unarmed type hits for 20 at 2.5 units, once a second. Placeholder.
- The 3D figures still hold their class's weapon whatever is equipped, and the anvil's Healer weapon is now "Staff", not "Lamp Staff", since items are named by category.
- The anvil shows all seven slots for each character, so 21 rows; empty slots show with nothing to upgrade.
- Spares carry a quality rather than having the share built into their numbers, to keep every number exact (see above).
