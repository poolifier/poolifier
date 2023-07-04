import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

export const version = (
  require('../../package.json') as Record<string, unknown>
).version as string
