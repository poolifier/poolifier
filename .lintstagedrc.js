export default {
  '**/*.json': ['biome format --no-errors-on-unmatched --write'],
  '**/*.{md,yml,yaml}': ['biome format --no-errors-on-unmatched --write'],
  '**/*.{ts,tsx,js,jsx,cjs,mjs}': [
    'biome format --no-errors-on-unmatched --write',
    'eslint --cache --fix',
  ],
}
