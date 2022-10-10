module.exports = {
  '**/*.{js,mjs,ts}': ['eslint --cache --fix'],
  '**/*.{json,md,yml}': [
    'prettier --write',
    'prettierx --write'
  ]
}
