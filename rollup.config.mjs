import typescript from 'rollup-plugin-typescript2'
import analyze from 'rollup-plugin-analyzer'
import { terser } from 'rollup-plugin-terser'
import del from 'rollup-plugin-delete'
import command from 'rollup-plugin-command'

const isDevelopmentBuild = process.env.BUILD === 'development'
const isAnalyze = process.env.ANALYZE
const isDocumentation = process.env.DOCUMENTATION

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
    isAnalyze && analyze(),
    isDocumentation && command('npm run typedoc')
  ]
}
