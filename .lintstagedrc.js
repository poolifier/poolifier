module.exports = {
  '**/*.{ts,tsx,js,jsx,mjs,cjs}': [
    'prettier --cache --write',
    'ts-standard --fix',
    'eslint --cache --fix'
  ],
  '**/*.{json,md,yml,yaml}': ['prettier --cache --write']
}
