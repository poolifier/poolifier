'use strict'
const { ThreadWorker, KillBehaviors } = require('../../../lib/index')

function error () {
  throw new Error('Error Message from ThreadWorker')
}

module.exports = new ThreadWorker(error, {
  maxInactiveTime: 500,
  killBehavior: KillBehaviors.HARD
})
