// IMPORT LIBRARIES
const { DynamicThreadPool } = require('poolifier')
// FINISH IMPORT LIBRARIES
const size = process.env.POOL_SIZE
const iterations = process.env.NUM_ITERATIONS
const data = {
  test: 'MYBENCH',
  taskType: process.env['TASK_TYPE']
}

const dynamicPool = new DynamicThreadPool(
  Number(size),
  size * 3,
  './workers/poolifier/function-to-bench-worker.js'
)

async function run () {
  const promises = []
  for (let i = 0; i < iterations; i++) {
    promises.push(dynamicPool.execute(data))
  }
  await Promise.all(promises)
  process.exit()
}

run()
