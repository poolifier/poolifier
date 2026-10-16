import typescript from '@rollup/plugin-typescript'
import { defineConfig } from 'rollup'
import del from 'rollup-plugin-delete'

export default defineConfig({
  external: ['express', /^node:*/, 'poolifier'],
  input: ['./src/main.ts', './src/worker.ts'],
  output: {
    dir: './dist',
    format: 'esm',
    sourcemap: true,
  },
  plugins: [
    typescript({
      compilerOptions: {
        module: 'Node16',
        moduleResolution: 'Node16',
      },
    }),
    del({
      targets: ['./dist/*'],
    }),
  ],
  strictDeprecations: true,
})
