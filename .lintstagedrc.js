module.exports = {
  '**/*.{ts,tsx}': [
    'prettier --write',
    'ts-standard --fix',
    'eslint --cache --fix'
  ],
  '**/*.{js,jsx,mjs,cjs}': ['prettier --write', 'eslint --cache --fix'],
  '**/*.{json,md,yml,yaml}': ['prettier --write']
}
