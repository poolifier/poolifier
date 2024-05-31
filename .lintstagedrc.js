export default {
  '**/*.{ts,tsx,js,jsx,cjs,mjs}': [
    // 'biome format --write',
    // 'eslint --cache --fix',
    'eslint --cache',
  ],
  '**/*.json': ['biome format --write'],
  '**/*.{md,yml,yaml}': ['prettier --cache --write'],
}
