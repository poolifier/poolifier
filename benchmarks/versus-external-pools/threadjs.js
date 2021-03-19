// IMPORT LIBRARIES
const { spawn, Thread, Worker } = require('threads')
// FINISH IMPORT LIBRARIES
const size = Number(process.env.POOL_SIZE)
const iterations = Number(process.env.NUM_ITERATIONS)
const data = {
  test: 'MYBENCH',
  taskType: process.env['TASK_TYPE']
}

// Threads.js is not really a pool so we need to write few additional code
const workers = []
async function poolify () {
  for (let i = 0; i < size; i++) {
    const worker = await spawn(
      new Worker('./workers/threadjs/function-to-bench-worker.js')
    )
    workers.push(worker)
  }
}

async function run () {
  await poolify()
  const promises = []
  for (let i = 0; i < iterations; i++) {
    const worker = workers[i % size]
    promises.push(worker.exposedFunction(data))
  }
  await Promise.all(promises)
  process.exit()
}

run()
