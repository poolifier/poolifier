import workerpool from 'workerpool'
import functionToBench from '../../functions/function-to-bench.mjs'

async function workerPoolWrapperFunctionToBench (testName, taskType, taskSize) {
  return await functionToBench({
    test: testName,
    taskType,
    taskSize
  })
}

workerpool.worker({
  functionToBench: workerPoolWrapperFunctionToBench
})
