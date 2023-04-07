const isCIEnvironment = process.env.CI != null
if (isCIEnvironment === false) {
  require('husky').install()
}
