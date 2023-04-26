module.exports = {
  '**/*.{ts,tsx,js,jsx,cjs,mjs}': [
    'prettier --cache --write',
    'ts-standard --fix',
    'eslint --cache --fix'
  ],
  '**/*.{json,md,yml,yaml}': ['prettier --cache --write']
}
