import typescript from '@rollup/plugin-typescript'
import { defineConfig } from 'rollup'
import del from 'rollup-plugin-delete'

export default defineConfig({
  input: ['./src/main.ts', './src/worker.ts'],
  strictDeprecations: true,
  output: [
    {
      format: 'cjs',
      dir: './dist',
      sourcemap: true,
      entryFileNames: '[name].cjs',
      chunkFileNames: '[name]-[hash].cjs',
    },
    {
      format: 'esm',
      dir: './dist',
      sourcemap: true,
    },
  ],
  external: [/^node:*/, 'poolifier', 'ws'],
  plugins: [
    typescript(),
    del({
      targets: ['./dist/*'],
    }),
  ],
})
