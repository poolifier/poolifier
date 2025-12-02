import { strictEqual } from 'node:assert'
import { Bench } from 'tinybench'

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

export const runPoolifierBenchmarkTinyBench = async (
  name,
  workerType,
  poolType,
  poolSize,
  { taskExecutions, workerData }
) => {
  const bmfResults = {}
  let pool
  try {
    const bench = new Bench()
    pool = buildPoolifierPool(workerType, poolType, poolSize)

    for (const workerChoiceStrategy of Object.values(WorkerChoiceStrategies)) {
      for (const enableTasksQueue of [false, true]) {
        if (workerChoiceStrategy === WorkerChoiceStrategies.FAIR_SHARE) {
          for (const measurement of [Measurements.runTime, Measurements.elu]) {
            const taskName = `${name} with ${workerChoiceStrategy}, with ${measurement} and ${
              enableTasksQueue ? 'with' : 'without'
            } tasks queue`

            bench.add(
              taskName,
              async () => {
                await runPoolifierPool(pool, {
                  taskExecutions,
                  workerData,
                })
              },
              {
                beforeAll: () => {
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
          }
        } else {
          const taskName = `${name} with ${workerChoiceStrategy} and ${
            enableTasksQueue ? 'with' : 'without'
          } tasks queue`

          bench.add(
            taskName,
            async () => {
              await runPoolifierPool(pool, {
                taskExecutions,
                workerData,
              })
            },
            {
              beforeAll: () => {
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
        }
      }
    }

    const tasks = await bench.run()
    console.table(bench.table())

    for (const task of tasks) {
      if (
        task.result?.state === 'completed' ||
        task.result?.state === 'aborted-with-statistics'
      ) {
        bmfResults[task.name] = {
          latency: {
            lower_value: task.result.latency.mean - task.result.latency.sd,
            upper_value: task.result.latency.mean + task.result.latency.sd,
            value: task.result.latency.mean,
          },
          throughput: {
            lower_value:
              task.result.throughput.mean - task.result.throughput.sd,
            upper_value:
              task.result.throughput.mean + task.result.throughput.sd,
            value: task.result.throughput.mean,
          },
        }
      }
    }
    return bmfResults
  } catch (error) {
    console.error(error)
    return bmfResults
  } finally {
    if (pool != null) {
      await pool.destroy()
    }
  }
}

export { executeTaskFunction }
