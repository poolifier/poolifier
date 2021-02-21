// IMPORT LIBRARIES
const { FixedThreadPool, DynamicThreadPool } = require('../../lib/index')
// FINISH IMPORT LIBRARIES
const size = process.env.POOL_SIZE
const iterations = process.env.NUM_ITERATIONS
const data = {
  test: 'MYBENCH'
}

const fixedPool = new FixedThreadPool(
  size,
  './workers/poolifier/json-stringify.worker.js',
  {
    maxTasks: 100000
  }
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
