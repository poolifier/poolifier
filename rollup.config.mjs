import terser from '@rollup/plugin-terser'
import typescript from '@rollup/plugin-typescript'
import analyze from 'rollup-plugin-analyzer'
import command from 'rollup-plugin-command'
import del from 'rollup-plugin-delete'

const isDevelopmentBuild = process.env.BUILD === 'development'
const isAnalyze = process.env.ANALYZE
const isDocumentation = process.env.DOCUMENTATION

export default {
  input: 'src/index.ts',
  strictDeprecations: true,
  output: [
    {
      ...(isDevelopmentBuild ? { dir: 'lib' } : { file: 'lib/index.js' }),
      format: 'cjs',
      sourcemap: !!isDevelopmentBuild,
      ...(isDevelopmentBuild && {
        preserveModules: true,
        preserveModulesRoot: 'src'
      }),
      ...(!isDevelopmentBuild && { plugins: [terser({ maxWorkers: 2 })] })
    },
    {
      ...(isDevelopmentBuild ? { dir: 'lib' } : { file: 'lib/index.mjs' }),
      format: 'esm',
      sourcemap: !!isDevelopmentBuild,
      ...(isDevelopmentBuild && {
        entryFileNames: '[name].mjs',
        preserveModules: true,
        preserveModulesRoot: 'src'
      }),
      ...(!isDevelopmentBuild && { plugins: [terser({ maxWorkers: 2 })] })
    }
  ],
  external: ['async_hooks', 'cluster', 'events', 'os', 'worker_threads'],
  plugins: [
    typescript({
      tsconfig: isDevelopmentBuild
        ? 'tsconfig.development.json'
        : 'tsconfig.production.json'
    }),
    del({
      targets: ['lib/*']
    }),
    isAnalyze && analyze(),
    isDocumentation && command('npm run typedoc')
  ]
}
