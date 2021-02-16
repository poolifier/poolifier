'use strict'
const { ClusterWorker, KillBehaviors } = require('../../../lib/index')

async function sleep (data) {
  return new Promise((resolve, reject) => {
    setTimeout(() => resolve(data), 50000)
  })
}

module.exports = new ClusterWorker(sleep, {
  maxInactiveTime: 500,
  async: true,
  killBehavior: KillBehaviors.HARD
})
