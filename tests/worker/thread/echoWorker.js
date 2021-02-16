'use strict'
const { ThreadWorker, killBehaviorTypes } = require('../../../lib/index')

function echo (data) {
  return data
}

module.exports = new ThreadWorker(echo, {
  maxInactiveTime: 500,
  killBehavior: killBehaviorTypes.HARD
})
