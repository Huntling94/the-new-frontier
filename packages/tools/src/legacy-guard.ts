import { execFileSync } from 'node:child_process';

/** The tree of the `v0-2019` tag. If this changes, `legacy/` has changed. */
export const LEGACY_TREE = '832123424d76aa3dbca94f8c0a8926219762f4f6';

/** Runs one git command and returns what it printed. */
export type Git = (args: readonly string[]) => string;

/**
 * Runs git from the top of the repository. Without this, `git status -- legacy`
 * run inside a package would look at a folder that does not exist, and pass.
 */
export function createGit(startFolder: string): Git {
  const run = (args: readonly string[], cwd: string): string =>
    execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  const top = run(['rev-parse', '--show-toplevel'], startFolder);
  return (args) => run(args, top);
}

/** Checks `legacy/` with read-only git commands. Returns each problem found. */
export function checkLegacy(git: Git, expectedTree: string = LEGACY_TREE): string[] {
  const problems: string[] = [];

  const tree = git(['rev-parse', 'HEAD:legacy']);
  if (tree !== expectedTree) {
    problems.push(`legacy/ tree is ${tree}, expected ${expectedTree}.`);
  }

  const changes = git(['status', '--porcelain', '--', 'legacy']);
  if (changes !== '') {
    problems.push(`legacy/ has uncommitted changes:\n${changes}`);
  }

  const attributes = git(['check-attr', '-a', 'legacy/ge.c']);
  if (attributes !== '') {
    problems.push(`A git attribute reaches legacy/ge.c:\n${attributes}`);
  }

  return problems;
}
