'use strict'
const { KillBehaviors, ThreadWorker } = require('../../../lib/index.cjs')
const {
  factorial,
  fibonacci,
  jsonIntegerSerialization
} = require('../../test-utils.cjs')

module.exports = new ThreadWorker(
  {
    jsonIntegerSerialization: {
      taskFunction: data => jsonIntegerSerialization(data.n)
    },
    factorial: { taskFunction: data => factorial(data.n) },
    fibonacci: { taskFunction: data => fibonacci(data.n) }
  },
  {
    killBehavior: KillBehaviors.HARD,
    maxInactiveTime: 500
  }
)
