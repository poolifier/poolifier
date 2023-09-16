import assert from 'node:assert'
import Benchmark from 'benchmark'
import {
  PoolTypes,
  WorkerChoiceStrategies,
  WorkerTypes,
  availableParallelism
} from '../../lib/index.mjs'
import { TaskFunctions } from '../benchmarks-types.mjs'
import {
  LIST_FORMATTER,
  buildPoolifierPool,
  getPoolImplementationName,
  runPoolifierTest
} from '../benchmarks-utils.mjs'

const poolSize = availableParallelism()
const fixedThreadPool = buildPoolifierPool(
  WorkerTypes.thread,
  PoolTypes.fixed,
  poolSize
)

const taskExecutions = 1
const workerData = {
  function: TaskFunctions.jsonIntegerSerialization,
  taskSize: 1000
}

const poolifierSuite = new Benchmark.Suite('Poolifier')

for (const pool of [fixedThreadPool]) {
  for (const workerChoiceStrategy of Object.values(WorkerChoiceStrategies)) {
    for (const enableTasksQueue of [false, true]) {
      poolifierSuite.add(
        `${getPoolImplementationName(pool)}|${workerChoiceStrategy}|${
          enableTasksQueue ? 'with' : 'without'
        } tasks queue`,
        async () => {
          pool.setWorkerChoiceStrategy(workerChoiceStrategy)
          pool.enableTasksQueue(enableTasksQueue)
          assert.strictEqual(
            pool.opts.workerChoiceStrategy,
            workerChoiceStrategy
          )
          assert.strictEqual(pool.opts.enableTasksQueue, enableTasksQueue)
          await runPoolifierTest(pool, {
            taskExecutions,
            workerData
          })
        }
      )
    }
  }
}

poolifierSuite
  .on('cycle', event => {
    console.info(event.target.toString())
  })
  .on('complete', function () {
    console.info(
      'Fastest is ' + LIST_FORMATTER.format(this.filter('fastest').map('name'))
    )
    fixedThreadPool.destroy()
  })
  .run({ async: true })
