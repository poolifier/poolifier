module.exports = {
  env: {
    es2021: true,
    node: true,
    mocha: true
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module'
  },
  plugins: ['@typescript-eslint', 'prettierx'],
  extends: [
    'standard',
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettierx/standardx',
    'plugin:prettierx/@typescript-eslint'
  ],
  rules: {
    'no-void': 'off',

    // We have some intentionally empty functions
    '@typescript-eslint/no-empty-function': 'off',

    '@typescript-eslint/no-inferrable-types': [
      'error',
      { ignoreProperties: true }
    ]
  },
  overrides: [
    {
      files: ['*.js'],
      rules: {
        '@typescript-eslint/no-unused-vars': 'off',
        '@typescript-eslint/no-var-requires': 'off'
      }
    }
  ]
}
