import workerpool from 'workerpool'
import functionToBench from '../../functions/function-to-bench.mjs'

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
