import { DynamicPool } from 'node-worker-threads-pool'
import { executeAsyncFn } from './utils.mjs'
import functionToBench from './functions/function-to-bench.js'

const size = parseInt(process.env.POOL_SIZE)
const iterations = parseInt(process.env.NUM_ITERATIONS)
const data = {
  test: 'MYBENCH',
  taskType: process.env.TASK_TYPE,
  taskSize: parseInt(process.env.TASK_SIZE)
}

const dynamicPool = new DynamicPool(size)

async function run () {
  const promises = new Set()
  for (let i = 0; i < iterations; i++) {
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
