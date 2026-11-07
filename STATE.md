# State

**Pickup point. Keep under 8 KB.**

## Now

Stage S2, Foundation. S1, S2.1, S2.2a and S2.2b are closed: the core runs in fixed ticks from a seed, and the squad moves, fights a training dummy, casts all nine spells, levels up and upgrades gear, with replays proving a run repeats exactly. The dev-only viewer at `/viewer.html` plays them on a 2D map. An empty island is still what the public page shows, unlinked. S2.2c and S2.3 are drafted.

## Next

1. Agree brief S2.2c, then build it.

## Open

- The last two classes (D-006).
- Graphics need a big step up, after the base game works. No brief yet. D-019 keeps the renderer replaceable.
- Replays match in Node only. Browsers round `sin`, `cos` and `atan2` slightly differently, so a replay recorded in a browser will not reproduce exactly in Node. Decision 13 of S2.2a allows this. It matters if a later brief wants browser runs checked on CI.

## Bugs

- Squad test: auto-combat never finished clearing the island in 3 of 100 bot runs. Cause unknown. S2.2c must not carry it over.
- A unit sent alone on attack-move is also set to hold, so a Fighter stops about 8 from an enemy and never closes. It comes from the squad test. Fix through a brief, likely S2.2c.
