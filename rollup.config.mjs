import terser from '@rollup/plugin-terser'
import typescript from '@rollup/plugin-typescript'
import * as os from 'node:os'
import { env } from 'node:process'
import { defineConfig } from 'rollup'
import analyze from 'rollup-plugin-analyzer'
import command from 'rollup-plugin-command'
import del from 'rollup-plugin-delete'
import { dts } from 'rollup-plugin-dts'

const availableParallelism = () => {
  let availableParallelism = 1
  try {
    // eslint-disable-next-line n/no-unsupported-features/node-builtins
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
    external: [/^node:*/],
    input: './src/index.ts',
    output: [
      {
        format: 'cjs',
        ...(isDevelopmentBuild
          ? {
              chunkFileNames: '[name]-[hash].cjs',
              dir: './lib',
              entryFileNames: '[name].cjs',
              preserveModules: true,
              preserveModulesRoot: './src',
            }
          : {
              file: './lib/index.cjs',
              plugins: [terser({ maxWorkers })],
            }),
        ...(sourcemap && {
          sourcemap,
        }),
      },
      {
        format: 'esm',
        ...(isDevelopmentBuild
          ? {
              chunkFileNames: '[name]-[hash].mjs',
              dir: './lib',
              entryFileNames: '[name].mjs',
              preserveModules: true,
              preserveModulesRoot: './src',
            }
          : {
              file: './lib/index.mjs',
              plugins: [terser({ maxWorkers })],
            }),
        ...(sourcemap && {
          sourcemap,
        }),
      },
    ],
    plugins: [
      typescript({
        compilerOptions: {
          sourceMap: sourcemap,
        },
        tsconfig: './tsconfig.build.json',
      }),
      del({
        targets: ['./lib/*'],
      }),
      isAnalyzeBuild && analyze(),
      isDocumentationBuild && command('pnpm typedoc'),
    ],
    strictDeprecations: true,
  },
  {
    external: [/^node:*/],
    input: './lib/dts/index.d.ts',
    output: [{ file: './lib/index.d.ts', format: 'esm' }],
    plugins: [
      dts(),
      del({
        hook: 'buildEnd',
        targets: ['./lib/dts'],
      }),
      isAnalyzeBuild && analyze(),
    ],
    strictDeprecations: true,
  },
])
