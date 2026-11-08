# The New Frontier

**A free, open-source 3D squad RPG for your browser. Command three characters at once, level them up, and help the frontier reach new cities.**

![The Fighter, Sniper and Healer interrupting a boss in the squad test](docs/media/squad-test.jpg)

*Early squad test. The Sniper has just interrupted the boss's charged blast.*

**[Play it in your browser](https://huntling94.github.io/the-new-frontier/)**, on a desktop with a mouse and keyboard.

> **Status: early development.** One island, three characters and one boss, playable from the start screen to victory.

## Purpose

In 2018-2019 as part of studying computer science, I deepened my understanding of C and fundamental algorithms and data structures by writing a text RPG inspired by an MMORPG I played when I was younger. It ran to nearly 5,000 lines, but was only terminal-based. Now with Claude Code, I wanted to port it into a quick and simple 3D game.

The New Frontier expands my original text-based port into a full-fledged 3D game.

| In 2019 | In The New Frontier |
|---|---|
| Damage multiplied by 3 | Three characters you command at once |
| A comment describing a heal | A Healer who keeps your squad alive |
| An auto-battler for testing levelling | `Space` for auto-combat, which also tests the game in CI |
| Upgrade odds that ran backwards | Risky upgrades that work as promised |

## What it plays like

- **Three bodies, one player.** Your squad fights by itself. You decide where they stand and when to spend their spells.
- **Choices that sting.** XP splits among the living, and every upgrade past +4 can destroy the item.
- **No grind.** Auto-combat handles what is dull, and you choose which characters it runs.

## Saves

The game saves itself in your browser whenever no fight is on, at most every 15 seconds, and straight after every anvil result, so a reload never undoes an upgrade. The top right of the screen says when it last saved. Next time, the start screen offers **Continue**, with your characters' levels and when you saved.

- **One save per browser.** It lives in this browser's storage, so clearing the site's data deletes it. **New game** asks before it replaces it.
- **Export and import.** The start screen downloads your save as a `.json` file, and reads one back, to keep a copy or move a game to another browser.
- **Saves move forward.** Each save carries a version, and later builds upgrade old saves rather than refuse them. A save from a newer build is refused and left alone.
- **Bot and test runs never save,** so `?bot=careful` on the public page cannot overwrite your game.

## How it's made

I direct this project, and it is built with [Claude Code](https://claude.com/claude-code). Every change starts as a written brief, and every significant choice is logged:

- [Vision](VISION.md) and [roadmap](docs/ROADMAP.md)
- [Decision register](docs/DECISIONS.md)
- [Implementation briefs](docs/briefs/)
- [Current state](STATE.md)

## The original

The 2019 game is preserved, bugs and all, in [`legacy/`](legacy/) and at the tag [`v0-2019`](../../tree/v0-2019).

## Licence

New code is [MIT](LICENSE). The files in `legacy/` are excluded: see [NOTICE](NOTICE).
