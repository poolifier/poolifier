// IMPORT LIBRARIES
const { job, start } = require('microjob')
// FINISH IMPORT LIBRARIES
// IMPORT FUNCTION TO BENCH
const functionToBench = require('./functions/function-to-bench')
// FINISH IMPORT FUNCTION TO BENCH
const size = parseInt(process.env.POOL_SIZE)
const iterations = parseInt(process.env.NUM_ITERATIONS)
const data = {
  test: 'MYBENCH',
  taskType: process.env.TASK_TYPE,
  taskSize: parseInt(process.env.TASK_SIZE)
}

async function run () {
  await start({ maxWorkers: size })
  const promises = []
  for (let i = 0; i < iterations; i++) {
    promises.push(
      job(
        data => {
          functionToBench(data)
        },
        { data, ctx: { functionToBench } }
      )
    )
  }
  await Promise.all(promises)
  // eslint-disable-next-line n/no-process-exit
  process.exit()
}

run()
