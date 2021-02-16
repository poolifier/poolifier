'use strict'
const { ThreadWorker, killBehaviorEnumeration } = require('../../../lib/index')

function echo (data) {
  return data
}

module.exports = new ThreadWorker(echo, {
  maxInactiveTime: 500,
  killBehavior: killBehaviorEnumeration.HARD
})
