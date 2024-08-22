'use strict'
const { ClusterWorker, KillBehaviors } = require('../../../lib/index.cjs')
const {
  factorial,
  fibonacci,
  jsonIntegerSerialization,
} = require('../../test-utils.cjs')

module.exports = new ClusterWorker(
  {
    factorial: { taskFunction: data => factorial(data.n) },
    fibonacci: { priority: -5, taskFunction: data => fibonacci(data.n) },
    jsonIntegerSerialization: {
      taskFunction: data => jsonIntegerSerialization(data.n),
    },
  },
  {
    killBehavior: KillBehaviors.HARD,
    maxInactiveTime: 500,
  }
)
