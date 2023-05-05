'use strict'
const { isMaster } = require('cluster')
const { ClusterWorker, KillBehaviors } = require('../../../lib')
const {
  jsonIntegerSerialization,
  factorial,
  fibonacci
} = require('../../test-utils')

module.exports = new ClusterWorker(
  {
    jsonIntegerSerialization: data => {
      jsonIntegerSerialization(data.n)
      return isMaster
    },
    factorial: data => factorial(data.n),
    fibonacci: data => fibonacci(data.n)
  },
  {
    maxInactiveTime: 500,
    killBehavior: KillBehaviors.HARD
  }
)
