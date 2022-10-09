module.exports = {
  '**/*.{js,mjs,ts}': ['eslint --cache --fix'],
  '**/*.{json,md,yml}': [
    'prettier --loglevel silent --write',
    'prettierx --write'
  ]
}
