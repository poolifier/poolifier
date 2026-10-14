'use strict'
const { ClusterWorker, KillBehaviors } = require('../../../lib/index.cjs')

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

module.exports = new ClusterWorker(inspectLaunchContext, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 500,
})
