import { env } from 'node:process'
import { install } from 'husky'

const isCIEnvironment = env.CI != null
if (isCIEnvironment === false) {
  install()
}
