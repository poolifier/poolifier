// IMPORT LIBRARIES
const Pool = require('worker-threads-pool')
// FINISH IMPORT LIBRARIES
const size = Number(process.env.POOL_SIZE)
const iterations = Number(process.env.NUM_ITERATIONS)
const data = {
  test: 'MYBENCH',
  taskType: process.env['TASK_TYPE']
}

const pool = new Pool({ max: size })

async function run () {
  const promises = []
  for (let i = 0; i < iterations; i++) {
    promises.push(
      pool.acquire(
        './workers/worker-threads-pool/function-to-bench-worker.js',
        {
          workerData: data
        }
      )
    )
  }
  await Promise.all(promises)
  process.exit()
}

run()
