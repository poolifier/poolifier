'use strict'
const { ClusterWorker, KillBehaviors } = require('../../../lib/index')

async function error (data) {
  return new Promise((resolve, reject) => {
    setTimeout(
      () => reject(new Error('Error Message from ClusterWorker:async')),
      2000
    )
  })
}

module.exports = new ClusterWorker(error, {
  maxInactiveTime: 500,
  async: true,
  killBehavior: KillBehaviors.HARD
})
