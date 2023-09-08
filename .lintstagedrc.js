module.exports = {
  '**/*.{ts,tsx,js,jsx,cjs,mjs}': [
    'biome format --write,
    'ts-standard --fix',
    'eslint --cache --fix'
  ],
  '!(.vscode/**)**/*.json': ['biome format --write --no-errors-on-unmatched'],
  '**/*.{md,yml,yaml}': ['prettier --cache --write']
}
