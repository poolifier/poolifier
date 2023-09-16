import crypto from 'node:crypto'
import fs from 'node:fs'
import {
  DynamicClusterPool,
  DynamicThreadPool,
  FixedClusterPool,
  FixedThreadPool,
  PoolTypes,
  WorkerTypes
} from '../lib/index.mjs'
import { TaskFunctions } from './benchmarks-types.mjs'

export const buildPoolifierPool = (
  workerType,
  poolType,
  poolSize,
  poolOptions
) => {
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
            './benchmarks/internal/cluster-worker.mjs',
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
            './benchmarks/internal/cluster-worker.mjs',
            poolOptions
          )
      }
      break
  }
}

export const runPoolifierTest = async (
  pool,
  { taskExecutions, workerData }
) => {
  return new Promise((resolve, reject) => {
    let executions = 0
    for (let i = 1; i <= taskExecutions; i++) {
      pool
        .execute(workerData)
        .then(() => {
          ++executions
          if (executions === taskExecutions) {
            return resolve({ ok: 1 })
          }
          return null
        })
        .catch(err => {
          console.error(err)
          return reject(err)
        })
    }
  })
}

export const LIST_FORMATTER = new Intl.ListFormat('en-US', {
  style: 'long',
  type: 'conjunction'
})

export const executeAsyncFn = async fn => {
  try {
    await fn()
  } catch (e) {
    console.error(e)
    // eslint-disable-next-line n/no-process-exit
    process.exit(1)
  }
}

export const generateRandomInteger = (
  max = Number.MAX_SAFE_INTEGER,
  min = 0
) => {
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

export const executeTaskFunction = data => {
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
