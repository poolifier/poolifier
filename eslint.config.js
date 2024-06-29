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
  {
    rules: {
      'jsdoc/check-tag-names': [
        'warn',
        {
          typed: true,
          definedTags: ['defaultValue', 'experimental', 'typeParam'],
        },
      ],
    },
  },
  ...tseslint.config(
    ...tseslint.configs.strictTypeChecked,
    ...tseslint.configs.stylisticTypeChecked
  ),
  ...neostandard({
    ts: true,
    globals: {
      ...globals.node,
      ...globals.mocha,
    },
  }),
  {
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      '@cspell/spellchecker': [
        'warn',
        {
          autoFix: true,
          cspell: {
            words: [
              'Alessandro',
              'Ardizio',
              'Benoit',
              'IWRR',
              'Quadflieg',
              'neostandard',
              'poolifier',
              'tseslint',
            ],
          },
        },
      ],
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
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    ...tseslint.configs.disableTypeChecked,
  },
  // examples specific configuration
  {
    files: ['examples/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      '@typescript-eslint/no-redundant-type-constituents': 'off',
    },
  },
  {
    files: ['examples/**/*.js', 'examples/**/*.cjs'],
    rules: {
      'n/no-missing-import': [
        'error',
        {
          allowModules: ['ws'],
        },
      ],
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  // benchmarks specific configuration
  {
    files: ['benchmarks/**/*.cjs'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  // tests specific configuration
  {
    files: ['tests/**/*.js', 'tests/**/*.mjs', 'tests/**/*.cjs'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-empty-function': 'off',
    },
  },
])
