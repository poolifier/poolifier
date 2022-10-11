module.exports = {
  '**/*.{js,mjs,ts}': [
    'prettier --write',
    'prettierx --write',
    'eslint --cache --fix'
  ],
  '**/*.{json,md,yml}': ['prettier --write', 'prettierx --write']
}
