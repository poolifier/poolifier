'use strict'
const { ClusterWorker, KillBehaviors } = require('../../../lib/index.cjs')
const {
  factorial,
  fibonacci,
  jsonIntegerSerialization,
} = require('../../test-utils.cjs')

module.exports = new ClusterWorker(
  {
    factorial: {
      priority: 1,
      taskFunction: data => factorial(data.n),
      workerNodeKeys: [0],
    },
    fibonacci: {
      priority: 2,
      taskFunction: data => fibonacci(data.n),
      workerNodeKeys: [0, 1],
    },
    jsonIntegerSerialization: data => jsonIntegerSerialization(data.n),
  },
  {
    killBehavior: KillBehaviors.HARD,
    maxInactiveTime: 500,
  }
)
