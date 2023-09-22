import { DynamicPool } from 'node-worker-threads-pool'
import { BenchmarkDefaults, executeAsyncFn } from './utils.mjs'
import functionToBench from './functions/function-to-bench.js'

const size = parseInt(process.env.POOL_SIZE) || BenchmarkDefaults.poolSize
const numIterations =
  parseInt(process.env.NUM_ITERATIONS) || BenchmarkDefaults.numIterations
const data = {
  test: 'MYBENCH',
  taskType: process.env.TASK_TYPE || BenchmarkDefaults.taskType,
  taskSize: parseInt(process.env.TASK_SIZE) || BenchmarkDefaults.taskSize
}

const dynamicPool = new DynamicPool(size)

async function run () {
  const promises = new Set()
  for (let i = 0; i < numIterations; i++) {
    promises.add(
      dynamicPool.exec({
        task: functionToBench,
        param: data,
        timeout: 60000 // this is the same as poolifier default
      })
    )
  }
  await Promise.all(promises)
  // eslint-disable-next-line n/no-process-exit
  process.exit()
}

await executeAsyncFn(run)
