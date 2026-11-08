# Brief S3f — Monsters and combat

**Status:** agreed 9 Nov 2026
**Read first:** `STATE.md`, `ARCHITECTURE.md`, `docs/DATA-MODEL.md`, brief S3e, D-004, D-021, D-022, D-026, D-036, D-038, and `legacy/ge.c` lines 2582 to 2658 and 2671 to 2710.
**Depends on:** S3e closed.
**Goal:** the maintainer walks onto the Lande and fights wasps, roosters, vipers and wild boars, with no boss and no end to the run, and packs keep coming back.

## Why now

The Lande's monsters came from the squad test's beach and volcano, and do not belong on a lavender heath. Drops and the shop (S3g) need to know which monsters exist. The combat sheet also needs settling first: monsters share a hit formula that drifted from the one the maintainer tuned in 2019, resistances do not exist, and every monster strikes at the same random speed. The game can only end by killing the Warden, which does not suit a game about farming (S3h).

The shop, buying and selling move to S3g, so this replaces the scope S3e gave S3f. The inventory's pause and UX pass move to their own brief.

## Decisions

D-049 to D-052 are in the register. D-049 is the combat sheet and formula, D-050 the monsters, D-051 XP and D-052 no bosses.

**The combat sheet** (D-049, changes D-026)

1. **Characters and monsters share one sheet:** health, attack, attack speed, AR, DR, defence, crit, and fire, ice, lightning and mental resistance. A monster also has the XP it grants. Characters grant none.
2. **AR and DR stay, and evade goes.** D-026 renamed DR to evade; this reverses that. Block stays planned for shields, and is not built here.
3. **There are no hits per attack.** The 2019 field is not carried over.
4. **Resistances are on the sheet, and do nothing yet.** Every hit is physical today, and physical uses none. Each is 0 for now. The spells that deal those types bring them to life, in their own brief.
5. **Each monster type has its own attack speed,** in place of today's random 1.1 to 1.8 seconds, as seconds between strikes: wasp 1.1, rooster 1.4, viper 1.6, boar 1.8. First strikes stay as they are.

**The hit formula** (D-049), from `player_damage_calc` and `monster_damage_calc` in `legacy/ge.c`, with three fixes. `legacy/` itself does not change.

6. **Character attack is multiplied by 1.6, and a crit doubles it,** as today. Monster attack has neither.
7. **AR above DR adds a steady 25% a point, up to +200%.** Fix: the 2019 `abs(3-dADR)` gave 3 points over DR no bonus at all. This matches today.
8. **AR below DR takes 10% for the difference plus one:** -20% at 1 below, -30% at 2 and -40% at 3, down to a floor. Fix: the floor is 10% of the damage, because the 2019 code went negative at 10 below, so a hit healed its target.
9. **Each point of defence takes 0.5%, up to 95%.** Today's limit is 75%. The 2019 rounding of odd defence is not carried over.
10. **There is no final ×3.** Fix: the 2019 code stood it in for three characters, and the game now has three bodies. No healing is carried over from `battle_monster`. The Healer's healing and potions are unchanged.

**XP** (D-051)

11. **Each character earns by its own level,** after the equal split among the living (D-004). A character more than 10 levels above the monster gets 60%, and more than 10 levels plus a tenth of its level above gets none. One more than 5 levels below the monster gets 140%, and more than 20 levels below gets 120%. Otherwise it gets 100%. The bands are data, and are from the 2019 `exp_from_kill`, without its small bonus that grows with level.

**The monsters** (D-050)

Numbers below are starting points, to be tuned.

12. **Four types replace the four on the Lande and in the cave,** with the same behaviour, and level on the pack as today. Each carries its own full sheet; families of monsters wait for a later brief. Monster types are not saved, so their IDs change with no migration.

| New | Replaces | Role | Health and attack share |
|---|---|---|---|
| Wasp | Sand Skitter | Fast, weak, in numbers | 0.4, 0.6 |
| Rooster | Tide Crab | Standard melee | 1, 1 |
| Viper | Spit Anemone | Spits from range, backs away | 0.8, 0.9 |
| Wild Boar | Slag Golem | Big, area slam, speed 6 | 2.8, 1.7 |

13. **Packs on the Lande keep their places, levels and counts.** The cave becomes boars and wasps: one boar and three wasps at level 4. If a boar is too big for the cave in play, the maintainer decides.
14. **Each new monster has a simple shape,** at today's level of 3D (D-030). Names are working names until the naming session (D-038).
15. **Coins and the potion chance do not change.** Drops are S3g.

**No boss, no winning** (D-052, replaces D-036 for now)

16. **The Warden comes off the Lande.** Its code stays in place unused, for quest and raid bosses later. No player sees it.
17. **The game does not end.** The victory screen and victory state go from play. The Lande carries on when it is clear.
18. **Saves do not change format.** A boss marked dead in an old save is harmless.

**Spawning** (D-022 stands)

19. **Placement stays fixed.** A zone maximum and an algorithm that spreads monsters out wait for random placement, on the backlog in `STATE.md`.
20. **A pack still respawns on the game clock,** at 180 seconds, near the squad if the squad is there. A monster that would land on a character shifts to the nearest clear walkable spot, at a clearance in data.

**Bots**

21. **A bot run always ends.** It finishes when every pack on the Lande has been cleared at least once in that run, and the bot has upgraded as it does today. "At least once" matters, because packs come back and may never all be gone at the same moment. Every run also has a hard limit in game time, in data: a run that reaches it stops and counts as a failed, stalled run, never a finish. The 100-seed report changes once. Before and after are recorded.
22. **Auto-combat is unchanged:** it clears the zone that runs, and does not keep hunting yet (S3h).

## Scope

**In:**

- The shared sheet, the hit formula, and attack speed per monster.
- XP by level difference.
- Four new monsters and their shapes, the cave's new pack, and removing the Warden and winning from play.
- A collision check when a pack respawns.
- New finish lines for bots and the report.
- `docs/DATA-MODEL.md` and `ARCHITECTURE.md` updated to match.

**Out:**

- Monster drops, trophies, enhanced drops, the shop, and renaming the money (S3g).
- Auto-combat that keeps hunting, hidden tabs, and saving during non-stop farming (S3h).
- Random placement, a zone maximum and a spread algorithm (backlog).
- Random empowered monsters when AFK, and quest or raid bosses (backlog).
- Spells with damage types, and block (no brief yet).
- The inventory's pause and UX pass (no brief yet).
- Balance, including health, attack and respawn numbers (no brief yet).

## Done means

1. `pnpm check` passes.
2. Unit tests prove:
   - The hit formula at AR 3 below, 1 below, equal, 1 above, 3 above and 12 above DR, and at the floor.
   - Defence stops at 95%.
   - No hit does less than the minimum damage, and none heals.
   - Each XP band, for characters of different levels in one kill.
   - A pack that respawns on the squad places no monster within the clearance, and on walkable ground.
   - Each monster strikes at its own speed.
   - The Lande has no boss, and clearing it ends nothing for a player.
   - A bot run ends once every pack has been cleared at least once, even if packs have come back since.
   - A bot run that cannot finish stops at the time limit and is reported as stalled.
   - The version 1 and version 2 example saves still load, including one with the boss marked dead.
3. `pnpm sim:report --seeds 100`: the careful and sloppy bots each finish 100 of 100 with no stalls, and auto-combat clears all 100. Before and after, with the moved hashes, are recorded, since the finish line and damage both change.
4. `pnpm test:e2e` passes, changed where it expects a boss or victory. Any test changed is listed with why.
5. `docs/DATA-MODEL.md` shows the sheet, the hit order, and monster types and the boss as they now stand.
6. The maintainer has approved the exact file list and diff before any commit.
7. **The maintainer has played it:** start on the Lande, fight each of the four monsters, and clear the Lande, then wait for a pack to come back. Questions:
   - Can you tell the four apart, in looks and in how they fight?
   - Does a hit feel right now the formula has changed?
   - With nothing to win, does the Lande still feel worth being on?

## Stop and ask if

- The new formula leaves any bot unable to clear the Lande.
- Removing victory needs more than taking it out of play, or forces a save migration.
- Keeping the boss code unused breaks a check, such as dead-code linting.
- A boar cannot fit the cave.
- Any standing trigger in `CLAUDE.md` fires.

## Outcome (builder fills in)

Built 9 Nov 2026, in a worktree. Closed 9 Nov 2026: the maintainer played it and approved the file list and diff.

**Changed during the build, at the maintainer's direction:** evade and block are on the shared sheet, at 0, and do nothing yet (D-056). This changes decision 2 and D-049. AR and DR stay as agreed.

**Checks:** `pnpm check` passes, with 529 unit tests and the `legacy/` guard. `pnpm test:e2e` passes, 32 of 32.

**The 100-seed report.** The finish line moved from killing the Warden to every pack cleared at least once with the marks spent.

| | Before (`bc3ddd5`) | After |
|---|---|---|
| Careful bot | finished 100 of 100, stalled 0 | finished 100 of 100, stalled 0 |
| Sloppy bot | finished 100 of 100, stalled 0 | finished 100 of 100, stalled 0 |
| Game minutes (careful, sloppy) | 2.7, 2.8 | 1.8, 1.8 |
| Wipes, characters down | 0, 0 | 0, 0 |
| Upgrades | 10.2 | 10.4 |
| Lowest level | 6.0 | 6.0 |
| Interrupts (careful) | 3.0 | 0.0, as only a boss casts |
| Auto-combat | clear 100 | clear 100 |
| Replay hash, spell tour | `d924a66d` | `74be8540` |
| Replay hash, squad tour | `8f5ea15f` | `eea90d82` |

**Worth knowing:**

- **Attack speed is the wait after a strike lands,** a straight swap for today's random 1.1 to 1.8 seconds. The wind-up comes on top, so a boar strikes about every 2.75 seconds, and a wasp about every 1.2.
- **The careful and sloppy bots now play identically.** They differed only in how they fight a boss, so they give the same result on every seed. The bots still never struggle, as before.
- **The victory screen and its run tally** are gone from the page, and the beacon no longer lights. The boss's HUD bar, reactions and bot boss logic stay in place, unused.

**Tests changed, and why:**

- `e2e/play.spec.ts`: "a bot plays from the start to victory" became "a bot clears every pack in the real page, the game carries on", as nothing can be won.
- `e2e/game.ts`: the hook's types lose `victory` and gain `records`.
- `packages/core/test/boss.test.ts`: killing a boss now ends nothing.
- `packages/core/test/bots.test.ts`: boss tests use their own scenario with the Warden, since the Lande has none.
- `packages/core/test/combat.test.ts`: the new formula numbers, and `shareXp` takes the monster's level.
- `packages/core/test/monsters.test.ts` and `zones.test.ts`, `items.test.ts`: new monster IDs, seven packs and no boss.
- `packages/core/test/save.test.ts`: adds saves with the boss marked dead.
- `packages/app/test/feel.test.ts`: no victory or tally to follow.
- `packages/tools/test/runs.test.ts`: new finish line and time limit. "Interrupts only with the careful bot", the minion case, and "differs by bot" went, because they need a boss.
- New: `packages/core/test/monster-types.test.ts`.
