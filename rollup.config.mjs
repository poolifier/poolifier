import typescript from 'rollup-plugin-typescript2'
import analyze from 'rollup-plugin-analyzer'
import { terser } from 'rollup-plugin-terser'
import del from 'rollup-plugin-delete'

const isDevelopmentBuild = process.env.BUILD === 'development'

export default {
  input: 'src/index.ts',
  output: [
    {
      dir: 'lib',
      format: 'cjs',
      sourcemap: !!isDevelopmentBuild,
      preserveModules: true,
      preserveModulesRoot: 'src'
    },
    isDevelopmentBuild && {
      file: 'lib.min/index.js',
      format: 'cjs',
      sourcemap: !!isDevelopmentBuild,
      plugins: [terser({ numWorkers: 2 })]
    }
  ],
  external: ['async_hooks', 'cluster', 'events', 'worker_threads'],
  plugins: [
    typescript({
      tsconfig: isDevelopmentBuild
        ? 'tsconfig.development.json'
        : 'tsconfig.json'
    }),
    del({
      targets: ['lib/*', 'lib.min/*']
    }),
    isDevelopmentBuild && analyze()
  ]
}
