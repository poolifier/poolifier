export default {
  '**/*.{md,yml,yaml}': ['prettier --cache --write'],
  // '**/*.{ts,tsx,js,jsx,cjs,mjs}': [
  //   'biome format --write',
  //   'eslint --cache --fix',
  // ],
  '**/*.json': ['biome format --write'],
}
