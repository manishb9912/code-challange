// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importX from 'eslint-plugin-import-x';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import eslintReact from '@eslint-react/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

const API = './apps/api/src';

/**
 * Architectural dependency rule (see CLAUDE.md). Arrows point inward:
 * http -> services -> ports/domain; adapters -> ports/domain; only app.ts wires adapters.
 */
const apiBoundaries = [
  {
    target: `${API}/domain`,
    from: API,
    except: ['./domain'],
    message: 'domain/ is pure: it may only import from domain/ and @catalogue/shared.',
  },
  {
    target: `${API}/ports`,
    from: [`${API}/adapters`, `${API}/services`, `${API}/http`, `${API}/config`, `${API}/app.ts`],
    message: 'ports/ are interfaces: they may only import from domain/.',
  },
  {
    target: `${API}/services`,
    from: [`${API}/adapters`, `${API}/http`, `${API}/config`, `${API}/app.ts`, `${API}/server.ts`],
    message: 'services/ may only import from domain/ and ports/.',
  },
  {
    target: `${API}/adapters`,
    from: [`${API}/services`, `${API}/http`, `${API}/config`, `${API}/app.ts`, `${API}/server.ts`],
    message: 'adapters/ may only import from ports/ and domain/; config is injected by app.ts.',
  },
  {
    target: `${API}/http`,
    from: [`${API}/adapters`, `${API}/server.ts`],
    message: 'http/ must never import adapters; they are wired in app.ts.',
  },
  {
    target: './packages/shared',
    from: './apps',
    message: 'packages/shared must not depend on any app.',
  },
];

export default tseslint.config(
  { ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**', 'docs/prompts/**'] },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { 'import-x': importX },
    settings: {
      'import-x/resolver-next': [
        createTypeScriptImportResolver({
          project: ['packages/*/tsconfig.json', 'apps/*/tsconfig.json'],
          conditionNames: ['source', 'types', 'import', 'default'],
          noWarnOnMultipleProjects: true,
        }),
      ],
    },
    rules: {
      // Security: no dynamic code execution (OWASP injection).
      'no-eval': 'error',
      'no-implied-eval': 'off',
      '@typescript-eslint/no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-restricted-imports': [
        'error',
        {
          paths: ['child_process', 'node:child_process', 'vm', 'node:vm'].map((name) => ({
            name,
            message: 'Spawning processes / evaluating code is not allowed in this codebase.',
          })),
        },
      ],
      'import-x/no-restricted-paths': ['error', { zones: apiBoundaries }],
      'import-x/no-cycle': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': 'error',
      // Fastify's documented way to return a value from a handler is an async function.
      '@typescript-eslint/require-await': 'off',
    },
  },

  // Config is read in exactly one place.
  {
    files: ['apps/api/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message: 'Read configuration via apps/api/src/config only.',
        },
      ],
    },
  },
  {
    files: ['apps/api/src/config/**/*.ts'],
    rules: { 'no-restricted-properties': 'off' },
  },
  {
    files: ['apps/api/**/*.ts'],
    languageOptions: { globals: globals.node },
  },

  // Web: React rules, XSS bans, and fetch only via the API client.
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    ...eslintReact.configs['recommended-type-checked'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@eslint-react/dom-no-dangerously-set-innerhtml': 'error',
      '@eslint-react/dom-no-dangerously-set-innerhtml-with-children': 'error',
      '@eslint-react/dom-no-script-url': 'error',
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'Call the backend through apps/web/src/api only.' },
      ],
    },
  },
  {
    files: [
      'apps/web/src/api/**/*.ts',
      'apps/web/test/**/*.{ts,tsx}',
      'apps/web/src/**/*.test.{ts,tsx}',
    ],
    rules: { 'no-restricted-globals': 'off' },
  },

  // Root-level config files are not part of any tsconfig project.
  {
    files: ['*.js', '*.ts', '**/vite.config.ts', '**/vitest.config.ts'],
    ...tseslint.configs.disableTypeChecked,
  },

  prettier,
);
