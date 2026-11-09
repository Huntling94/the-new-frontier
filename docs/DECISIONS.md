# Decision register

Every design and architecture decision, in one place. Entries are never rewritten: a later decision replaces an earlier one by a new entry, and the old entry is marked as replaced.

| ID | Decision | Status | Date |
|---|---|---|---|
| [D-001](#d-001) | Command three characters at once | Accepted | 7 Nov 2026 |
| [D-002](#d-002) | Name: The New Frontier | Accepted | 7 Nov 2026 |
| [D-003](#d-003) | Right-click control and a free rotating camera | Accepted, extended by D-013, changed by D-031 and D-034 | 7 Nov 2026 |
| [D-004](#d-004) | Individual levels, XP split among the living | Accepted, extended by D-051 | 7 Nov 2026 |
| [D-005](#d-005) | Upgrades are safe to +4, then risk destruction | Replaced by D-042 | 7 Nov 2026 |
| [D-006](#d-006) | Five classes, with a Family House to rotate them | Accepted, extended by D-020 | 7 Nov 2026 |
| [D-007](#d-007) | Space is auto-combat, and also the test bot | Accepted, extended by D-035, changed by D-036 | 7 Nov 2026 |
| [D-008](#d-008) | The Healer auto-heals one person at a time | Accepted | 7 Nov 2026 |
| [D-009](#d-009) | TypeScript, three.js and a headless game core | Accepted | 7 Nov 2026 |
| [D-010](#d-010) | MIT for new code; the 2019 files stay outside it | Accepted | 7 Nov 2026 |
| [D-011](#d-011) | A world of safe cities and unsafe zones, and the goal is to help the frontier | Accepted, extended by D-021 | 7 Nov 2026 |
| [D-012](#d-012) | The marketplace is NPC shops | Accepted, extended by D-045 | 7 Nov 2026 |
| [D-013](#d-013) | The full control set, as approved in the squad test | Accepted, changed by D-031 and D-034 | 7 Nov 2026 |
| [D-014](#d-014) | Commits: contributor and route | Accepted | 7 Nov 2026 |
| [D-015](#d-015) | The game core is deterministic and driven by commands | Accepted, extended by D-021 and D-022 | 7 Nov 2026 |
| [D-016](#d-016) | Four packages, and a guard on `legacy/` | Accepted | 7 Nov 2026 |
| [D-017](#d-017) | The public page goes live in S2.1, unlinked | Accepted | 7 Nov 2026 |
| [D-018](#d-018) | Code and data stay separate in the core | Accepted | 7 Nov 2026 |
| [D-019](#d-019) | Packages meet at small, explicit interfaces | Accepted | 7 Nov 2026 |
| [D-020](#d-020) | Sniper replaces Shooter | Accepted | 7 Nov 2026 |
| [D-021](#d-021) | Zones joined by gates, with one live at a time | Accepted | 7 Nov 2026 |
| [D-022](#d-022) | Zone layouts are frozen, with rules and look kept apart | Accepted | 7 Nov 2026 |
| [D-023](#d-023) | One walkable grid for movement and routes | Accepted | 7 Nov 2026 |
| [D-024](#d-024) | Saves are automatic, versioned and arrive in S3 | Accepted, extended by D-032 | 7 Nov 2026 |
| [D-025](#d-025) | The family holds the store, and gear moves onto characters | Accepted | 7 Nov 2026 |
| [D-026](#d-026) | Attributes and stats are calculated in a fixed order | Accepted, changed by D-049 | 7 Nov 2026 |
| [D-027](#d-027) | Arts decide what a character can use | Accepted, extended by D-048 | 7 Nov 2026 |
| [D-028](#d-028) | Seven gear slots to start, on shared item types | Accepted, changed by D-042, extended by D-046 | 7 Nov 2026 |
| [D-029](#d-029) | Definitions and instances, and a data model document | Accepted, extended by D-044 | 7 Nov 2026 |
| [D-030](#d-030) | Graphics come in two steps | Accepted | 7 Nov 2026 |
| [D-031](#d-031) | Spell keys in a grid, one row per character | Accepted, changed by D-034 | 7 Nov 2026 |
| [D-032](#d-032) | Saves go through a storage interface | Accepted | 7 Nov 2026 |
| [D-033](#d-033) | Optional sign-in and cloud saves, after browser saves work | Proposed | 7 Nov 2026 |
| [D-034](#d-034) | Controls after the first play of S2.3a | Accepted, extended by D-037 | 7 Nov 2026 |
| [D-035](#d-035) | Auto-combat runs per character | Accepted | 7 Nov 2026 |
| [D-036](#d-036) | Auto-combat fights bosses | Replaced for now by D-052 | 7 Nov 2026 |
| [D-037](#d-037) | The camera follows a character selected alone | Accepted | 7 Nov 2026 |
| [D-038](#d-038) | The world borrows the 2019 shape, with original names and places | Accepted | 8 Nov 2026 |
| [D-039](#d-039) | Upgrades come only from a smith in a town | Accepted, changed by D-042, extended by D-043, extended by D-044 | 8 Nov 2026 |
| [D-040](#d-040) | `Alt` + `E` opens the inventory | Accepted | 8 Nov 2026 |
| [D-041](#d-041) | The store is called the inventory | Accepted | 8 Nov 2026 |
| [D-042](#d-042) | A failed upgrade breaks the item, and the smith repairs it | Accepted | 8 Nov 2026 |
| [D-043](#d-043) | Montclaire comes first as a place to walk, and its systems arrive one at a time | Accepted, extended by D-044 | 8 Nov 2026 |
| [D-044](#d-044) | NPCs are placed in zones and offer a list of services | Accepted | 8 Nov 2026 |
| [D-045](#d-045) | A shop sells from its own list of offers | Accepted | 8 Nov 2026 |
| [D-046](#d-046) | Enhancements are random, and an item can hold several | Accepted, extended by D-055 | 8 Nov 2026 |
| [D-047](#d-047) | The bank is shared across towns | Accepted | 8 Nov 2026 |
| [D-048](#d-048) | A character knows several arts, with one active at a time | Accepted | 8 Nov 2026 |
| [D-049](#d-049) | One combat sheet, and the 2019 hit formula with three fixes | Accepted | 9 Nov 2026 |
| [D-050](#d-050) | The Lande's monsters are a wasp, a rooster, a viper and a wild boar | Accepted | 9 Nov 2026 |
| [D-051](#d-051) | XP depends on the gap between a character's level and the monster's | Accepted | 9 Nov 2026 |
| [D-052](#d-052) | No bosses for now, and the game does not end | Accepted | 9 Nov 2026 |
| [D-053](#d-053) | Farming while away is the core of the game | Accepted | 9 Nov 2026 |
| [D-054](#d-054) | The money is called sol | Accepted | 9 Nov 2026 |
| [D-055](#d-055) | Monsters drop trophies and gear, and dropped gear may carry enhancements | Accepted | 9 Nov 2026 |

## D-001

**Command three characters at once.** Each character has their own class, spells and gear. They fight by themselves and usually travel in a triangle. The player moves them, as a group or one at a time, and chooses when to spend spells.

**Why:** a playable squad test showed that this creates real decisions rather than babysitting.

## D-002

**Name: The New Frontier.** The repository was previously called `ge`.

## D-003

**Right-click control and a free rotating camera.**

| Input | Action |
|---|---|
| Right click | Move, or target an enemy |
| Right drag | Grip the camera |
| `WASD` | Pan, relative to the view |
| Middle drag, left and right arrows | Rotate; middle drag also tilts |
| Wheel | Zoom |
| Hold `A` + left click | Attack-move |
| `F1` `F2` `F3`, left click | Select one character |
| Left drag | Box-select |
| `V`, `G` | Select all, regroup into the triangle |
| `1` to `9` | Spells |
| `F`, `Shift`, `Q`, `Space` | Scatter, slow time, potion, auto-combat |

A character moved alone holds that spot until regrouped. The camera follows only when asked. The game is desktop-first.

## D-004

**Individual levels, XP split among the living.** XP from a kill splits equally among whoever is alive, and a dead character earns nothing. Benched characters earn 25%, so swapping one in never becomes a grind.

## D-005

**Upgrades are safe to +4, then risk destruction.** After +4 each step halves the odds: 50%, 25%, 12.5% and on to +10. A miss destroys the item, and the smith hands over a basic spare.

## D-006

**Five classes, with a Family House to rotate them.** There are five base classes and no named recruits. Players may create extra characters and rotate them through a Family House. Three take the field at once. The Fighter, Shooter and Healer exist; two classes are still to be designed.

## D-007
**Space is auto-combat, and also the test bot.** The squad roams the current island, killing and looting, and stops for bosses, danger or a cleared island. There is no reward penalty, because it plays less well than a person. The same code drives the CI bot.

## D-008

**The Healer auto-heals one person at a time.** It heals whoever is lowest, from a large mana pool with fast regeneration, and does no damage. Big heals, buffs and revives remain the player's choice.

## D-009

**TypeScript, three.js and a headless game core.** Vite, pnpm, Vitest, Playwright, ESLint and GitHub Actions on Node 24, deployed to GitHub Pages. Combat, loot, upgrades, XP and the world graph run without a browser, so they can be unit-tested and a bot can finish runs in CI.

## D-010

**MIT for new code; the 2019 files stay outside it.**

## D-011

**A world of safe cities and unsafe zones, and the goal is to help the frontier.** Cities are safe and hold NPCs. Map zones and dungeons are unsafe, each with its own monsters, item drops and levels. Characters help the frontier by levelling up, doing quests and reaching new cities. More story comes later.

This replaces the earlier premise of relighting beacons on islands that the sea is taking.

## D-012

**The marketplace is NPC shops.** Players buy and sell with NPCs. There is no trading between players, so the game needs no server or accounts.

## D-013

**The full control set, as approved in the squad test.** These extend D-003.

| Input | Action |
|---|---|
| `Z` `X` `C` | Select one character, as `F1` `F2` `F3` do |
| Up and down arrows | Pan, as `W` and `S` do |
| `Home` | Snap the camera to the squad and turn follow on |
| `R` | Reset rotation and tilt |
| `E` | Use the anvil |
| `H`, `N` | Hide help, mute sound |

The camera starts with follow on. Panning or gripping turns it off, and it stays off until the player asks for it. An order never turns it back on.

## D-014

**Commits: contributor and route.** Claude appears as a contributor through a `Co-Authored-By` line. This is a one-person project, so there are no pull requests: changes go straight to `master` once local checks pass and the maintainer approves.

## D-015

**The game core is deterministic and driven by commands.** The core advances in fixed ticks, 30 a second, from one seeded generator whose state is part of game state. Commands go in, and state and events come out. Commands name the units they act on where the rule needs it, and carry a world point or an ID, so the core never knows about the cursor, camera or selection. State is plain data, so a seed and a command list, each command stamped with its tick, reproduce a run under the same rules and data. Zones and items are data records, so the wider world in D-011 can build on them.

## D-016

**Four packages, and a guard on `legacy/`.** The code splits into `core`, `render`, `app` and `tools`. `core` holds the rules and depends on nothing, including the browser and Node. A read-only guard in the local checks and in CI proves that `legacy/` still matches the `v0-2019` tree. Line-ending rules name new file types only, there is no `.editorconfig`, and CI does not compile `ge.c`.

## D-017

**The public page goes live in S2.1, unlinked.** The empty island deploys to GitHub Pages, so the pipeline is proven early, and it can be switched off. The README does not link to it until the game is playable.

## D-018

**Code and data stay separate in the core.** `packages/core/src` holds logic, and `packages/core/data` holds typed data. Anything a designer might change is a parameter in the data: stats, formulas' constants, timings, ranges, tables, monsters, items, zones and world layout. Adding content should mean adding data, not changing logic. Lint keeps stray numbers out of the logic.

## D-019

**Packages meet at small, explicit interfaces.** Each package's `src/index.ts` is its whole public interface, and other packages import only from it. What crosses between packages is named, typed and read-only. `core` exposes plain data, never three.js or browser objects. A change to an interface is deliberate, and the brief that makes it says so. Inside a package, code stays simple: an abstraction waits until a second real use needs it.

**Why:** the game will grow to many cities, zones and quests, and the graphics will be redone after the base game works. Either should be possible without rewriting the rest.

## D-020

**Sniper replaces Shooter.** This is a relabel, with no change to how the class plays. It extends D-006. Wizard and Elementalist are working names for the last two classes, and their design is deferred. Work focuses on the Fighter, Sniper and Healer.

## D-021

**Zones joined by gates, with one live at a time.** The world is a set of zones, each with its own ground, coordinates and monsters. Towns, fields and dungeon floors are all zones, with a `kind`. Gates join them as a directed graph, and lands group them. Only the zone holding the squad runs. Enemies, shots, drops and scheduled effects sit in one live group, which is dropped on leaving.

- A gate holds its requirements and any cost, so a rare sea crossing is an ordinary gate. Lands have no rules of their own.
- All three characters cross together. Gates work during a fight, and the monsters reset.
- Packs respawn on a timer kept in the zone record, not on re-entry.
- A zone records its place in a shared world frame, a gate may be a stretch of edge, and art loads per zone. These keep near-seamless travel open: a later stage can show neighbouring zones as scenery and drop the fade, with no change to the rules.

This extends D-011 and D-015.

**Why:** a seamless world needs streaming and off-screen rules, at a high cost for a squad game in a browser.

## D-022

**Zone layouts are frozen, with rules and look kept apart.** Every player gets the same layouts on every run, and the seed decides only rolls such as crits, loot and upgrades. A tool may generate a layout, but the result is baked into a data file and committed. Each zone has a rules layer in `core` (walkable ground, obstacles, gates, packs) and a look layer in `render` (theme, colours, dressing). Select zones may vary their look on each visit. This extends D-015.

**Why:** random placement was one of the two causes of the squad test's stall, and hand-placed quests, tests and art all need fixed ground. Baking makes every change to the world visible in a diff.

## D-023

**One walkable grid for movement and routes.** Each zone has a grid of walkable cells, built from its data and not saved. Movement and pathfinding both read it, and A\* finds routes. Units follow those routes in place of walking straight.

**Why:** units give up after 0.7 seconds without progress, so a dungeon wall would stop them. A grid is the simplest structure that handles walls, and it also proves zones can be reached.

## D-024

**Saves are automatic, versioned and arrive in S3.** The game saves in the browser whenever no fight is on, and immediately after every anvil use. A save holds lasting data only: the family, quest progress, zone records, the current zone and the generator's state. It never holds the live group. Each save carries a format version, and a chain of tested steps moves old saves forward. A save newer than the build is refused. Content IDs are not deleted or reused without a migration. There is one save, with export and import to a file.

**Why:** playtesters cannot finish a region if a refresh wipes it. Saving after the anvil stops a reload undoing a destroyed item (D-005).

## D-025

**The family holds the store, and gear moves onto characters.** Items not in use are shared by the family. Equipping moves a gear item out of the store and onto one character, so it is always in exactly one place. A family may field three of one class, so a character's place in the triangle comes from its place in the active three, not from its class. How consumables are used remains open, and today's shared count stands until a second type is needed.

## D-026

**Attributes and stats are calculated in a fixed order.** Characters have five attributes: strength (STR), ranged ability (RAN), magical ability (MAG), vigour (VIG) and nimbleness (NIM). Each class has its own starting values and growth. Attributes feed stats through a data table. Each item's stats, multiplied by its upgrade, go on top, then effects, then any cap. Final stats are calculated, not saved.

- Stats are a named list, and monsters use the same sheet as characters.
- Most attribute growth is automatic. Players also get a few points to spend each level, with a cheap way to reset them. Spent points arrive after automatic growth works.
- Monsters skip attributes, and set their stats directly.
- Nimbleness never changes walking speed, because the squad moves as a triangle.
- One function resolves a hit, in order: accuracy against evade, block, crit, defence and resistance, then minimum damage.
- Evade is today's DR, renamed: a smooth multiplier with no random misses. Block is a chance, from shields.
- Every attack and spell has a damage type, for resistances.

**Why:** new stats and content should mean new data, and spent points give two characters of one class a reason to differ. Level no longer scales weapons, so squad-test values will not carry over exactly. Balance is deferred.

## D-027

**Arts decide what a character can use.** A class lists its arts, each with requirements. An art unlocks spells and weapon categories, and one category may belong to several arts. For now arts come automatically at a set level, and trainers or quests can be added as data. A spell needs its art and a matching weapon in hand, unless it names none. Each class starts with one art covering its three spells.

## D-028

**Seven gear slots to start, on shared item types.** The slots are main hand, off hand, head, chest, gloves, boots and necklace, and more can be added as data. Each item type lists the slots it fits and fills, which covers two-handed weapons and later rings. An item is its type plus its upgrade for now. Item boosts, such as more attack speed or damage, come later and use the named attribute and stat lists. Whether they vary between items is decided then. The weapon sets range, base attack speed and knockback, and names which attack stat it uses. Armour is shared across classes, and each class keeps an armour skill. Any slot may be empty. Each item type has requirements and a price, so a stronger pistol is another type with a higher level requirement. The spare in D-005 becomes a basic item type for that slot. The upgrade odds do not change.

**Why:** with five classes, twelve slots and five tiers, class-specific gear means 300 items, and class-specific weapons alone mean 80.

## D-029

**Definitions and instances, and a data model document.** Every entity is either a definition, which is fixed data, or an instance, which changes in play. `docs/DATA-MODEL.md` holds the glossary, entity relationships, the entity catalogue and the data structures, and stays conceptual. Exact fields stay in the TypeScript types. A brief that changes an entity, a relationship or a rule there updates it. A data structure enters only when a real need demands it, and the brief says why it won.

**Why:** the repository should teach as well as work, and teaching should follow real needs.

## D-030

**Graphics come in two steps.** The game keeps the squad test's level of 3D through S3 and S4, with a palette for each zone theme. A new stage, S5, then does the lift: art direction, an asset source, a performance budget, and reworking what exists. It comes before the bulk of content, so that nothing is made twice. If playtesters drop off because of how the game looks, S5 comes forward.

**Why:** art cost scales with content. The simple look is good enough to build on, so the lift need not come before going public.

## D-031

**Spell keys in a grid, one row per character.** This replaces the keyboard parts of D-003 and D-013. The mouse controls do not change.

| Input | Action |
|---|---|
| `Q` `W` `E` `R` | Spells of the first character in the active three |
| `A` `S` `D` `F` | Spells of the second |
| `Z` `X` `C` `V` | Spells of the third |
| `1` `2` `3`, `F1` `F2` `F3` | Select one character |
| `4` | Select all |
| `G` | Regroup into the triangle |
| Arrow keys | Pan, relative to the view |
| `,` `.` | Rotate |
| `Backspace` | Reset rotation and tilt |
| Hold `T` + left click | Attack-move |
| `5` | Potion |
| `B` | Scatter |
| `Y` | Use the anvil |

Right click, right drag, middle drag, the wheel, left click and left drag, `Space`, `Shift`, `Home`, `H` and `N` keep their meanings. A row belongs to a character's place in the active three, not its class (D-025), and its keys follow the character's spell list in order (D-027), so a fourth spell takes the fourth key. Keys are read by position on the keyboard, so the grid keeps its shape on other layouts.

**Why:** each character's spells sit under one row of the left hand, and each row has room for a fourth spell. The cost is panning from the left hand: it moves to the arrow keys and the right-drag grip.

## D-032

**Saves go through a storage interface.** This extends D-024. The core turns lasting state into a versioned save and back, and never touches storage. The app package reads and writes saves only through a small `SaveStore` interface: load, save and delete one whole save. S3 builds one store, on browser storage. Export and import to a file sit beside the store, not inside it. Migration (D-024) runs on every save loaded, whichever store it came from. The S3 brief sets the exact methods.

**Why:** a cloud store (D-033) can then be added without touching the core or the save format. This is D-019 applied to saves.

## D-033

**Optional sign-in and cloud saves, after browser saves work.** If accepted, this replaces the "no server or accounts" part of D-012. NPC shops, and no trading between players, still stand.

- Signing in is optional. Without it the game plays in full on browser saves.
- Sign-in and storage come from a hosted service, not a server this project runs. Supabase is the working choice: a Postgres database with sign-in by email link or GitHub. The game stays on GitHub Pages.
- The project never holds passwords. It holds a sign-in identity, an email address or GitHub account, and that player's save.
- Row-level security is on: each player reads and writes only their own save. The public key may sit in the repo only because of that. The service key never enters the repo, CI or a log.
- The cloud store is a second `SaveStore` (D-032), with the same format, versions and migration. When the browser and the cloud both hold a save, the player chooses which to keep, shown with dates and levels.
- Before sign-in goes live, the game has a short privacy notice and a way to delete an account and its save.
- Out of scope: trading, chat and leaderboards. Leaderboards may follow, checked by replaying runs on a server (D-015).
- Not before S3's browser saves ship. Its stage is set when it is accepted.

**Why:** playtesters can keep one save across devices, and the maintainer learns how a backend, sign-in and authorisation work on a real need. Hosted sign-in removes the riskiest part, storing passwords.

## D-034

**Controls after the first play of S2.3a.** This changes D-003, D-013 and D-031 where they differ.

| Input | Action |
|---|---|
| Right drag | Rotate and tilt the camera |
| Middle drag | Grip the camera |
| `Ctrl` + left click (`Cmd` on a Mac) | Attack-move: fight every enemy met on the way to the point |
| `F1` `F2` `F3` | Select one character |
| `F4` | Select all |

`1` to `4` and `T` no longer act. The camera starts with follow on. Panning or gripping turns it off, and any move or target order turns it back on, so the camera goes with the squad.

**Why:** the maintainer's first play beside the squad test. Rotating is the camera move used most, so it takes the easiest drag. Follow coming back on an order keeps the squad in view without pressing `Home`.

## D-035

**Auto-combat runs per character.** This extends D-007. `Space` puts the selected characters into auto-combat, or takes them out if they are all in it already. With everyone selected it runs the whole squad, as before. An order takes only the characters it names out of auto-combat, and regroup and scatter take everyone out. Selecting a character no longer stops it. The core's `autoCommands` takes an optional list of unit IDs, and runs only those characters.

**Why:** the maintainer's first play. One character can fight on alone while the player commands the others.

## D-036

**Auto-combat fights bosses.** This changes D-007, which stopped auto-combat for bosses. With a boss awake, `Space` keeps running for the characters in it: any of them not already fighting or walking is sent at the boss, and potions are still used. It still stops for danger, a cleared zone, a wipe or victory.

**Why:** the maintainer's play of S2.3b, which asked for auto-combat to stop refusing while the boss is awake.

## D-037

**The camera follows a character selected alone.** This extends D-034. Selecting one character on their own, by `F1` to `F3`, a click, a card or a box around one, turns follow on, and the camera follows that character. With more than one selected, or if that character goes down, it follows the middle of everyone up. `Home` snaps to whatever the camera follows.

**Why:** the maintainer's play of S2.3b, which asked for the camera to follow a character in individual mode.

## D-038

**The world borrows the 2019 shape, with original names and places.** The 2019 game in `legacy/` was modelled on another game's world, so its places, monsters, NPCs and items are not reused. Its structure is reused, as a pattern rather than a map. This extends D-011 and D-021.

- **Borrowed:** towns as safe hubs, fields fanning out from them, dungeons as dead ends that end in a boss, levels that rise with distance from the start, and fast travel as a gate with a cost.
- **Not borrowed:** any name, map layout, monster, NPC or item from `legacy/assets`. Every land, zone, monster and NPC is new.
- **Names keep the 2019 feel without its names.** They come from Portuguese, Spanish, Italian and French, mostly describing the place in its own language. No exact names and no near-copies: no one-letter changes, respellings or matching endings. Where a 2019 name was a real town, a real neighbour of it may stand in. The first cities are Montclaire, Port Mondego, City of Dax, Ignota Base Camp and Ilha Brava Island.
- **Systems from 2019 carry over.** Item tiers by level, potions in rising strengths, crafting materials refined in grades, and level bands across the map are the maintainer's design and stay, with new names.
- **Levels rise in steps.** A gate's requirements stop a new family walking from a starting field into a much higher one, which the 2019 map allowed.
- **Every link is checked.** Two-way travel is two gates, and the reachability check in `docs/DATA-MODEL.md` covers every zone, so a misspelt or one-sided link fails a test.
- `legacy/` stays untouched as the historical record (D-016).

**Why:** the project is public and MIT-licensed, and `NOTICE` already keeps the 2019 files outside that licence. The 2019 game's value is its shape, which suits a squad game, not its names.

## D-039

**Upgrades come only from a smith in a town.** The anvil is reached only by talking to a smith NPC in a town, never in a field or dungeon. This extends D-005 and D-012, and replaces the anvil's place in the field.

- Every town has an upgrade merchant. Who they are, and whether towns differ, is settled with the town briefs.
- The field anvil on Lande de Montclaire stays as a stand-in until the town brief builds Montclaire and its smith, then it is removed.
- Towns are safe, so no upgrade happens during a fight.
- The odds, costs and spares in D-005 do not change, and a save still follows every result (D-024).
- Bots and auto-combat must then walk to town to upgrade, so the town brief gives them a way to plan a route across zones.

**Why:** the maintainer's direction. It makes towns matter, matches the 2019 game's upgrade merchants, and makes the risk of an upgrade a trip, not a key press in the field.

## D-040

**`Alt` + `E` opens the inventory.** This extends D-034. The inventory screen (brief S3b) opens and closes with `Alt` + `E`, anywhere, including in fields and dungeons. Holding `Alt` keeps `E` from casting the first character's third spell (D-031). `Esc` also closes it. The key is read by position, so it works on other layouts and on a Mac, where `Option` + `E` would otherwise type an accent.

**Why:** the maintainer's direction. The inventory should be reachable on the battlefield without a spell key firing by mistake.

## D-041

**The store is called the inventory.** The family's shared items, every item not equipped, are the inventory: `family.inventory` in code, and "Inventory" on the screen. This names a part of D-025, which is not rewritten. Closed briefs (S2.3b, S3a and S3b) keep the old word, as records. The rename landed in S3c before any save existed, so no save ever holds the old name and no migration is needed.

**Why:** the maintainer's direction (8 Nov 2026). "Store" would clash with `SaveStore` (D-032) and with the town's shops (D-012).

## D-042

**A failed upgrade breaks the item, and the smith repairs it.** This replaces D-005, and the spare in D-028 and D-039.

- **Pick an item, not a slot.** The smith upgrades any weapon or armour the family owns, worn or in the inventory.
- **Weapons and armour only:** main hand, off hand, head, chest, gloves and boots. Jewellery, the necklace now and rings later, is never upgraded, and earns its value another way later.
- **The odds do not change.** Steps up to +4 always succeed. From +4 to +5 the chance is 50%, and each step after halves it: 25%, 12.5% and on to +10. The smith shows the chance, and that a miss breaks the item, before the player confirms.
- **A miss breaks the item; nothing is destroyed.** A broken item cannot be worn. If it was worn, it goes to the inventory and leaves its slot empty. It keeps its type and the level it broke at.
- **The smith repairs a broken item to +4,** for marks scaled by the level it broke at. The player loses the levels above +4 and the fee, never the item. Costs and the repair fee are data, and placeholders until balance.
- **There is no spare.** The plain item types go, and a save migration turns each one into the type it stood in for.
- A save still follows every result (D-024).

**Why:** the maintainer's direction, 8 Nov 2026. Losing the levels, not the item, keeps the risk real without wiping out a favourite piece of gear, and it needs no shop to replace what was lost. The 2019 game meant the same odds; its code inverted them (`rand()%power` succeeds on every value but one), which `legacy/` keeps as its record.

## D-043

**Montclaire comes first as a place to walk, and its systems arrive one at a time.** This extends D-011, D-030, D-038 and D-039.

- **The first slice is a town to walk around:** streets, a square and buildings, with a gate out to Lande de Montclaire, and no NPCs or shops. The game starts there.
- **Each later slice adds one step of the core loop,** in order: the smith (spending on gear), the shop (buying and selling), then trainers and quest givers. Each is its own brief.
- **The theme follows the 2019 game's feel, not its layout.** The 2019 game was text only, so it has no streets to copy. Its towns were Mediterranean, French and Portuguese ports and market towns, and Montclaire follows them (D-038).
- **The look stays at prototype level** (D-030): simple buildings, roofs, streets and a town palette, composed with care. Anything more is S5's work.
- **Buildings never hide the squad.** A building between the camera and a character in the active three fades while it is in the way.
- The field anvil stays until the smith's brief, as D-039 allows.

**Why:** the maintainer's direction, 8 Nov 2026. The town is the hub of the core loop, so it should exist early and grow, and each slice is small enough to see running and learn from.

## D-044

**NPCs are placed in zones and offer a list of services.** This extends D-029, D-039 and D-043.

- **An NPC is a definition placed on a zone:** an ID, a name, a point in the zone, a list of services and a list of quests. A lot is one way to give it a place, and is not required.
- **Any zone can hold one,** town or not. Either list may be empty, so an NPC can give quests and sell nothing.
- **A service is a type on that list.** The first are `smith`, `enhancer`, `bank` and `shop`. A later kind of NPC is one more type. The smith stays in towns (D-039).
- **No talking during a fight.** Talking is refused while any enemy is awake, as equipping is.
- **Unlocks come from quest progress.** Anything an NPC holds back names a quest that must be finished, in the shared requirement shape. Only quest progress is saved, so no separate list of unlocks exists.

**Why:** the maintainer's direction, 8 Nov 2026. One seller can also give quests and reward them with stock, and a new kind of NPC should not need a new structure.

## D-045

**A shop sells from its own list of offers.** This extends D-012.

- **Item types stay global, and an offer points at one.** Several NPCs can sell the same item, each from its own selection.
- **Lists are written by hand,** so a new item never reaches a shop by accident.
- **An offer's requirement is about the family,** such as a quest finished. Level and art limits stay on the item type, and stop a character equipping it, not the family buying it.
- **The first seller sells Sniper weapons only.** Pistols, rifles and shotguns are the Sniper's weapon categories. The shop's list releases rifles first, and the others are added when the arts that use them exist.

**Why:** the maintainer's direction, 8 Nov 2026. Selling the same item from different NPCs must not mean defining it twice, and a list controls what is released.

## D-046

**Enhancements are random, and an item can hold several.** This settles what D-028 left open: boosts vary between items.

- **An enhancement is a random boost to a named stat,** such as attack speed or attack damage, made by the Enhancer and stored on that one item.
- **An item can hold more than one.** How many, which stats, how large, what it costs and what a further attempt does are rules for the Enhancer's brief.
- **Results come from the game's seeded generator,** and a save follows each one (D-024), so a reload cannot undo a roll.

**Why:** the maintainer's direction, 8 Nov 2026.

## D-047

**The bank is shared across towns.** The bank belongs to the family, and any banker reaches the same store. An item can then be in one of three places: the inventory, a character's slot or the bank, and still only one at a time. The inventory has a limited number of slots. The limit and what happens when it is full are rules for the bank's brief, which waits until items drop as loot.

**Why:** the maintainer's direction, 8 Nov 2026. A bank per town would add hauling without adding decisions.

## D-048

**A character knows several arts, with one active at a time.** This extends D-027.

- **The active art decides the spells.** Changing art changes the spells, and a spell's weapon comes from its art.
- **Arts can be switched anywhere,** in a town or out in a zone.
- Whether a switch is allowed during a fight, and what happens to a weapon the new art does not permit, are rules for the arts brief.

**Why:** the maintainer's direction, 8 Nov 2026.

## D-049

**One combat sheet, and the 2019 hit formula with three fixes.** This changes D-026.

- **Characters and monsters share a sheet:** health, attack, attack speed, AR, DR, defence, crit, and fire, ice, lightning and mental resistance. Monsters also carry the XP they grant. There are no hits per attack.
- **AR and DR stay, and evade goes.** Block stays planned for shields.
- **The formula comes from `player_damage_calc` and `monster_damage_calc` in `legacy/ge.c`:** a character's attack is multiplied by 1.6 and doubled on a crit, AR below DR takes 10% for the difference plus one, and each point of defence takes 0.5%, up to 95%.
- **Three fixes:** AR above DR adds a steady 25% a point up to +200%, damage has a floor so a hit cannot heal, and the final ×3 goes, because three real bodies now fight.
- **No healing is carried over from the 2019 battle loop.** The Healer and potions are unchanged.
- Resistances do nothing until attacks have damage types.

**Why:** the maintainer's direction, 9 Nov 2026. The 2019 formula was tuned by hand, and is the place to start tuning from.

## D-050

**The Lande's monsters are a wasp, a rooster, a viper and a wild boar.** They replace the squad test's four, keep its behaviours, and suit a lavender heath. Each type carries its own full sheet and attack speed. Names are working names (D-038), and families of monsters wait for a later brief. Placement stays fixed (D-022), and a monster that would respawn on a character shifts to a clear spot.

**Why:** the maintainer's direction, 9 Nov 2026.

## D-051

**XP depends on the gap between a character's level and the monster's.** This extends D-004. After the equal split, each character earns by its own level, in bands from the 2019 `exp_from_kill`: 60% when more than 10 levels above the monster, none when more than 10 levels plus a tenth of its level above, and a bonus when well below it.

**Why:** the maintainer's direction, 9 Nov 2026. Nobody should reach the top level in an easy zone, so farming pushes players to harder ones.

## D-052

**No bosses for now, and the game does not end.** This replaces D-036 for now. The Warden comes off the Lande, and winning goes from play. The boss code stays, unused. Not every zone will have a boss. Later they come as random empowered monsters during long farming, or deliberately through quests and raids. Every bot run still has a clear finish and a hard time limit.

**Why:** the maintainer's direction, 9 Nov 2026.

## D-053

**Farming while away is the core of the game.** The squad should be able to keep hunting and levelling with no one at the keyboard. Its own brief settles how the game runs in a hidden browser tab, how auto-combat keeps hunting, and saving during non-stop fights.

**Why:** the maintainer's direction, 9 Nov 2026.

## D-054

**The money is called sol.** An old French coin, and one syllable. The name is what the player sees. It arrives with the shop, and open to the naming session (D-038).

**Why:** the maintainer's direction, 9 Nov 2026.

## D-055

**Monsters drop trophies and gear, and dropped gear may carry enhancements.** This extends D-046.

- **A trophy** is a common body part that cannot be worn. Weapons and armour are rarer.
- **All dropped gear is +0, and may carry unknown enhancements.** Gear from a shop has none.
- **Items a monster drops fly into a character** and reach the inventory. There is no way for a player to drop an item on the ground.
- Rates, and what "unknown" means in play, are rules for the drops brief.

**Why:** the maintainer's direction, 9 Nov 2026. An enhanced drop can beat the same item from a shop, so drops are worth having.

## D-056

**Evade and block are on the shared combat sheet.** This changes D-049, which removed evade and left block off the sheet. Characters and monsters both carry evade and block, at 0, and neither does anything yet, like the resistances. AR and DR stay as D-049 has them. What evade and block do in a hit is for the brief that brings them to life.

**Why:** the maintainer's direction, 9 Nov 2026, during the S3f build.

## D-057

**Field zones are 240 by 240 units by default.** That is the whole footprint, mountains included. Each field may vary by about a quarter. Towns and dungeons are sized by their own needs. Carrefour du Colosse sets the baseline, with about 14,000 square units of walkable ground and a main road of about 258 units.

**Why:** the maintainer's direction, 9 Nov 2026, from a 3D wireframe of the zone. The size is judged in play when M1 is built.

## D-058

**Each zone has its own brief, one at a time.** Map briefs are numbered M1, M2 and so on, in the order they are built. A zone closes only when the maintainer is happy with how it looks, and more work on a closed zone's look comes back as M1.1, M1.2. Art beyond prototype level stays with S5 (D-030).

**Why:** the maintainer's direction, 9 Nov 2026. Each zone should look good, and that can be done incrementally.

## D-059

**A field's stretches may be narrower than the squad's triangle.** The squad need not keep its triangle, and going single file through a narrow stretch is fine. Every stretch of a route is at least 4 units wide in any direction, measured on the map's shapes. Stretches 10.6 or wider still fit the triangle. This replaces the width rule M1 applied to its own road, for Garganta da Cidadela and the zones after it. Narrow stretches are for passing through, not fighting in.

**Why:** the maintainer's direction, 9 Nov 2026, from the sketch of Garganta da Cidadela (M2). A corridor is a new kind of ground for the game, and forcing the triangle's width on it would have lost the corridor.

## D-060

**A monster takes a route only when a straight line to its target is blocked.** This replaces S3a decision 8. The line is tested on the ground a monster may stand on, so a stone alone starts no route and a monster still slides round it. The route comes from the same A\* and smoothing as a character's (D-023), on that same ground, and is followed the same way. Each monster searches at most twice a second, on a tick of its own. While it has a route, a monster may also step off closed ground and slide along whichever axis is free, as a character does. A route belongs to the live group and is never saved. The boss does not change. Monsters still chase until one side is dead or the squad leaves the zone.

**Why:** Garganta da Cidadela was the first zone with bends. Monsters chasing in straight lines stood against the rock, awake, for most of a chase, which refused equipping and held off autosave (M2, S3i).
