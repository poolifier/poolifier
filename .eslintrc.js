// @ts-check
const { defineConfig } = require('eslint-define-config')

module.exports = defineConfig({
  env: {
    es2021: true,
    node: true,
    mocha: true
  },
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module'
  },
  plugins: ['promise', 'prettierx', 'jsdoc', 'spellcheck'],
  extends: [
    'standard',
    'eslint:recommended',
    'plugin:import/recommended',
    'plugin:jsdoc/recommended',
    'plugin:promise/recommended',
    'plugin:prettierx/standardx'
  ],
  rules: {
    'no-void': 'off',

    'sort-imports': [
      'warn',
      {
        ignoreMemberSort: true,
        ignoreDeclarationSort: true
      }
    ],

    'spellcheck/spell-checker': [
      'warn',
      {
        skipWords: [
          'browserslist',
          'christopher',
          'comparator',
          'cpu',
          'cpus',
          'ecma',
          'enum',
          'fibonacci',
          'inheritDoc',
          'jsdoc',
          'num',
          'os',
          'poolifier',
          'readonly',
          'serializable',
          'sinon',
          'tsconfig',
          'typedoc',
          'unregister',
          'workerpool'
        ],
        skipIfMatch: ['^@.*', '^plugin:.*']
      }
    ]
  },
  overrides: [
    {
      files: ['**/*.ts'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        project: './tsconfig.json'
      },
      plugins: ['@typescript-eslint'],
      extends: [
        'plugin:@typescript-eslint/eslint-recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:@typescript-eslint/recommended-requiring-type-checking',
        'plugin:import/typescript'
      ],
      rules: {
        // We have some intentionally empty functions
        '@typescript-eslint/no-empty-function': 'off',

        '@typescript-eslint/no-inferrable-types': [
          'error',
          { ignoreProperties: true }
        ],

        'no-useless-constructor': 'off',

        'jsdoc/match-description': [
          'warn',
          {
            contexts: ['any'],
            tags: {
              param: true,
              returns: true
            }
          }
        ],
        'jsdoc/no-types': 'error',
        'jsdoc/require-jsdoc': [
          'warn',
          {
            contexts: [
              'ClassDeclaration',
              'ClassProperty:not([accessibility=/(private|protected)/])',
              'ExportNamedDeclaration:has(VariableDeclaration)',
              'FunctionExpression',
              'MethodDefinition:not([accessibility=/(private|protected)/]) > FunctionExpression',
              'TSEnumDeclaration',
              'TSInterfaceDeclaration',
              'TSMethodSignature',
              // 'TSPropertySignature',
              'TSTypeAliasDeclaration'
            ]
          }
        ],
        'jsdoc/require-param-type': 'off',
        'jsdoc/require-returns-type': 'off'
      }
    },
    {
      files: ['**/*.js'],
      extends: 'plugin:node/recommended'
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
        'node/no-missing-require': 'off'
      }
    },
    {
      files: ['benchmarks/**/*.js'],
      rules: {
        'jsdoc/require-jsdoc': 'off'
      }
    },
    {
      files: ['examples/**/*.js'],
      rules: {
        'node/no-missing-require': 'off',
        'jsdoc/require-jsdoc': 'off'
      }
    }
  ],
  settings: {
    jsdoc: {
      mode: 'typescript'
    }
  }
})
