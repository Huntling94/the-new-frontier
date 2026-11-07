import { builtinModules } from 'node:module';
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const message = 'The core runs anywhere and repeats exactly, so it cannot use this (D-016).';

/** Everything outside the language itself that the core must not reach. */
const bannedGlobals = [
  ...new Set(['globalThis', 'Date', ...Object.keys(globals.browser), ...Object.keys(globals.node)]),
].map((name) => ({ name, message }));

const bannedModules = [...builtinModules, ...builtinModules.map((name) => `node:${name}`)];

const noDynamicImports = [
  { selector: 'ImportExpression', message: 'No dynamic imports in the core (D-016).' },
  { selector: 'TSImportType', message: 'No dynamic imports in the core (D-016).' },
];

export default tseslint.config(
  { ignores: ['**/node_modules/', '**/dist/', 'legacy/', 'test-results/', 'playwright-report/'] },
  js.configs.recommended,
  ...tseslint.configs.strict,

  {
    files: ['*.js', '*.ts', 'packages/*/*.ts', 'packages/tools/**'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['packages/app/**', 'packages/render/**', 'e2e/**'],
    languageOptions: { globals: globals.browser },
  },

  {
    // Rules for all of the core, data and tests included (D-016).
    files: ['packages/core/**/*.ts'],
    linterOptions: { noInlineConfig: true },
    rules: {
      'no-eval': 'error',
      'no-new-func': 'error',
      'no-restricted-imports': [
        'error',
        {
          paths: bannedModules.map((name) => ({ name, message })),
          patterns: [
            {
              group: ['three', 'three/*', 'node:*', '@new-frontier/*'],
              message: 'The core depends on nothing (D-016).',
            },
          ],
        },
      ],
      'no-restricted-globals': ['error', ...bannedGlobals],
      'no-restricted-properties': ['error', { object: 'Math', property: 'random', message }],
      'no-restricted-syntax': ['error', ...noDynamicImports],
    },
  },
  {
    // Logic holds no design values, so stray numbers are banned here (D-018).
    // A later `no-restricted-syntax` replaces an earlier one, so it repeats the list.
    files: ['packages/core/src/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...noDynamicImports,
        {
          selector: 'Literal[value=type(number)]:not([raw=/^[012]$/])',
          message: 'Numbers belong in packages/core/data. Only 0, 1, -1 and 2 are allowed (D-018).',
        },
      ],
    },
  },
);
