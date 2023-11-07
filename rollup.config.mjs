import * as os from 'node:os'
import { env } from 'node:process'
import { dts } from 'rollup-plugin-dts'
import terser from '@rollup/plugin-terser'
import typescript from '@rollup/plugin-typescript'
import analyze from 'rollup-plugin-analyzer'
import command from 'rollup-plugin-command'
import del from 'rollup-plugin-delete'
import { defineConfig } from 'rollup'

const availableParallelism = () => {
  let availableParallelism = 1
  try {
    availableParallelism = os.availableParallelism()
  } catch {
    const cpus = os.cpus()
    if (Array.isArray(cpus) && cpus.length > 0) {
      availableParallelism = cpus.length
    }
  }
  return availableParallelism
}

const isDevelopmentBuild = env.BUILD === 'development'
const isAnalyzeBuild = env.ANALYZE
const isDocumentationBuild = env.DOCUMENTATION
const sourcemap = env.SOURCEMAP !== 'false'

const maxWorkers = Math.floor(availableParallelism() / 2)

export default defineConfig([
  {
    input: './src/index.ts',
    strictDeprecations: true,
    output: [
      {
        format: 'cjs',
        ...(isDevelopmentBuild && {
          dir: './lib',
          preserveModules: true,
          preserveModulesRoot: './src'
        }),
        ...(!isDevelopmentBuild && {
          file: './lib/index.js',
          plugins: [terser({ maxWorkers })]
        }),
        ...(sourcemap && {
          sourcemap
        })
      },
      {
        format: 'esm',
        ...(isDevelopmentBuild && {
          dir: './lib',
          entryFileNames: '[name].mjs',
          chunkFileNames: '[name]-[hash].mjs',
          preserveModules: true,
          preserveModulesRoot: './src'
        }),
        ...(!isDevelopmentBuild && {
          file: './lib/index.mjs',
          plugins: [terser({ maxWorkers })]
        }),
        ...(sourcemap && {
          sourcemap
        })
      }
    ],
    external: [/^node:*/],
    plugins: [
      typescript({
        tsconfig: './tsconfig.build.json',
        compilerOptions: {
          sourceMap: sourcemap
        }
      }),
      del({
        targets: ['./lib/*']
      }),
      Boolean(isAnalyzeBuild) && analyze(),
      Boolean(isDocumentationBuild) && command('pnpm typedoc')
    ]
  },
  {
    input: './lib/dts/index.d.ts',
    output: [{ format: 'esm', file: './lib/index.d.ts' }],
    external: [/^node:*/],
    plugins: [
      dts(),
      del({
        targets: ['./lib/dts'],
        hook: 'buildEnd'
      }),
      Boolean(isAnalyzeBuild) && analyze()
    ]
  }
])
