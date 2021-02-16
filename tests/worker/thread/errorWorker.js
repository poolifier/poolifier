'use strict'
const { ThreadWorker, killBehaviorEnumeration } = require('../../../lib/index')

function error (data) {
  throw new Error(data)
}

module.exports = new ThreadWorker(error, {
  maxInactiveTime: 500,
  killBehavior: killBehaviorEnumeration.HARD
})
