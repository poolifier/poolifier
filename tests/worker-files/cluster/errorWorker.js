'use strict'
const { ClusterWorker, KillBehaviors } = require('../../../lib')

function error () {
  throw new Error('Error Message from ClusterWorker')
}

module.exports = new ClusterWorker(error, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 500
})
