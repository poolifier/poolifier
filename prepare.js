const isCIEnvironment = process.env.CI !== undefined
if (isCIEnvironment === false) {
  require('husky').install()
}
