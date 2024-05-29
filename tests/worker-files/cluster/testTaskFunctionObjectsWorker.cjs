'use strict'
const { KillBehaviors, ClusterWorker } = require('../../../lib/index.cjs')
const {
  factorial,
  fibonacci,
  jsonIntegerSerialization
} = require('../../test-utils.cjs')

module.exports = new ClusterWorker(
  {
    jsonIntegerSerialization: {
      taskFunction: data => jsonIntegerSerialization(data.n)
    },
    factorial: { taskFunction: data => factorial(data.n) },
    fibonacci: { taskFunction: data => fibonacci(data.n), priority: -5 }
  },
  {
    killBehavior: KillBehaviors.HARD,
    maxInactiveTime: 500
  }
)
