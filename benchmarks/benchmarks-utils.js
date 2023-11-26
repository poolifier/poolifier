const crypto = require('node:crypto')
const assert = require('node:assert')
const fs = require('node:fs')
const Benchmark = require('benchmark')
const {
  DynamicClusterPool,
  DynamicThreadPool,
  FixedClusterPool,
  FixedThreadPool,
  Measurements,
  PoolTypes,
  WorkerChoiceStrategies,
  WorkerTypes
} = require('../lib/index.js')
const { TaskFunctions } = require('./benchmarks-types.js')

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
            './benchmarks/internal/cluster-worker.js',
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
            './benchmarks/internal/cluster-worker.js',
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

const runPoolifierPoolBenchmark = async (
  name,
  workerType,
  poolType,
  poolSize,
  { taskExecutions, workerData }
) => {
  return await new Promise((resolve, reject) => {
    const pool = buildPoolifierPool(workerType, poolType, poolSize)
    const suite = new Benchmark.Suite(name)
    try {
      for (const workerChoiceStrategy of Object.values(
        WorkerChoiceStrategies
      )) {
        for (const enableTasksQueue of [false, true]) {
          if (workerChoiceStrategy === WorkerChoiceStrategies.FAIR_SHARE) {
            for (const measurement of [
              Measurements.runTime,
              Measurements.elu
            ]) {
              suite.add(
                `${name} with ${workerChoiceStrategy}, with ${measurement} and ${
                  enableTasksQueue ? 'with' : 'without'
                } tasks queue`,
                async () => {
                  pool.setWorkerChoiceStrategy(workerChoiceStrategy, {
                    measurement
                  })
                  pool.enableTasksQueue(enableTasksQueue)
                  assert.strictEqual(
                    pool.opts.workerChoiceStrategy,
                    workerChoiceStrategy
                  )
                  assert.strictEqual(
                    pool.opts.enableTasksQueue,
                    enableTasksQueue
                  )
                  assert.strictEqual(
                    pool.opts.workerChoiceStrategyOptions.measurement,
                    measurement
                  )
                  await runPoolifierPool(pool, {
                    taskExecutions,
                    workerData
                  })
                }
              )
            }
          } else {
            suite.add(
              `${name} with ${workerChoiceStrategy} and ${
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
                await runPoolifierPool(pool, {
                  taskExecutions,
                  workerData
                })
              }
            )
          }
        }
      }
      suite
        .on('cycle', event => {
          console.info(event.target.toString())
        })
        .on('complete', function () {
          console.info(
            'Fastest is ' +
              LIST_FORMATTER.format(this.filter('fastest').map('name'))
          )
          // FIXME: destroy() hangs
          const destroyTimeout = setTimeout(() => {
            resolve()
            clearTimeout(destroyTimeout)
          }, 30000)
          pool
            .destroy()
            .then(resolve)
            .catch(reject)
            .finally(() => {
              clearTimeout(destroyTimeout)
            })
            .catch(() => {})
        })
        .run({ async: true })
    } catch (error) {
      pool
        .destroy()
        .then(() => {
          return reject(error)
        })
        .catch(() => {})
    }
  })
}

const LIST_FORMATTER = new Intl.ListFormat('en-US', {
  style: 'long',
  type: 'conjunction'
})

const generateRandomInteger = (max = Number.MAX_SAFE_INTEGER, min = 0) => {
  if (max < min || max < 0 || min < 0) {
    throw new RangeError('Invalid interval')
  }
  max = Math.floor(max)
  if (min != null && min !== 0) {
    min = Math.ceil(min)
    return Math.floor(Math.random() * (max - min + 1)) + min
  }
  return Math.floor(Math.random() * (max + 1))
}

const jsonIntegerSerialization = n => {
  for (let i = 0; i < n; i++) {
    const o = {
      a: i
    }
    JSON.stringify(o)
  }
  return { ok: 1 }
}

/**
 * Intentionally inefficient implementation.
 * @param {number} n - The number of fibonacci numbers to generate.
 * @returns {number} - The nth fibonacci number.
 */
const fibonacci = n => {
  if (n <= 1) return n
  return fibonacci(n - 1) + fibonacci(n - 2)
}

/**
 * Intentionally inefficient implementation.
 * @param {number} n - The number to calculate the factorial of.
 * @returns {number} - The factorial of n.
 */
const factorial = n => {
  if (n === 0) {
    return 1
  }
  return factorial(n - 1) * n
}

const readWriteFiles = (
  n,
  baseDirectory = `/tmp/poolifier-benchmarks/${crypto.randomInt(
    281474976710655
  )}`
) => {
  if (fs.existsSync(baseDirectory) === true) {
    fs.rmSync(baseDirectory, { recursive: true })
  }
  fs.mkdirSync(baseDirectory, { recursive: true })
  for (let i = 0; i < n; i++) {
    const filePath = `${baseDirectory}/${i}`
    fs.writeFileSync(filePath, i.toString(), {
      encoding: 'utf8',
      flag: 'a'
    })
    fs.readFileSync(filePath, 'utf8')
  }
  fs.rmSync(baseDirectory, { recursive: true })
  return { ok: 1 }
}

const executeTaskFunction = data => {
  switch (data.function) {
    case TaskFunctions.jsonIntegerSerialization:
      return jsonIntegerSerialization(data.taskSize || 1000)
    case TaskFunctions.fibonacci:
      return fibonacci(data.taskSize || 1000)
    case TaskFunctions.factorial:
      return factorial(data.taskSize || 1000)
    case TaskFunctions.readWriteFiles:
      return readWriteFiles(data.taskSize || 1000)
    default:
      throw new Error('Unknown task function')
  }
}

module.exports = {
  LIST_FORMATTER,
  executeTaskFunction,
  generateRandomInteger,
  runPoolifierPoolBenchmark
}
