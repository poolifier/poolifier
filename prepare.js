const { env } = require('node:process')

const isCIEnvironment = env.CI != null
if (isCIEnvironment === false) {
  require('husky').install()
}
