module.exports = {
  '**/*.{ts,tsx,js,jsx,cjs,mjs}': [
    'rome format --write',
    'ts-standard --fix',
    'eslint --cache --fix'
  ],
  '**/*.{json,md,yml,yaml}': ['rome format --write']
}
