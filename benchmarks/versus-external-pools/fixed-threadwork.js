// IMPORT LIBRARIES
const threadPool = require('./pool-threadwork')
// FINISH IMPORT LIBRARIES
const iterations = Number(process.env.NUM_ITERATIONS)
const data = {
  test: 'MYBENCH',
  taskType: process.env['TASK_TYPE']
}

async function run () {
  const promises = []
  for (let i = 0; i < iterations; i++) {
    promises.push(threadPool.run(data))
  }
  await Promise.all(promises)
  process.exit()
}

run()
