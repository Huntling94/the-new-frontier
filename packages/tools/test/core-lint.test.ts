import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const eslint = new ESLint({ cwd: root });

async function rulesBrokenBy(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).map((message) => message.ruleId ?? 'parse error');
}

const coreLogic = 'packages/core/src/sample.ts';

describe('core lint rules', () => {
  it.each([
    ['three', 'no-restricted-imports', `import { Scene } from 'three';\nexport { Scene };`],
    ['three types', 'no-restricted-imports', `import type { Scene } from 'three';\nexport type { Scene };`],
    ['document', 'no-restricted-globals', `export const page = document.title;`],
    ['window', 'no-restricted-globals', `export const page = window.location;`],
    ['globalThis', 'no-restricted-globals', `export const page = globalThis;`],
    ['Math.random', 'no-restricted-properties', `export const roll = Math.random();`],
    ['Date', 'no-restricted-globals', `export const now = Date.now();`],
    ['performance', 'no-restricted-globals', `export const now = performance.now();`],
    ['setTimeout', 'no-restricted-globals', `setTimeout(() => undefined, 0);`],
    ['crypto', 'no-restricted-globals', `export const random = crypto;`],
    ['a Node module', 'no-restricted-imports', `import { cpus } from 'node:os';\nexport { cpus };`],
    ['a bare Node module', 'no-restricted-imports', `import { cpus } from 'os';\nexport { cpus };`],
    ['a dynamic import', 'no-restricted-syntax', `export const later = import('./other');`],
    ['a stray number', 'no-restricted-syntax', `export const speed = (x: number) => x * 57;`],
    ['a number in a constant', 'no-restricted-syntax', `export const speed = 5.5;`],
  ])('rejects %s', async (_name, rule, code) => {
    expect(await rulesBrokenBy(code, coreLogic)).toContain(rule);
  });

  it('accepts plain logic that uses only the allowed numbers', async () => {
    const code = `export const flip = (x: number) => (x + 1 - 1) * 2 * -1 + 0;`;
    expect(await rulesBrokenBy(code, coreLogic)).toEqual([]);
  });

  it('accepts numbers in data files and tests', async () => {
    const code = `export const speed = 5.5;`;
    expect(await rulesBrokenBy(code, 'packages/core/data/sample.ts')).toEqual([]);
    expect(await rulesBrokenBy(code, 'packages/core/test/sample.test.ts')).toEqual([]);
  });

  it('still bans randomness in data files', async () => {
    const code = `export const roll = Math.random();`;
    expect(await rulesBrokenBy(code, 'packages/core/data/sample.ts')).toContain(
      'no-restricted-properties',
    );
  });

  it('cannot be switched off with a comment in the core', async () => {
    const code = `// eslint-disable-next-line\nexport const roll = Math.random();`;
    expect(await rulesBrokenBy(code, coreLogic)).toContain('no-restricted-properties');
  });

  it('leaves render free to use three.js and the browser', async () => {
    const code = `import { Scene } from 'three';\nexport const items = [new Scene(), document.title];`;
    expect(await rulesBrokenBy(code, 'packages/render/src/sample.ts')).toEqual([]);
  });
});
