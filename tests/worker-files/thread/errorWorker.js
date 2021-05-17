'use strict'
const { ThreadWorker, KillBehaviors } = require('../../../lib/index')

function error (data) {
  throw new Error(data)
}

module.exports = new ThreadWorker(error, {
  maxInactiveTime: 500,
  async: false,
  killBehavior: KillBehaviors.HARD
})
