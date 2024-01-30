import { env } from 'node:process'

const isCIEnvironment = env.CI != null
if (isCIEnvironment === false) {
  import('husky')
    .then(husky => console.warn(husky.default()))
    .catch(console.error)
}
