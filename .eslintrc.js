module.exports = {
  env: {
    es2021: true,
    node: true,
    mocha: true
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module'
  },
  plugins: ['@typescript-eslint', 'prettierx'],
  extends: [
    'standard',
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/errors',
    'plugin:import/warnings',
    'plugin:import/typescript',
    'plugin:prettierx/standardx',
    'plugin:prettierx/@typescript-eslint',
    'prettier',
    'prettier/standard',
    'prettier/@typescript-eslint'
  ],
  rules: {
    'no-void': 'off',

    // We have some intentionally empty functions
    '@typescript-eslint/no-empty-function': 'off',

    '@typescript-eslint/no-inferrable-types': [
      'error',
      { ignoreProperties: true }
    ],

    'sort-imports': [
      'warn',
      {
        ignoreMemberSort: true,
        memberSyntaxSortOrder: ['none', 'all', 'single', 'multiple']
      }
    ]
  },
  overrides: [
    {
      files: ['*.js'],
      rules: {
        '@typescript-eslint/no-unused-vars': 'off',
        '@typescript-eslint/no-var-requires': 'off'
      }
    },
    {
      files: ['examples/typescript/*.ts'],
      rules: {
        'import/no-unresolved': 'off'
      }
    }
  ]
}
