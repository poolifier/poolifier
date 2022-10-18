// IMPORT LIBRARIES
const WorkerNodes = require('worker-nodes')
// FINISH IMPORT LIBRARIES
const size = Number(process.env.POOL_SIZE)
const iterations = Number(process.env.NUM_ITERATIONS)
const data = {
  test: 'MYBENCH',
  taskType: process.env.TASK_TYPE,
  taskSize: process.env.TASK_SIZE
}

const workerNodes = new WorkerNodes(
  require.resolve('./workers/worker-nodes/function-to-bench-worker'),
  {
    minWorkers: size,
    maxWorkers: size * 3,
    taskTimeout: 60000 // this is the same as poolifier default
  }
)

async function run () {
  const promises = []
  for (let i = 0; i < iterations; i++) {
    promises.push(workerNodes.call.functionToBench(data))
  }
  await Promise.all(promises)
  // eslint-disable-next-line no-process-exit
  process.exit()
}

run()
