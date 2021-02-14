import typescript from 'rollup-plugin-typescript2'
import analyze from 'rollup-plugin-analyzer'
import { terser } from 'rollup-plugin-terser'
import del from 'rollup-plugin-delete'

const isDevelopmentBuild = process.env.BUILD === 'development'

export default {
  input: 'src/index.ts',
  output: {
    ...(isDevelopmentBuild ? { dir: 'lib' } : { file: 'lib/index.js' }),
    format: 'cjs',
    sourcemap: !!isDevelopmentBuild,
    ...(isDevelopmentBuild && { preserveModules: true }),
    ...(isDevelopmentBuild && { preserveModulesRoot: 'src' }),
    ...(!isDevelopmentBuild && { plugins: [terser({ numWorkers: 2 })] })
  },
  external: ['async_hooks', 'cluster', 'events', 'worker_threads'],
  plugins: [
    typescript({
      tsconfig: isDevelopmentBuild
        ? 'tsconfig.development.json'
        : 'tsconfig.json'
    }),
    del({
      targets: ['lib/*']
    }),
    isDevelopmentBuild && analyze()
  ]
}
