import Tinypool from 'tinypool'
import { executeAsyncFn } from './utils.mjs'

const size = parseInt(process.env.POOL_SIZE)
const iterations = parseInt(process.env.NUM_ITERATIONS)
const data = {
  test: 'MYBENCH',
  taskType: process.env.TASK_TYPE,
  taskSize: parseInt(process.env.TASK_SIZE)
}

const tinypool = new Tinypool({
  filename: './workers/tinypool/function-to-bench-worker.mjs',
  minThreads: size,
  maxThreads: size,
  idleTimeout: 60000 // this is the same as poolifier default
})

async function run () {
  const promises = new Set()
  for (let i = 0; i < iterations; i++) {
    promises.add(tinypool.run(data))
  }
  await Promise.all(promises)
  // eslint-disable-next-line n/no-process-exit
  process.exit()
}

await executeAsyncFn(run)
