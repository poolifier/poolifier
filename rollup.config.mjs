import del from 'rollup-plugin-delete'
import ts from '@wessberg/rollup-plugin-ts'

const isDevelopmentBuild = process.env.BUILD === 'development'

export default {
  input: 'src/index.ts',
  output: {
    dir: 'lib',
    format: 'cjs',
    sourcemap: !!isDevelopmentBuild,
    preserveModules: true,
    preserveModulesRoot: 'src'
  },
  external: ['async_hooks', 'events', 'worker_threads'],
  plugins: [
    ts({
      tsconfig: isDevelopmentBuild
        ? 'tsconfig.development.json'
        : 'tsconfig.json'
    }),
    del({
      targets: 'lib/*'
    })
  ]
}
