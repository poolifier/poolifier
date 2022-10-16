module.exports = {
  '**/*.{js,mjs,ts}': [
    'prettier --write',
    'prettierx --write',
    'eslint --cache --fix'
  ],
  '**/*.{json,md,yml,yaml}': ['prettier --write', 'prettierx --write']
}
