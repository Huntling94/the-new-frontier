# Decision register

Every design and architecture decision, in one place. Entries are never rewritten: a later decision replaces an earlier one by a new entry, and the old entry is marked as replaced.

| ID | Decision | Status | Date |
|---|---|---|---|
| [D-001](#d-001) | Command three characters at once | Accepted | 7 Nov 2026 |
| [D-002](#d-002) | Name: The New Frontier | Accepted | 7 Nov 2026 |
| [D-003](#d-003) | Right-click control and a free rotating camera | Accepted | 7 Nov 2026 |
| [D-004](#d-004) | Individual levels, XP split among the living | Accepted | 7 Nov 2026 |
| [D-005](#d-005) | Upgrades are safe to +4, then risk destruction | Accepted | 7 Nov 2026 |
| [D-006](#d-006) | Five classes, with a Family House to rotate them | Accepted | 7 Nov 2026 |
| [D-007](#d-007) | Space is auto-combat, and also the test bot | Accepted | 7 Nov 2026 |
| [D-008](#d-008) | The Healer auto-heals one person at a time | Accepted | 7 Nov 2026 |
| [D-009](#d-009) | TypeScript, three.js and a headless game core | Proposed | 7 Nov 2026 |
| [D-010](#d-010) | MIT for new code; the 2019 files stay outside it | Proposed | 7 Nov 2026 |

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
