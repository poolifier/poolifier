// IMPORT LIBRARIES
const { DynamicPool, StaticPool } = require('node-worker-threads-pool')
// FINISH IMPORT LIBRARIES
// IMPORT FUNCTION TO BENCH
const jsonStringify = require('./functions/jsonstringify')
// FINISH IMPORT FUNCTION TO BENCH
const size = process.env.POOL_SIZE
const iterations = process.env.NUM_ITERATIONS
const data = {
  test: 'MYBENCH'
}

const pool = new DynamicPool(Number(size))

async function run () {
  const promises = []
  for (let i = 0; i < iterations; i++) {
    promises.push(
      pool.exec({
        task: jsonStringify,
        param: data
      })
    )
  }
  await Promise.all(promises)
  process.exit()
}

run()
