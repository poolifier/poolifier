export default {
  '**/*.json': ['biome format --no-errors-on-unmatched --write'],
  '**/*.{md,yml,yaml}': ['prettier --cache --write'],
  '**/*.{ts,tsx,js,jsx,cjs,mjs}': [
    'biome format --no-errors-on-unmatched --write',
    'eslint --cache --fix',
  ],
}
