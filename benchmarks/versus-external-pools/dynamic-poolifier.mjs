import { DynamicThreadPool } from 'poolifier'
import { executeAsyncFn } from './utils.mjs'

const size = parseInt(process.env.POOL_SIZE)
const iterations = parseInt(process.env.NUM_ITERATIONS)
const data = {
  test: 'MYBENCH',
  taskType: process.env.TASK_TYPE,
  taskSize: parseInt(process.env.TASK_SIZE)
}

const dynamicThreadPool = new DynamicThreadPool(
  Math.floor(size / 2),
  size,
  './workers/poolifier/function-to-bench-worker.mjs',
  {
    enableTasksQueue: false
  }
)

async function run () {
  const promises = new Set()
  for (let i = 0; i < iterations; i++) {
    promises.add(dynamicThreadPool.execute(data))
  }
  await Promise.all(promises)
  // eslint-disable-next-line n/no-process-exit
  process.exit()
}

await executeAsyncFn(run)
