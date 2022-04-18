// @ts-check
const { defineConfig } = require('eslint-define-config')

module.exports = defineConfig({
  env: {
    es2021: true,
    node: true,
    mocha: true
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    warnOnUnsupportedTypeScriptVersion: false
  },
  plugins: [
    '@typescript-eslint',
    'promise',
    'prettierx',
    'jsdoc',
    'spellcheck'
  ],
  extends: [
    'standard',
    'eslint:recommended',
    'plugin:import/errors',
    'plugin:import/warnings',
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
          'christopher',
          'comparator',
          'cpu',
          'ecma',
          'enum',
          'inheritdoc',
          'jsdoc',
          'poolifier',
          'readonly',
          'resize',
          'serializable',
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
      extends: [
        'plugin:jsdoc/recommended',
        'plugin:@typescript-eslint/recommended',
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
            mainDescription:
              '/^[A-Z`].+?(\\.|:)(\\n\\n.*((\\n{1,2}- .+)|(_.+_)|`.+`|\\n\\n---))?$/us',
            matchDescription: '^[A-Z`].+(\\.|`.+`)$',
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
      files: ['examples/typescript/**/*.ts'],
      rules: {
        'import/no-unresolved': 'off',
        'jsdoc/require-jsdoc': 'off'
      }
    },
    {
      files: ['examples/**/*.js'],
      rules: {
        'node/no-missing-require': 'off'
      }
    }
  ],
  settings: {
    jsdoc: {
      mode: 'typescript'
    }
  }
})
