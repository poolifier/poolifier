'use strict'
const { ThreadWorker, KillBehaviors } = require('../../../lib/index')

function echo (data) {
  return data
}

module.exports = new ThreadWorker(echo, {
  killBehavior: KillBehaviors.HARD
})
