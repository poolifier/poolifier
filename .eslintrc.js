const { defineConfig } = require('eslint-define-config')

module.exports = defineConfig({
  root: true,
  env: {
    es2022: true,
    node: true,
    mocha: true
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  plugins: ['promise', 'spellcheck'],
  extends: [
    'eslint:recommended',
    'plugin:import/recommended',
    'plugin:promise/recommended'
  ],
  settings: {
    'import/resolver': {
      typescript: {
        project: './tsconfig.eslint.json'
      }
    }
  },
  rules: {
    'sort-imports': [
      'error',
      {
        ignoreDeclarationSort: true
      }
    ],
    'import/order': 'error',

    'spellcheck/spell-checker': [
      'warn',
      {
        skipWords: [
          'Benoit',
          'benny',
          'browserslist',
          'builtins',
          'christopher',
          'cjs',
          'comparator',
          'cpu',
          'cpus',
          'ctx',
          'deprecations',
          'dequeue',
          'dequeued',
          'ecma',
          'enqueue',
          'enum',
          'errored',
          'esm',
          'fibonacci',
          'fs',
          'inheritDoc',
          'jsdoc',
          'microjob',
          'mjs',
          'num',
          'os',
          'piscina',
          'pnpm',
          'poolifier',
          'poolify',
          'readonly',
          'resize',
          'serializable',
          'sinon',
          'threadjs',
          'threadwork',
          'tsconfig',
          'tsdoc',
          'typedoc',
          'unlink',
          'unregister',
          'utf8',
          'workerpool',
          'wwr'
        ],
        skipIfMatch: ['^@.*', '^plugin:.*']
      }
    ]
  },
  overrides: [
    {
      files: ['**/*.ts'],
      plugins: ['@typescript-eslint', 'eslint-plugin-tsdoc'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        project: './tsconfig.eslint.json'
      },
      extends: [
        'plugin:@typescript-eslint/eslint-recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:@typescript-eslint/recommended-requiring-type-checking',
        'plugin:import/typescript',
        'standard-with-typescript'
      ],
      rules: {
        '@typescript-eslint/no-inferrable-types': [
          'error',
          { ignoreProperties: true }
        ],
        'tsdoc/syntax': 'warn'
      }
    },
    {
      files: ['examples/typescript/**/*.ts'],
      rules: {
        '@typescript-eslint/no-unsafe-argument': 'off',
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off'
      }
    },
    {
      files: ['**/*.js', '**/*.mjs'],
      plugins: ['jsdoc'],
      extends: ['plugin:n/recommended', 'plugin:jsdoc/recommended', 'standard']
    },
    {
      files: ['tests/**/*.js'],
      rules: {
        'jsdoc/require-jsdoc': 'off'
      }
    },
    {
      files: ['tests/pools/selection-strategies/**/*.js'],
      rules: {
        'n/no-missing-require': 'off'
      }
    },
    {
      files: ['benchmarks/**/*.js'],
      rules: {
        'jsdoc/require-jsdoc': 'off'
      }
    },
    {
      files: ['benchmarks/versus-external-pools/**/*.js'],
      rules: {
        'n/no-missing-require': 'off'
      }
    },
    {
      files: ['examples/**/*.js'],
      rules: {
        'n/no-missing-require': 'off',
        'jsdoc/require-jsdoc': 'off'
      }
    }
  ]
})
