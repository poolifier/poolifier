// IMPORT LIBRARIES
const { FixedThreadPool } = require('poolifier')
// FINISH IMPORT LIBRARIES
const size = Number(process.env.POOL_SIZE)
const iterations = Number(process.env.NUM_ITERATIONS)
const data = {
  test: 'MYBENCH',
  taskType: process.env['TASK_TYPE']
}

const fixedPool = new FixedThreadPool(
  size,
  './workers/poolifier/function-to-bench-worker.js'
)

async function run () {
  const promises = []
  for (let i = 0; i < iterations; i++) {
    promises.push(fixedPool.execute(data))
  }
  await Promise.all(promises)
  process.exit()
}

run()
