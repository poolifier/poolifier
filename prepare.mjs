import { env } from 'node:process'

const isCIEnvironment = env.CI != null
if (isCIEnvironment === false) {
  import('husky').then(({ install }) => install()).catch(console.error)
}
