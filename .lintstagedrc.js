module.exports = {
  '**/*.{ts,tsx,js,jsx,mjs,cjs}': [
    'prettier --write',
    'ts-standard --fix',
    'eslint --cache --fix'
  ],
  '**/*.{json,md,yml,yaml}': ['prettier --write']
}
