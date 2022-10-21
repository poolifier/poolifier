// IMPORT LIBRARIES
const threadPool = require('./pool-threadwork')
// FINISH IMPORT LIBRARIES
const iterations = parseInt(process.env.NUM_ITERATIONS)
const data = {
  test: 'MYBENCH',
  taskType: process.env.TASK_TYPE,
  taskSize: parseInt(process.env.TASK_SIZE)
}

async function run () {
  const promises = []
  for (let i = 0; i < iterations; i++) {
    promises.push(threadPool.run(data))
  }
  await Promise.all(promises)
  // eslint-disable-next-line n/no-process-exit
  process.exit()
}

run()
