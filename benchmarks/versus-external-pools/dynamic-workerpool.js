// IMPORT LIBRARIES
const workerpool = require('workerpool')
// FINISH IMPORT LIBRARIES
const size = Number(process.env.POOL_SIZE)
const iterations = Number(process.env.NUM_ITERATIONS)
const dataArray = ['MYBENCH', process.env['TASK_TYPE']]

const workerPool = workerpool.pool(
  './workers/workerpool/function-to-bench-worker.js',
  {
    minWorkers: size,
    maxWorkers: size * 3,
    workerType: 'thread'
  }
)

async function run () {
  const promises = []
  for (let i = 0; i < iterations; i++) {
    promises.push(workerPool.exec('functionToBench', dataArray))
  }
  await Promise.all(promises)
  process.exit()
}

run()
