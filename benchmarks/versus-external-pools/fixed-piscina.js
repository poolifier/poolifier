// IMPORT LIBRARIES
const Piscina = require('piscina')
// FINISH IMPORT LIBRARIES
const size = Number(process.env.POOL_SIZE)
const iterations = Number(process.env.NUM_ITERATIONS)
const data = {
  test: 'MYBENCH',
  taskType: process.env['TASK_TYPE']
}

const piscina = new Piscina({
  filename: './workers/piscina/function-to-bench-worker.js',
  minThreads: size,
  idleTimeout: 1000 * 60 // this is the same as poolifier default
})

async function run () {
  const promises = []
  for (let i = 0; i < iterations; i++) {
    promises.push(piscina.runTask(data))
  }
  await Promise.all(promises)
  process.exit()
}

run()
