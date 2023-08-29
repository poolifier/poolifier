'use strict'
const { ThreadWorker, KillBehaviors } = require('../../../lib')

function error () {
  throw new Error('Error Message from ThreadWorker')
}

module.exports = new ThreadWorker(error, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 500
})
