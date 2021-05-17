// IMPORT LIBRARIES
const { StaticPool } = require('node-worker-threads-pool')
// FINISH IMPORT LIBRARIES
// IMPORT FUNCTION TO BENCH
const functionToBench = require('./functions/function-to-bench')
// FINISH IMPORT FUNCTION TO BENCH
const size = Number(process.env.POOL_SIZE)
const iterations = Number(process.env.NUM_ITERATIONS)
const data = {
  test: 'MYBENCH',
  taskType: process.env['TASK_TYPE']
}

const pool = new StaticPool({
  size: size,
  task: functionToBench
})

async function run () {
  const promises = []
  for (let i = 0; i < iterations; i++) {
    promises.push(pool.exec(data))
  }
  await Promise.all(promises)
  process.exit()
}

run()
