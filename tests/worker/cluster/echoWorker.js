'use strict'
const { ClusterWorker, killBehaviorTypes } = require('../../../lib/index')

function echo (data) {
  return data
}

module.exports = new ClusterWorker(echo, {
  maxInactiveTime: 500,
  killBehavior: killBehaviorTypes.HARD
})
