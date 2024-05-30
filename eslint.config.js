import cspellConfigs from '@cspell/eslint-plugin/configs'
import js from '@eslint/js'
import { defineFlatConfig } from 'eslint-define-config'
import jsdoc from 'eslint-plugin-jsdoc'
import nodePlugin from 'eslint-plugin-n'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import globals from 'globals'
import neostandard from 'neostandard'
// eslint-disable-next-line n/no-extraneous-import
import tseslint from 'typescript-eslint'

export default defineFlatConfig([
  {
    ignores: ['docs/**', '**/dist/**', 'lib/**', 'outputs/**'],
  },
  cspellConfigs.recommended,
  js.configs.recommended,
  ...nodePlugin.configs['flat/mixed-esm-and-cjs'],
  jsdoc.configs['flat/recommended-typescript'],
  // ...tseslint.config(...tseslint.configs.strictTypeChecked, ...tseslint.configs.stylisticTypeChecked),
  ...tseslint.config(...tseslint.configs.strict, ...tseslint.configs.stylistic),
  ...neostandard({
    ts: true,
    globals: {
      ...globals.node,
      ...globals.mocha,
    },
  }),
  {
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
    },
  },
  {
    files: [
      'src/pools/selection-strategies/fair-share-worker-choice-strategy.ts',
    ],
    rules: {
      '@stylistic/operator-linebreak': 'off',
    },
  },
  {
    files: ['examples/**/*.js', 'examples/**/*.cjs'],
    rules: {
      'no-undef': 'off',
      'n/no-missing-import': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['benchmarks/**/*.cjs'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['tests/**/*.js', 'tests/**/*.mjs', 'tests/**/*.cjs'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-empty-function': 'off',
    },
  },
])
