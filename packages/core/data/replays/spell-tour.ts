import type { Replay } from '../../src/state';
import { DUMMY_SCENARIO } from '../scenarios';

const FIGHTER = 1;
const SNIPER = 2;
const HEALER = 3;
const EVERYONE = [FIGHTER, SNIPER, HEALER];
const DUMMY_ID = 4;
const DUMMY_POINT = { x: 0, z: 30 };

/**
 * Written by hand, as no input exists until S2.3. The squad walks to the dummy and fights it, and casts eight spells. Replays cannot
 * set state, so the Healer then walks out of auto-heal range until the Fighter
 * falls, comes back and revives it. The squad finishes the dummy, which respawns.
 *
 * Browsers round slightly differently from Node, so the viewer's run can drift
 * from this one. Revive comes well after the Fighter falls, to leave room.
 */
export const SPELL_TOUR: Replay = {
  seed: 20261108,
  scenario: DUMMY_SCENARIO,
  ticks: 3400,
  entries: [
    {
      tick: 15,
      commands: [{ type: 'move', unitIds: EVERYONE, x: DUMMY_POINT.x, z: 40, attack: true }],
    },
    { tick: 200, commands: [{ type: 'target', unitIds: EVERYONE, enemyId: DUMMY_ID }] },
    { tick: 240, commands: [{ type: 'cast', unitId: FIGHTER, spell: 'taunt' }] },
    { tick: 270, commands: [{ type: 'cast', unitId: FIGHTER, spell: 'cleave' }] },
    { tick: 300, commands: [{ type: 'cast', unitId: FIGHTER, spell: 'guard' }] },
    {
      tick: 330,
      commands: [{ type: 'cast', unitId: SNIPER, spell: 'aimed-shot', enemyId: DUMMY_ID }],
    },
    {
      tick: 360,
      commands: [{ type: 'cast', unitId: SNIPER, spell: 'crippling-shot', point: DUMMY_POINT }],
    },
    {
      tick: 390,
      commands: [{ type: 'cast', unitId: SNIPER, spell: 'volley', point: DUMMY_POINT }],
    },
    { tick: 450, commands: [{ type: 'cast', unitId: HEALER, spell: 'rally' }] },
    { tick: 600, commands: [{ type: 'cast', unitId: HEALER, spell: 'mend' }] },
    { tick: 660, commands: [{ type: 'potion', unitId: FIGHTER }] },
    { tick: 690, commands: [{ type: 'move', unitIds: [HEALER], x: 0, z: 62, attack: false }] },
    { tick: 2550, commands: [{ type: 'cast', unitId: HEALER, spell: 'revive' }] },
    { tick: 2580, commands: [{ type: 'regroup' }] },
    { tick: 2640, commands: [{ type: 'target', unitIds: EVERYONE, enemyId: DUMMY_ID }] },
  ],
  expectedHash: '2bcd8495',
};
