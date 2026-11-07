import { parseArgs } from 'node:util';
import type { BotKind } from '@new-frontier/core';
import { runBot } from './run';

const { values } = parseArgs({
  args: process.argv.slice(2).filter((arg) => arg !== '--'),
  options: { seed: { type: 'string', default: '1' }, bot: { type: 'string', default: 'careful' } },
});

const seed = Number(values.seed);
if (!Number.isInteger(seed) || (values.bot !== 'careful' && values.bot !== 'sloppy')) {
  console.error('Usage: pnpm sim --seed <n> --bot careful|sloppy');
  process.exit(1);
}

const result = runBot(seed, values.bot as BotKind);
const minutes = (result.ticks / 30 / 60).toFixed(1);
console.log(`Seed ${String(seed)}, ${String(values.bot)} bot`);
console.log(result.finished ? `Boss down in ${minutes} game minutes.` : `Not finished after ${minutes} game minutes.`);
console.log(`Wipes ${String(result.wipes)}, characters down ${String(result.charactersDown)}, revives ${String(result.revives)}, interrupts ${String(result.interrupts)}.`);
console.log(`Levels ${result.levels.join(', ')}. Upgrades ${String(result.upgrades)}. Marks ${String(result.marks)}, potions ${String(result.potions)}.`);
console.log(`Monsters left ${String(result.monstersLeft)}. Refused orders ${String(result.refusals)}.`);
console.log(`State hash ${result.hash}.`);
process.exitCode = result.finished ? 0 : 1;
