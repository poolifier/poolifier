'use strict'
const { ClusterWorker, KillBehaviors } = require('../../../lib/index.cjs')

/**
 * Test worker function that echoes the input data.
 * @param data - The task data to echo.
 * @returns The same data that was passed in.
 */
function echo (data) {
  return data
}

module.exports = new ClusterWorker(echo, {
  killBehavior: KillBehaviors.HARD,
})
