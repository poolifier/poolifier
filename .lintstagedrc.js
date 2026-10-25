export default {
  '**/*.{json,md,yml,yaml,ts,tsx,js,jsx,cjs,mjs}':
    'biome format --no-errors-on-unmatched --write',
  '**/*.{ts,tsx,js,jsx,cjs,mjs}': 'eslint --cache --fix',
}
