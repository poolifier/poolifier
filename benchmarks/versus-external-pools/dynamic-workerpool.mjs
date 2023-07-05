// IMPORT LIBRARIES
import workerpool from 'workerpool'
// FINISH IMPORT LIBRARIES
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
    minWorkers: Math.floor(size / 2),
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

await run()
