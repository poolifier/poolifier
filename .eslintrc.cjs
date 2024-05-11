const { defineConfig } = require('eslint-define-config')

module.exports = defineConfig({
  root: true,
  env: {
    es2022: true,
    node: true,
    mocha: true
  },
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 2022
  },
  plugins: ['simple-import-sort', 'promise', 'spellcheck'],
  extends: [
    'eslint:recommended',
    'plugin:import/recommended',
    'plugin:promise/recommended'
  ],
  settings: {
    'import/resolver': {
      typescript: {
        project: './tsconfig.json'
      }
    }
  },
  rules: {
    'simple-import-sort/imports': 'error',
    'simple-import-sort/exports': 'error',

    'spellcheck/spell-checker': [
      'warn',
      {
        skipWords: [
          'argv',
          'axios',
          'benoit',
          'browserslist',
          'builtins',
          'christopher',
          'cjs',
          'cloneable',
          'comparator',
          'cpu',
          'cpus',
          'cryptographically',
          'ctx',
          'decrement',
          'deprecations',
          'deque',
          'dequeue',
          'dequeued',
          'deregisters',
          'dts',
          'ecma',
          'elu',
          'enqueue',
          'enum',
          'errored',
          'esm',
          'fastify',
          'fibonacci',
          'fp',
          'fs',
          'func',
          'inheritDoc',
          'javascript',
          'jsdoc',
          'linebreak',
          'localhost',
          'microjob',
          'mjs',
          'nodemailer',
          'npx',
          'num',
          'os',
          'perf',
          'piscina',
          'pnpm',
          'poolifier',
          'prepend',
          'prepends',
          'positionals',
          'readdir',
          'readonly',
          'req',
          'resize',
          'sinon',
          'smtp',
          'threadjs',
          'threadwork',
          'tinypool',
          'tld',
          'tos',
          'tsconfig',
          'tsdoc',
          'typedoc',
          'unlink',
          'unref',
          'utf8',
          'workerpool',
          'ws',
          'wss',
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
        project: './tsconfig.json'
      },
      extends: [
        'plugin:@typescript-eslint/strict-type-checked',
        'plugin:@typescript-eslint/stylistic-type-checked',
        'plugin:import/typescript',
        'love'
      ],
      rules: {
        'operator-linebreak': 'off',
        'tsdoc/syntax': 'warn'
      }
    },
    {
      files: ['examples/typescript/**/*.ts'],
      rules: {
        'import/no-unresolved': [
          'error',
          {
            ignore: [
              '^axios$',
              '^express$',
              '^fastify$',
              '^fastify-plugin$',
              '^node-fetch$',
              '^nodemailer$',
              '^poolifier$',
              '^ws$'
            ]
          }
        ],
        '@typescript-eslint/no-unsafe-argument': 'off',
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/no-unsafe-return': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unnecessary-type-assertion': 'off',
        '@typescript-eslint/no-redundant-type-constituents': 'off',
        '@typescript-eslint/strict-boolean-expressions': 'off',
        '@typescript-eslint/return-await': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off'
      }
    },
    {
      files: ['**/*.cjs', '**/*.js', '**/*.mjs'],
      plugins: ['jsdoc'],
      extends: ['plugin:n/recommended', 'plugin:jsdoc/recommended', 'standard']
    },
    {
      files: ['tests/**/*.cjs', 'tests/**/*.js', 'tests/**/*.mjs'],
      rules: {
        'jsdoc/require-jsdoc': 'off'
      }
    },
    {
      files: [
        'benchmarks/**/*.cjs',
        'benchmarks/**/*.js',
        'benchmarks/**/*.mjs'
      ],
      rules: {
        'jsdoc/require-jsdoc': 'off'
      }
    },
    {
      files: ['examples/javascript/**/*.cjs', 'examples/javascript/**/*.js'],
      rules: {
        'jsdoc/require-jsdoc': 'off'
      }
    }
  ]
})
