import cspellConfigs from '@cspell/eslint-plugin/configs'
import js from '@eslint/js'
import { defineFlatConfig } from 'eslint-define-config'
import jsdoc from 'eslint-plugin-jsdoc'
import perfectionist from 'eslint-plugin-perfectionist'
import globals from 'globals'
import neostandard, { plugins } from 'neostandard'

export default defineFlatConfig([
  {
    ignores: ['docs/**', '**/dist/**', 'lib/**', 'outputs/**'],
  },
  cspellConfigs.recommended,
  {
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
    },
  },
  js.configs.recommended,
  plugins.promise.configs['flat/recommended'],
  ...plugins.n.configs['flat/mixed-esm-and-cjs'],
  jsdoc.configs['flat/recommended-typescript'],
  {
    rules: {
      'jsdoc/check-tag-names': [
        'warn',
        {
          definedTags: ['defaultValue', 'experimental', 'typeParam'],
          typed: true,
        },
      ],
    },
  },
  ...plugins['typescript-eslint'].config(
    {
      extends: [
        ...plugins['typescript-eslint'].configs.strictTypeChecked,
        ...plugins['typescript-eslint'].configs.stylisticTypeChecked,
      ],
      languageOptions: {
        parserOptions: {
          projectService: true,
          tsconfigRootDir: import.meta.dirname,
        },
      },
    },
    {
      files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
      ...plugins['typescript-eslint'].configs.disableTypeChecked,
    }
  ),
  perfectionist.configs['recommended-natural'],
  ...neostandard({
    globals: {
      ...globals.mocha,
    },
    noJsx: true,
    ts: true,
  }),
  {
    files: [
      'src/pools/selection-strategies/fair-share-worker-choice-strategy.ts',
    ],
    rules: {
      '@stylistic/operator-linebreak': 'off',
    },
  },
  // examples specific configuration
  {
    files: ['examples/**/*.ts'],
    rules: {
      '@typescript-eslint/no-redundant-type-constituents': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/return-await': 'off',
    },
  },
  {
    files: ['examples/**/*.js', 'examples/**/*.cjs'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'n/no-missing-import': [
        'error',
        {
          allowModules: ['ws'],
        },
      ],
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
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
])
