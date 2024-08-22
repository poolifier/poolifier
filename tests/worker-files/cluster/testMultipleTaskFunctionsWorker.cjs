'use strict'
const { ClusterWorker, KillBehaviors } = require('../../../lib/index.cjs')
const {
  factorial,
  fibonacci,
  jsonIntegerSerialization,
} = require('../../test-utils.cjs')

module.exports = new ClusterWorker(
  {
    factorial: data => factorial(data.n),
    fibonacci: data => fibonacci(data.n),
    jsonIntegerSerialization: data => jsonIntegerSerialization(data.n),
  },
  {
    killBehavior: KillBehaviors.HARD,
    maxInactiveTime: 500,
  }
)
