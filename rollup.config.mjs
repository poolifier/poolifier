import * as os from 'node:os'
import { env } from 'node:process'

import terser from '@rollup/plugin-terser'
import typescript from '@rollup/plugin-typescript'
import { defineConfig } from 'rollup'
import analyze from 'rollup-plugin-analyzer'
import command from 'rollup-plugin-command'
import del from 'rollup-plugin-delete'
import { dts } from 'rollup-plugin-dts'

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
const isAnalyzeBuild = Boolean(env.ANALYZE)
const isDocumentationBuild = Boolean(env.DOCUMENTATION)
const sourcemap = env.SOURCEMAP !== 'false'

const maxWorkers = Math.floor(availableParallelism() / 2)

export default defineConfig([
  {
    input: './src/index.ts',
    strictDeprecations: true,
    output: [
      {
        format: 'cjs',
        ...(isDevelopmentBuild
          ? {
              dir: './lib',
              entryFileNames: '[name].cjs',
              chunkFileNames: '[name]-[hash].cjs',
              preserveModules: true,
              preserveModulesRoot: './src'
            }
          : {
              file: './lib/index.cjs',
              plugins: [terser({ maxWorkers })]
            }),
        ...(sourcemap && {
          sourcemap
        })
      },
      {
        format: 'esm',
        ...(isDevelopmentBuild
          ? {
              dir: './lib',
              entryFileNames: '[name].mjs',
              chunkFileNames: '[name]-[hash].mjs',
              preserveModules: true,
              preserveModulesRoot: './src'
            }
          : {
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
      isAnalyzeBuild && analyze(),
      isDocumentationBuild && command('pnpm typedoc')
    ]
  },
  {
    input: './lib/dts/index.d.ts',
    strictDeprecations: true,
    output: [{ format: 'esm', file: './lib/index.d.ts' }],
    external: [/^node:*/],
    plugins: [
      dts(),
      del({
        targets: ['./lib/dts'],
        hook: 'buildEnd'
      }),
      isAnalyzeBuild && analyze()
    ]
  }
])
