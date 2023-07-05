// IMPORT LIBRARIES
import { StaticPool } from 'node-worker-threads-pool'
// FINISH IMPORT LIBRARIES
// IMPORT FUNCTION TO BENCH
import functionToBench from './functions/function-to-bench.js'
// FINISH IMPORT FUNCTION TO BENCH
const size = parseInt(process.env.POOL_SIZE)
const iterations = parseInt(process.env.NUM_ITERATIONS)
const data = {
  test: 'MYBENCH',
  taskType: process.env.TASK_TYPE,
  taskSize: parseInt(process.env.TASK_SIZE)
}

const pool = new StaticPool({
  size,
  task: functionToBench
})

async function run () {
  const promises = new Set()
  for (let i = 0; i < iterations; i++) {
    promises.add(pool.exec(data))
  }
  await Promise.all(promises)
  // eslint-disable-next-line n/no-process-exit
  process.exit()
}

await run()
