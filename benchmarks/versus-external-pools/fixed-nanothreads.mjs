import { ThreadPool } from 'nanothreads'
import { executeAsyncFn } from './utils.mjs'
import functionToBench from './functions/function-to-bench.js'

const size = parseInt(process.env.POOL_SIZE)
const iterations = parseInt(process.env.NUM_ITERATIONS)
const data = {
  test: 'MYBENCH',
  taskType: process.env.TASK_TYPE,
  taskSize: parseInt(process.env.TASK_SIZE)
}

const threadPool = new ThreadPool({
  task: functionToBench,
  count: size
})

async function run () {
  const promises = new Set()
  for (let i = 0; i < iterations; i++) {
    promises.add(threadPool.exec(data))
  }
  await Promise.all(promises)
  // eslint-disable-next-line n/no-process-exit
  process.exit()
}

await executeAsyncFn(run)
