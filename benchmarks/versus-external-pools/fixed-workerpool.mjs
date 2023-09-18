import workerpool from 'workerpool'
import { executeAsyncFn } from './utils.mjs'

const size = parseInt(process.env.POOL_SIZE)
const iterations = parseInt(process.env.NUM_ITERATIONS)
const dataArray = [
  'MYBENCH',
  process.env.TASK_TYPE,
  parseInt(process.env.TASK_SIZE)
]

const workerPool = workerpool.pool(
  './workers/workerpool/function-to-bench-worker.mjs',
  {
    minWorkers: size,
    maxWorkers: size,
    workerType: 'thread'
  }
)

async function run () {
  const promises = new Set()
  for (let i = 0; i < iterations; i++) {
    promises.add(workerPool.exec('functionToBench', dataArray))
  }
  await Promise.all(promises)
  // eslint-disable-next-line n/no-process-exit
  process.exit()
}

await executeAsyncFn(run)
