import { add, complete, cycle, save, suite } from 'benny'
import {
  Measurements,
  PoolTypes,
  WorkerChoiceStrategies,
  WorkerTypes,
  availableParallelism
} from '../../lib/index.mjs'
import { WorkerFunctions } from '../benchmarks-types.mjs'
import { buildPool, runTest } from '../benchmarks-utils.mjs'

const poolSize = availableParallelism()
const pools = []
for (const poolType of Object.values(PoolTypes)) {
  for (const workerType of Object.values(WorkerTypes)) {
    if (workerType === WorkerTypes.cluster) {
      continue
    }
    for (const workerChoiceStrategy of Object.values(WorkerChoiceStrategies)) {
      for (const enableTasksQueue of [false, true]) {
        if (workerChoiceStrategy === WorkerChoiceStrategies.FAIR_SHARE) {
          for (const measurement of [Measurements.runTime, Measurements.elu]) {
            const pool = buildPool(workerType, poolType, poolSize, {
              workerChoiceStrategy,
              workerChoiceStrategyOptions: {
                measurement
              },
              enableTasksQueue
            })
            pools.push([
              `${poolType}|${workerType}|${workerChoiceStrategy}|tasks queue:${enableTasksQueue}|measurement:${measurement}`,
              pool
            ])
          }
        } else {
          const pool = buildPool(workerType, poolType, poolSize, {
            workerChoiceStrategy,
            enableTasksQueue
          })
          pools.push([
            `${poolType}|${workerType}|${workerChoiceStrategy}|tasks queue:${enableTasksQueue}`,
            pool
          ])
        }
      }
    }
  }
}

const taskExecutions = 1
const workerData = {
  function: WorkerFunctions.jsonIntegerSerialization,
  taskSize: 1000
}
const addPools = pools =>
  pools.map(([name, pool]) => {
    return add(name, async () => {
      await runTest(pool, {
        taskExecutions,
        workerData
      })
    })
  })

const resultsFile = 'poolifier'
const resultsFolder = 'benchmarks/internal/results'
suite(
  'Poolifier',
  ...addPools(pools),
  cycle(),
  complete(),
  save({
    file: resultsFile,
    folder: resultsFolder,
    format: 'json',
    details: true
  }),
  save({
    file: resultsFile,
    folder: resultsFolder,
    format: 'chart.html',
    details: true
  }),
  save({
    file: resultsFile,
    folder: resultsFolder,
    format: 'table.html',
    details: true
  })
)
  .then(() => {
    // eslint-disable-next-line n/no-process-exit
    return process.exit()
  })
  .catch(err => console.error(err))
