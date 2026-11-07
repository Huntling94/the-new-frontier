import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkLegacy, createGit, LEGACY_TREE, type Git } from '../src/legacy-guard';

function fakeGit(answers: { tree?: string; status?: string; attributes?: string }): Git {
  return ([command]) => {
    if (command === 'rev-parse') return answers.tree ?? LEGACY_TREE;
    if (command === 'status') return answers.status ?? '';
    return answers.attributes ?? '';
  };
}

describe('legacy guard', () => {
  const insidePackage = fileURLToPath(new URL('.', import.meta.url));

  it('passes on the real repository, run from inside a package', () => {
    expect(checkLegacy(createGit(insidePackage))).toEqual([]);
  });

  it('fails on a different tree hash', () => {
    const other = '0000000000000000000000000000000000000000';
    const [problem] = checkLegacy(createGit(insidePackage), other);
    expect(problem).toContain(`expected ${other}`);
  });

  it('fails on an uncommitted change', () => {
    const problems = checkLegacy(fakeGit({ status: ' M legacy/ge.c' }));
    expect(problems.join()).toContain('legacy/ge.c');
  });

  it('fails when an attribute reaches legacy/ge.c', () => {
    const problems = checkLegacy(fakeGit({ attributes: 'legacy/ge.c: text: set' }));
    expect(problems.join()).toContain('attribute');
  });

  it('reports every problem at once', () => {
    const problems = checkLegacy(fakeGit({ tree: 'other', status: 'x', attributes: 'y' }));
    expect(problems).toHaveLength(3);
  });

  it('runs only the three read-only commands', () => {
    const commands: string[] = [];
    checkLegacy((args) => {
      commands.push(args.join(' '));
      return commands.length === 1 ? LEGACY_TREE : '';
    });
    expect(commands).toEqual([
      'rev-parse HEAD:legacy',
      'status --porcelain -- legacy',
      'check-attr -a legacy/ge.c',
    ]);
  });
});
