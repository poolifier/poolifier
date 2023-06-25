// IMPORT LIBRARIES
import { FixedThreadPool } from 'poolifier'
// FINISH IMPORT LIBRARIES
const size = parseInt(process.env.POOL_SIZE)
const iterations = parseInt(process.env.NUM_ITERATIONS)
const data = {
  test: 'MYBENCH',
  taskType: process.env.TASK_TYPE,
  taskSize: parseInt(process.env.TASK_SIZE)
}

const fixedPool = new FixedThreadPool(
  size,
  './workers/poolifier/function-to-bench-worker.mjs'
)

async function run () {
  const promises = []
  for (let i = 0; i < iterations; i++) {
    promises.push(fixedPool.execute(data))
  }
  await Promise.all(promises)
  // eslint-disable-next-line n/no-process-exit
  process.exit()
}

await run()
