# Decision register

Every design and architecture decision, in one place. Entries are never rewritten: a later decision replaces an earlier one by a new entry, and the old entry is marked as replaced.

| ID | Decision | Status | Date |
|---|---|---|---|
| [D-001](#d-001) | Command three characters at once | Accepted | 7 Nov 2026 |
| [D-002](#d-002) | Name: The New Frontier | Accepted | 7 Nov 2026 |
| [D-003](#d-003) | Right-click control and a free rotating camera | Accepted, extended by D-013 | 7 Nov 2026 |
| [D-004](#d-004) | Individual levels, XP split among the living | Accepted | 7 Nov 2026 |
| [D-005](#d-005) | Upgrades are safe to +4, then risk destruction | Accepted | 7 Nov 2026 |
| [D-006](#d-006) | Five classes, with a Family House to rotate them | Accepted | 7 Nov 2026 |
| [D-007](#d-007) | Space is auto-combat, and also the test bot | Accepted | 7 Nov 2026 |
| [D-008](#d-008) | The Healer auto-heals one person at a time | Accepted | 7 Nov 2026 |
| [D-009](#d-009) | TypeScript, three.js and a headless game core | Accepted | 7 Nov 2026 |
| [D-010](#d-010) | MIT for new code; the 2019 files stay outside it | Accepted | 7 Nov 2026 |
| [D-011](#d-011) | A world of safe cities and unsafe zones, and the goal is to help the frontier | Accepted | 7 Nov 2026 |
| [D-012](#d-012) | The marketplace is NPC shops | Accepted | 7 Nov 2026 |
| [D-013](#d-013) | The full control set, as approved in the squad test | Accepted | 7 Nov 2026 |
| [D-014](#d-014) | Commits: contributor and route | Accepted | 7 Nov 2026 |
| [D-015](#d-015) | The game core is deterministic and driven by commands | Proposed | 7 Nov 2026 |
| [D-016](#d-016) | Four packages, and a guard on `legacy/` | Accepted | 7 Nov 2026 |
| [D-017](#d-017) | The public page goes live in S2.1, unlinked | Accepted | 7 Nov 2026 |
| [D-018](#d-018) | Code and data stay separate in the core | Accepted | 7 Nov 2026 |

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

**The game core is deterministic and driven by commands.** The core advances in fixed ticks, 30 a second, from one seeded random generator. Commands go in, and state and events come out. Commands name their units and carry a world point or an ID, so the core never knows about the cursor, camera or selection. State is plain data, so a seed and a command list reproduce a run. Zones and items are data records, so the wider world in D-011 can build on them.

## D-016

**Four packages, and a guard on `legacy/`.** The code splits into `core`, `render`, `app` and `tools`. `core` holds the rules and depends on nothing, including the browser and Node. A read-only guard in the local checks and in CI proves that `legacy/` still matches the `v0-2019` tree. Line-ending rules name new file types only, there is no `.editorconfig`, and CI does not compile `ge.c`.

## D-017

**The public page goes live in S2.1, unlinked.** The empty island deploys to GitHub Pages, so the pipeline is proven early, and it can be switched off. The README does not link to it until the game is playable.

## D-018

**Code and data stay separate in the core.** `packages/core/src` holds logic, and `packages/core/data` holds typed data. Anything a designer might change is a parameter in the data: stats, formulas' constants, timings, ranges, tables, monsters, items, zones and world layout. Adding content should mean adding data, not changing logic. Lint keeps stray numbers out of the logic.
