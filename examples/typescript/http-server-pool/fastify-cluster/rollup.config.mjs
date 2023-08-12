/* eslint-disable n/no-unpublished-import */
import typescript from '@rollup/plugin-typescript'
import del from 'rollup-plugin-delete'

export default {
  input: ['src/main.ts', 'src/worker.ts'],
  strictDeprecations: true,
  output: [
    {
      format: 'cjs',
      dir: 'dist',
      sourcemap: true,
      entryFileNames: '[name].cjs',
      preserveModules: true,
      preserveModulesRoot: 'src'
    },
    {
      format: 'esm',
      dir: 'dist',
      sourcemap: true,
      preserveModules: true,
      preserveModulesRoot: 'src'
    }
  ],
  external: ['fastify', 'node:path', 'node:url', 'poolifier'],
  plugins: [
    typescript(),
    del({
      targets: ['dist/*']
    })
  ]
}
