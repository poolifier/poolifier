import cspellConfigs from '@cspell/eslint-plugin/configs'
import js from '@eslint/js'
import { defineFlatConfig } from 'eslint-define-config'
import jsdoc from 'eslint-plugin-jsdoc'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import globals from 'globals'
import neostandard, { plugins } from 'neostandard'

export default defineFlatConfig([
  {
    ignores: ['docs/**', '**/dist/**', 'lib/**', 'outputs/**'],
  },
  cspellConfigs.recommended,
  js.configs.recommended,
  plugins.promise.configs['flat/recommended'],
  ...plugins.n.configs['flat/mixed-esm-and-cjs'],
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
  ...neostandard({
    ts: true,
    globals: {
      ...globals.mocha,
    },
  }),
  ...plugins['typescript-eslint'].config(
    ...plugins['typescript-eslint'].configs.strictTypeChecked,
    ...plugins['typescript-eslint'].configs.stylisticTypeChecked
  ),
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
    ...plugins['typescript-eslint'].configs.disableTypeChecked,
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
