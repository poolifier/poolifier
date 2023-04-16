'use strict'
const { ClusterWorker, KillBehaviors } = require('../../../lib')

function error () {
  throw new Error('Error Message from ClusterWorker')
}

module.exports = new ClusterWorker(error, {
  maxInactiveTime: 500,
  killBehavior: KillBehaviors.HARD
})
