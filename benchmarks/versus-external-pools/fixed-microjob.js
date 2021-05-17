// IMPORT LIBRARIES
const { job, start } = require('microjob')
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

async function run () {
  await start({ maxWorkers: size })
  const promises = []
  for (let i = 0; i < iterations; i++) {
    promises.push(
      job(
        data => {
          functionToBench(data)
        },
        { data: data, ctx: { functionToBench } }
      )
    )
  }
  await Promise.all(promises)
  process.exit()
}

run()
