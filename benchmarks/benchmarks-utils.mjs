import { strictEqual } from 'node:assert'
import { bench, clear, group, run } from 'tatami-ng'

import {
  DynamicClusterPool,
  DynamicThreadPool,
  FixedClusterPool,
  FixedThreadPool,
  Measurements,
  PoolTypes,
  WorkerChoiceStrategies,
  WorkerTypes,
} from '../lib/index.mjs'
import { executeTaskFunction } from './benchmarks-utils.cjs'

const buildPoolifierPool = (workerType, poolType, poolSize, poolOptions) => {
  switch (poolType) {
    case PoolTypes.dynamic:
      switch (workerType) {
        case WorkerTypes.cluster:
          return new DynamicClusterPool(
            Math.floor(poolSize / 2),
            poolSize,
            './benchmarks/internal/cluster-worker.cjs',
            poolOptions
          )
        case WorkerTypes.thread:
          return new DynamicThreadPool(
            Math.floor(poolSize / 2),
            poolSize,
            './benchmarks/internal/thread-worker.mjs',
            poolOptions
          )
      }
      break
    case PoolTypes.fixed:
      switch (workerType) {
        case WorkerTypes.cluster:
          return new FixedClusterPool(
            poolSize,
            './benchmarks/internal/cluster-worker.cjs',
            poolOptions
          )
        case WorkerTypes.thread:
          return new FixedThreadPool(
            poolSize,
            './benchmarks/internal/thread-worker.mjs',
            poolOptions
          )
      }
      break
  }
}

const runPoolifierPool = async (pool, { taskExecutions, workerData }) => {
  for (let i = 1; i <= taskExecutions; i++) {
    await pool.execute(workerData)
  }
}

export const runPoolifierBenchmarkTatamiNg = async (
  name,
  workerType,
  poolType,
  poolSize,
  { taskExecutions, workerData }
) => {
  try {
    const pool = buildPoolifierPool(workerType, poolType, poolSize)
    for (const workerChoiceStrategy of Object.values(WorkerChoiceStrategies)) {
      for (const enableTasksQueue of [false, true]) {
        if (workerChoiceStrategy === WorkerChoiceStrategies.FAIR_SHARE) {
          for (const measurement of [Measurements.runTime, Measurements.elu]) {
            group(name, () => {
              bench(
                `${name} with ${workerChoiceStrategy}, with ${measurement} and ${
                  enableTasksQueue ? 'with' : 'without'
                } tasks queue`,
                async () => {
                  await runPoolifierPool(pool, {
                    taskExecutions,
                    workerData,
                  })
                },
                {
                  before: () => {
                    pool.setWorkerChoiceStrategy(workerChoiceStrategy, {
                      measurement,
                    })
                    pool.enableTasksQueue(enableTasksQueue)
                    strictEqual(
                      pool.opts.workerChoiceStrategy,
                      workerChoiceStrategy
                    )
                    strictEqual(pool.opts.enableTasksQueue, enableTasksQueue)
                    strictEqual(
                      pool.opts.workerChoiceStrategyOptions.measurement,
                      measurement
                    )
                  },
                }
              )
            })
          }
        } else {
          group(name, () => {
            bench(
              `${name} with ${workerChoiceStrategy} and ${
                enableTasksQueue ? 'with' : 'without'
              } tasks queue`,
              async () => {
                await runPoolifierPool(pool, {
                  taskExecutions,
                  workerData,
                })
              },
              {
                before: () => {
                  pool.setWorkerChoiceStrategy(workerChoiceStrategy)
                  pool.enableTasksQueue(enableTasksQueue)
                  strictEqual(
                    pool.opts.workerChoiceStrategy,
                    workerChoiceStrategy
                  )
                  strictEqual(pool.opts.enableTasksQueue, enableTasksQueue)
                },
              }
            )
          })
        }
      }
    }
    const report = await run()
    clear()
    await pool.destroy()
    return report
  } catch (error) {
    console.error(error)
  }
}

export const convertTatamiNgToBmf = report => {
  return report.benchmarks
    .map(({ name, stats }) => {
      return {
        [name]: {
          latency: {
            lower_value: stats?.min,
            upper_value: stats?.max,
            value: stats?.avg,
          },
          throughput: {
            value: stats?.iter,
          },
        },
      }
    })
    .reduce((obj, item) => Object.assign(obj, item), {})
}

export { executeTaskFunction }
