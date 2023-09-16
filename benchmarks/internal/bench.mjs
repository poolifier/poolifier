import Benchmark from 'benchmark'
import {
  Measurements,
  PoolTypes,
  WorkerChoiceStrategies,
  WorkerTypes,
  availableParallelism
} from '../../lib/index.mjs'
import { TaskFunctions } from '../benchmarks-types.mjs'
import {
  LIST_FORMATTER,
  buildPoolifierPool,
  runPoolifierTest
} from '../benchmarks-utils.mjs'

const poolSize = availableParallelism()
const pools = []
for (const poolType of Object.values(PoolTypes)) {
  for (const workerType of Object.values(WorkerTypes)) {
    if (workerType === WorkerTypes.cluster) {
      continue
    }
    for (const workerChoiceStrategy of Object.values(WorkerChoiceStrategies)) {
      for (const enableTasksQueue of [false]) {
        if (workerChoiceStrategy === WorkerChoiceStrategies.FAIR_SHARE) {
          for (const measurement of [Measurements.runTime, Measurements.elu]) {
            pools.push([
              `${poolType}|${workerType}|${workerChoiceStrategy}|tasks queue:${enableTasksQueue}|measurement:${measurement}`,
              buildPoolifierPool(workerType, poolType, poolSize, {
                workerChoiceStrategy,
                workerChoiceStrategyOptions: {
                  measurement
                },
                enableTasksQueue
              })
            ])
          }
        } else {
          pools.push([
            `${poolType}|${workerType}|${workerChoiceStrategy}|tasks queue:${enableTasksQueue}`,
            buildPoolifierPool(workerType, poolType, poolSize, {
              workerChoiceStrategy,
              enableTasksQueue
            })
          ])
        }
      }
    }
  }
}

const taskExecutions = 1
const workerData = {
  function: TaskFunctions.jsonIntegerSerialization,
  taskSize: 100
}

const suite = new Benchmark.Suite('Poolifier')
for (const [name, pool] of pools) {
  suite.add(name, async () => {
    await runPoolifierTest(pool, {
      taskExecutions,
      workerData
    })
  })
}

suite
  .on('cycle', event => {
    console.info(event.target.toString())
  })
  .on('complete', function () {
    console.info(
      'Fastest is ' + LIST_FORMATTER.format(this.filter('fastest').map('name'))
    )
    // eslint-disable-next-line n/no-process-exit
    process.exit()
  })
  .run({ async: true, maxTime: 120 })
