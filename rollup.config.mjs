import { cpus } from 'node:os'
import terser from '@rollup/plugin-terser'
import typescript from '@rollup/plugin-typescript'
import analyze from 'rollup-plugin-analyzer'
import command from 'rollup-plugin-command'
import del from 'rollup-plugin-delete'

const isDevelopmentBuild = process.env.BUILD === 'development'
const isAnalyzeBuild = process.env.ANALYZE
const isDocumentationBuild = process.env.DOCUMENTATION

const maxWorkers = cpus().length / 2

export default {
  input: 'src/index.ts',
  strictDeprecations: true,
  output: [
    {
      format: 'cjs',
      sourcemap: !!isDevelopmentBuild,
      ...(isDevelopmentBuild && {
        dir: 'lib',
        preserveModules: true,
        preserveModulesRoot: 'src'
      }),
      ...(!isDevelopmentBuild && {
        file: 'lib/index.js',
        plugins: [terser({ maxWorkers })]
      })
    },
    {
      format: 'esm',
      sourcemap: !!isDevelopmentBuild,
      ...(isDevelopmentBuild && {
        dir: 'lib',
        entryFileNames: '[name].mjs',
        preserveModules: true,
        preserveModulesRoot: 'src'
      }),
      ...(!isDevelopmentBuild && {
        file: 'lib/index.mjs',
        plugins: [terser({ maxWorkers })]
      })
    }
  ],
  external: [
    'node:async_hooks',
    'node:cluster',
    'node:crypto',
    'node:events',
    'node:os',
    'node:worker_threads'
  ],
  plugins: [
    typescript({
      tsconfig: isDevelopmentBuild
        ? 'tsconfig.development.json'
        : 'tsconfig.production.json'
    }),
    del({
      targets: ['lib/*']
    }),
    isAnalyzeBuild && analyze(),
    isDocumentationBuild && command('pnpm typedoc')
  ]
}
