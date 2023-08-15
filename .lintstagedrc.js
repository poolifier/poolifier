module.exports = {
  '**/*.{ts,tsx,js,jsx,cjs,mjs}': [
    'rome format --write',
    'ts-standard --fix',
    'eslint --cache --fix'
  ],
  '!(.vscode/**)**/*.json': ['rome format --write'],
  '**/*.{md,yml,yaml}': ['prettier --cache --write']
}
