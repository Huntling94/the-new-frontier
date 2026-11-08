import type { Replay } from '../../src/state';
import { EMPTY_SCENARIO } from '../scenarios';

const FIGHTER = 1;
const SNIPER = 2;
const HEALER = 3;
const EVERYONE = [FIGHTER, SNIPER, HEALER];

/**
 * Written by hand, as no input exists until S2.3. The squad walks in formation
 * through the standing stones, the Sniper is sent off to hold a spot, the others follow
 * in a line, and then the squad regroups, scatters and regroups again.
 */
export const SQUAD_TOUR: Replay = {
  seed: 20261107,
  scenario: EMPTY_SCENARIO,
  ticks: 1320,
  entries: [
    { tick: 15, commands: [{ type: 'move', unitIds: EVERYONE, x: -45, z: 30, attack: false }] },
    { tick: 240, commands: [{ type: 'move', unitIds: EVERYONE, x: -30, z: -45, attack: true }] },
    { tick: 480, commands: [{ type: 'move', unitIds: [SNIPER], x: 10, z: -60, attack: false }] },
    {
      tick: 600,
      commands: [{ type: 'move', unitIds: [FIGHTER, HEALER], x: 45, z: -30, attack: false }],
    },
    { tick: 900, commands: [{ type: 'regroup' }] },
    { tick: 1050, commands: [{ type: 'scatter' }] },
    { tick: 1140, commands: [{ type: 'regroup' }] },
  ],
  expectedHash: 'eea90d82',
};
