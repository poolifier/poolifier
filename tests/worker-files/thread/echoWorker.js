'use strict'
const { ThreadWorker, KillBehaviors } = require('../../../lib/index')

function echo (data) {
  return data
}

module.exports = new ThreadWorker(echo, {
  maxInactiveTime: 500,
  killBehavior: KillBehaviors.HARD
})
