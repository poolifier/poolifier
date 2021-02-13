import typescript from 'rollup-plugin-typescript2'
import del from 'rollup-plugin-delete'

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
  external: ['async_hooks', 'cluster', 'events', 'worker_threads'],
  plugins: [
    typescript({
      tsconfig: isDevelopmentBuild
        ? 'tsconfig.development.json'
        : 'tsconfig.json'
    }),
    del({
      targets: 'lib/*'
    })
  ]
}
