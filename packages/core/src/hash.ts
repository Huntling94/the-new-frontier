import { STATE_HASH } from '../data/sim';
import type { GameView } from './state';

/** The same text for the same value, whatever order its keys were set in. */
function canonicalJson(value: unknown): string {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new Error(`State holds a number that is not finite: ${String(value)}.`);
  }
  if (
    value === null ||
    typeof value === 'number' ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (typeof value === 'object') {
    const fields = Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([key, field]) => `${JSON.stringify(key)}:${canonicalJson(field)}`);
    return `{${fields.join(',')}}`;
  }
  throw new Error(`State holds a value that is not plain data: ${String(value)}.`);
}

function textHash(text: string): string {
  let hash = STATE_HASH.offset;
  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), STATE_HASH.prime);
  }
  return (hash >>> 0).toString(STATE_HASH.radix).padStart(STATE_HASH.width, '0');
}

/** A short fingerprint of all of the state, tick and generator included (D-015). */
export function hashState(state: GameView): string {
  return textHash(canonicalJson(state));
}
