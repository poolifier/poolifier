import workerpool from 'workerpool'
import functionToBench from '../../functions/function-to-bench.js'

const functionToBenchWrapper = (testName, taskType, taskSize) => {
  return functionToBench({
    test: testName,
    taskType,
    taskSize
  })
}

workerpool.worker({
  functionToBench: functionToBenchWrapper
})
