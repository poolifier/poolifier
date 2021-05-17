'use strict'
const workerpool = require('workerpool')
const functionToBench = require('../../functions/function-to-bench')

function workerPoolWrapperFunctionToBench (testName, taskType) {
  return functionToBench({ test: testName, taskType: taskType })
}

workerpool.worker({
  functionToBench: workerPoolWrapperFunctionToBench
})
