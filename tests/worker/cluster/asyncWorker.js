'use strict'
const { ClusterWorker, killBehaviorEnumeration } = require('../../../lib/index')

async function sleep (data) {
  return new Promise((resolve, reject) => {
    setTimeout(() => resolve(data), 2000)
  })
}

module.exports = new ClusterWorker(sleep, {
  maxInactiveTime: 500,
  async: true,
  killBehavior: killBehaviorEnumeration.HARD
})
