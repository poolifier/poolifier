import { strictEqual } from 'node:assert'

import Benchmark from 'benchmark'
import { bench, clear, group, run } from 'mitata'

import {
  DynamicClusterPool,
  DynamicThreadPool,
  FixedClusterPool,
  FixedThreadPool,
  Measurements,
  PoolTypes,
  WorkerChoiceStrategies,
  WorkerTypes
} from '../lib/index.mjs'
import { executeTaskFunction } from './benchmarks-utils.cjs'

const buildPoolifierPool = (workerType, poolType, poolSize, poolOptions) => {
  switch (poolType) {
    case PoolTypes.fixed:
      switch (workerType) {
        case WorkerTypes.thread:
          return new FixedThreadPool(
            poolSize,
            './benchmarks/internal/thread-worker.mjs',
            poolOptions
          )
        case WorkerTypes.cluster:
          return new FixedClusterPool(
            poolSize,
            './benchmarks/internal/cluster-worker.cjs',
            poolOptions
          )
      }
      break
    case PoolTypes.dynamic:
      switch (workerType) {
        case WorkerTypes.thread:
          return new DynamicThreadPool(
            Math.floor(poolSize / 2),
            poolSize,
            './benchmarks/internal/thread-worker.mjs',
            poolOptions
          )
        case WorkerTypes.cluster:
          return new DynamicClusterPool(
            Math.floor(poolSize / 2),
            poolSize,
            './benchmarks/internal/cluster-worker.cjs',
            poolOptions
          )
      }
      break
  }
}

const runPoolifierPool = async (pool, { taskExecutions, workerData }) => {
  return await new Promise((resolve, reject) => {
    let executions = 0
    for (let i = 1; i <= taskExecutions; i++) {
      pool
        .execute(workerData)
        .then(() => {
          ++executions
          if (executions === taskExecutions) {
            resolve({ ok: 1 })
          }
          return undefined
        })
        .catch(err => {
          console.error(err)
          reject(err)
        })
    }
  })
}

export const runPoolifierBenchmarkBenchmarkJs = async (
  name,
  workerType,
  poolType,
  poolSize,
  poolOptions,
  { taskExecutions, workerData }
) => {
  return await new Promise((resolve, reject) => {
    const pool = buildPoolifierPool(workerType, poolType, poolSize, poolOptions)
    let workerChoiceStrategy
    let enableTasksQueue
    let workerChoiceStrategyOptions
    if (poolOptions != null) {
      ({
        workerChoiceStrategy,
        enableTasksQueue,
        workerChoiceStrategyOptions
      } = poolOptions)
    }
    const measurement = workerChoiceStrategyOptions?.measurement
    new Benchmark(
      `${name} with ${workerChoiceStrategy ?? pool.opts.workerChoiceStrategy}${
        measurement != null ? `, with ${measurement}` : ''
      } and ${enableTasksQueue ? 'with' : 'without'} tasks queue`,
      async () => {
        await runPoolifierPool(pool, {
          taskExecutions,
          workerData
        })
      },
      {
        onStart: () => {
          if (workerChoiceStrategy != null) {
            strictEqual(pool.opts.workerChoiceStrategy, workerChoiceStrategy)
          }
          if (enableTasksQueue != null) {
            strictEqual(pool.opts.enableTasksQueue, enableTasksQueue)
          }
          if (measurement != null) {
            strictEqual(
              pool.opts.workerChoiceStrategyOptions.measurement,
              measurement
            )
          }
        },
        onComplete: event => {
          console.info(event.target.toString())
          if (pool.started && !pool.destroying) {
            pool.destroy().then(resolve).catch(reject)
          } else {
            resolve()
          }
        },
        onError: event => {
          if (pool.started && !pool.destroying) {
            pool
              .destroy()
              .then(() => {
                return reject(event.target.error)
              })
              .catch(() => {})
          } else {
            reject(event.target.error)
          }
        }
      }
    ).run({ async: true })
  })
}

export const runPoolifierBenchmarkBenchmarkJsSuite = async (
  name,
  workerType,
  poolType,
  poolSize,
  { taskExecutions, workerData }
) => {
  return await new Promise((resolve, reject) => {
    const pool = buildPoolifierPool(workerType, poolType, poolSize)
    const suite = new Benchmark.Suite(name, {
      onComplete: () => {
        if (pool.started && !pool.destroying) {
          pool.destroy().then(resolve).catch(reject)
        } else {
          resolve()
        }
      },
      onCycle: event => {
        console.info(event.target.toString())
      },
      onError: event => {
        if (pool.started && !pool.destroying) {
          pool
            .destroy()
            .then(() => {
              return reject(event.target.error)
            })
            .catch(() => {})
        } else {
          reject(event.target.error)
        }
      }
    })
    for (const workerChoiceStrategy of Object.values(WorkerChoiceStrategies)) {
      for (const enableTasksQueue of [false, true]) {
        if (workerChoiceStrategy === WorkerChoiceStrategies.FAIR_SHARE) {
          for (const measurement of [Measurements.runTime, Measurements.elu]) {
            suite.add(
              `${name} with ${workerChoiceStrategy}, with ${measurement} and ${
                enableTasksQueue ? 'with' : 'without'
              } tasks queue`,
              async () => {
                await runPoolifierPool(pool, {
                  taskExecutions,
                  workerData
                })
              },
              {
                onStart: () => {
                  pool.setWorkerChoiceStrategy(workerChoiceStrategy, {
                    measurement
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
                }
              }
            )
          }
        } else {
          suite.add(
            `${name} with ${workerChoiceStrategy} and ${
              enableTasksQueue ? 'with' : 'without'
            } tasks queue`,
            async () => {
              await runPoolifierPool(pool, {
                taskExecutions,
                workerData
              })
            },
            {
              onStart: () => {
                pool.setWorkerChoiceStrategy(workerChoiceStrategy)
                pool.enableTasksQueue(enableTasksQueue)
                strictEqual(
                  pool.opts.workerChoiceStrategy,
                  workerChoiceStrategy
                )
                strictEqual(pool.opts.enableTasksQueue, enableTasksQueue)
              }
            }
          )
        }
      }
    }
    suite
      .on('complete', function () {
        console.info(
          'Fastest is ' +
            LIST_FORMATTER.format(this.filter('fastest').map('name'))
        )
      })
      .run({ async: true })
  })
}

export const runPoolifierBenchmarkMitata = async (
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
                  pool.setWorkerChoiceStrategy(workerChoiceStrategy, {
                    measurement
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
                  await runPoolifierPool(pool, {
                    taskExecutions,
                    workerData
                  })
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
                pool.setWorkerChoiceStrategy(workerChoiceStrategy)
                pool.enableTasksQueue(enableTasksQueue)
                strictEqual(
                  pool.opts.workerChoiceStrategy,
                  workerChoiceStrategy
                )
                strictEqual(pool.opts.enableTasksQueue, enableTasksQueue)
                await runPoolifierPool(pool, {
                  taskExecutions,
                  workerData
                })
              }
            )
          })
        }
      }
    }
    await run()
    await pool.destroy()
    clear()
  } catch (error) {
    console.error(error)
  }
}

const LIST_FORMATTER = new Intl.ListFormat('en-US', {
  style: 'long',
  type: 'conjunction'
})

export { executeTaskFunction }
