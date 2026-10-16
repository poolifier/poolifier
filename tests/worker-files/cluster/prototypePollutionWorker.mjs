import { ClusterWorker, KillBehaviors } from '../../../lib/index.mjs'

/**
 * Returns the cluster worker launch context needed by security regressions.
 * @param data - Requested environment key.
 * @returns The observed launch context.
 */
function inspectLaunchContext (data = {}) {
  return {
    cwd: process.cwd(),
    envValue: process.env[data.envKey],
    execArgv: process.execArgv,
    hasEnvKey: Object.hasOwn(process.env, data.envKey),
  }
}

export default new ClusterWorker(inspectLaunchContext, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 500,
})
