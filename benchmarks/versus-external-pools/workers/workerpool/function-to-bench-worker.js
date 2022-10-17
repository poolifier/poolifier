'use strict'
const workerpool = require('workerpool')
const functionToBench = require('../../functions/function-to-bench')

function workerPoolWrapperFunctionToBench (testName, taskType, taskSize) {
  return functionToBench({
    test: testName,
    taskType,
    taskSize
  })
}

workerpool.worker({
  functionToBench: workerPoolWrapperFunctionToBench
})
