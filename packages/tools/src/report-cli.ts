import { parseArgs } from 'node:util';
import type { BotKind } from '@new-frontier/core';
import { runAuto, runBot, type RunResult } from './run';

const { values } = parseArgs({
  args: process.argv.slice(2).filter((arg) => arg !== '--'),
  options: { seeds: { type: 'string', default: '100' } },
});
const seeds = Array.from({ length: Number(values.seeds) }, (_, index) => index + 1);

const TICKS_PER_MINUTE = 1800;

function average(results: readonly RunResult[], read: (result: RunResult) => number): string {
  return (results.reduce((sum, result) => sum + read(result), 0) / results.length).toFixed(1);
}

function reportBot(kind: BotKind): void {
  const results = seeds.map((seed) => runBot(seed, kind));
  const finished = results.filter((result) => result.finished).length;
  const stalled = results.filter((result) => result.stalled).length;
  const levels = (result: RunResult): number => Math.min(...result.levels);
  console.log(`${kind} bot`);
  console.log(`  finished ${String(finished)} of ${String(seeds.length)}, stalled ${String(stalled)}`);
  console.log(`  game minutes ${average(results, ({ ticks }) => ticks / TICKS_PER_MINUTE)}`);
  console.log(`  wipes ${average(results, ({ wipes }) => wipes)}, characters down ${average(results, ({ charactersDown }) => charactersDown)}, revives ${average(results, ({ revives }) => revives)}`);
  console.log(`  interrupts ${average(results, ({ interrupts }) => interrupts)}, upgrades ${average(results, ({ upgrades }) => upgrades)}`);
  console.log(`  lowest level ${average(results, levels)}, marks ${average(results, ({ marks }) => marks)}, potions ${average(results, ({ potions }) => potions)}`);
  console.log(`  refused orders ${String(results.reduce((sum, { refusals }) => sum + refusals, 0))}`);
}

function reportAuto(): void {
  const stops = new Map<string, number>();
  for (const seed of seeds) {
    const { stalled, stop } = runAuto(seed);
    const reason = stalled ? 'stalled' : (stop ?? 'tick limit');
    stops.set(reason, (stops.get(reason) ?? 0) + 1);
  }
  const lines = [...stops].map(([reason, runs]) => `${reason} ${String(runs)}`);
  console.log(`auto-combat\n  ${lines.join(', ')}`);
}

console.log(`Averages per run across ${String(seeds.length)} seeds.`);
reportBot('careful');
reportBot('sloppy');
reportAuto();
