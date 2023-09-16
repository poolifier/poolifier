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

const poolifierSuite = new Benchmark.Suite('Poolifier', {
  onCycle: event => {
    console.info(event.target.toString())
  },
  onComplete: function () {
    console.info(
      'Fastest is ' + LIST_FORMATTER.format(this.filter('fastest').map('name'))
    )
  }
})

const poolSize = availableParallelism()
const benchmarkSettings = []
for (const poolType of Object.values(PoolTypes)) {
  for (const workerType of Object.values(WorkerTypes)) {
    if (workerType === WorkerTypes.cluster) {
      continue
    }
    for (const workerChoiceStrategy of Object.values(WorkerChoiceStrategies)) {
      for (const enableTasksQueue of [false, true]) {
        if (workerChoiceStrategy === WorkerChoiceStrategies.FAIR_SHARE) {
          for (const measurement of [Measurements.runTime, Measurements.elu]) {
            benchmarkSettings.push([
              `${poolType}|${workerType}|${workerChoiceStrategy}|tasks queue:${enableTasksQueue}|measurement:${measurement}`,
              workerType,
              poolType,
              poolSize,
              {
                workerChoiceStrategy,
                workerChoiceStrategyOptions: {
                  measurement
                },
                enableTasksQueue
              }
            ])
          }
        } else {
          benchmarkSettings.push([
            `${poolType}|${workerType}|${workerChoiceStrategy}|tasks queue:${enableTasksQueue}`,
            workerType,
            poolType,
            poolSize,
            {
              workerChoiceStrategy,
              enableTasksQueue
            }
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

for (const [
  name,
  workerType,
  poolType,
  poolSize,
  poolOptions
] of benchmarkSettings) {
  poolifierSuite.add(name, async () => {
    const pool = buildPoolifierPool(workerType, poolType, poolSize, poolOptions)
    await runPoolifierTest(pool, {
      taskExecutions,
      workerData
    })
    await pool.destroy()
  })
}

poolifierSuite.run({ async: true })
