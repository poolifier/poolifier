'use strict'
const { ClusterWorker, KillBehaviors } = require('../../../lib/index.cjs')
const {
  jsonIntegerSerialization,
  factorial,
  fibonacci,
} = require('../../test-utils.cjs')

module.exports = new ClusterWorker(
  {
    jsonIntegerSerialization: data => jsonIntegerSerialization(data.n),
    factorial: data => factorial(data.n),
    fibonacci: data => fibonacci(data.n),
  },
  {
    killBehavior: KillBehaviors.HARD,
    maxInactiveTime: 500,
  }
)
