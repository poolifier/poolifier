'use strict'
const { ClusterWorker, KillBehaviors } = require('../../../lib')

function echo (data) {
  return data
}

module.exports = new ClusterWorker(echo, {
  killBehavior: KillBehaviors.HARD
})
