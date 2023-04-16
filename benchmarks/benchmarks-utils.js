const crypto = require('crypto')
const fs = require('fs')
const {
  PoolTypes,
  WorkerFunctions,
  WorkerTypes
} = require('./benchmarks-types')
const {
  DynamicClusterPool,
  DynamicThreadPool,
  FixedClusterPool,
  FixedThreadPool
} = require('../lib')

async function runTest (pool, { taskExecutions, workerData }) {
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

function generateRandomInteger (max = Number.MAX_SAFE_INTEGER, min = 0) {
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

function jsonIntegerSerialization (n) {
  for (let i = 0; i < n; i++) {
    const o = {
      a: i
    }
    JSON.stringify(o)
  }
}

/**
 * Intentionally inefficient implementation.
 *
 * @param {number} n - The number of fibonacci numbers to generate.
 * @returns {number} - The nth fibonacci number.
 */
function fibonacci (n) {
  if (n <= 1) return 1
  return fibonacci(n - 1) + fibonacci(n - 2)
}

/**
 * Intentionally inefficient implementation.
 *
 * @param {number} n - The number to calculate the factorial of.
 * @returns {number} - The factorial of n.
 */
function factorial (n) {
  if (n === 0) {
    return 1
  }
  return factorial(n - 1) * n
}

function readWriteFiles (
  n,
  baseDirectory = `/tmp/poolifier-benchmarks/${crypto.randomInt(
    281474976710655
  )}`
) {
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
}

function executeWorkerFunction (data) {
  switch (data.function) {
    case WorkerFunctions.jsonIntegerSerialization:
      return jsonIntegerSerialization(data.taskSize || 1000)
    case WorkerFunctions.fibonacci:
      return fibonacci(data.taskSize || 1000)
    case WorkerFunctions.factorial:
      return factorial(data.taskSize || 1000)
    case WorkerFunctions.readWriteFiles:
      return readWriteFiles(data.taskSize || 1000)
    default:
      throw new Error('Unknown worker function')
  }
}

function buildPool (poolType, poolSize, workerType, poolOptions) {
  switch (poolType) {
    case PoolTypes.FIXED:
      switch (workerType) {
        case WorkerTypes.THREAD:
          return new FixedThreadPool(
            poolSize,
            './benchmarks/internal/thread-worker.js',
            poolOptions
          )
        case WorkerTypes.CLUSTER:
          return new FixedClusterPool(
            poolSize,
            './benchmarks/internal/cluster-worker.js',
            poolOptions
          )
      }
      break
    case PoolTypes.DYNAMIC:
      switch (workerType) {
        case WorkerTypes.THREAD:
          return new DynamicThreadPool(
            poolSize / 2,
            poolSize * 3,
            './benchmarks/internal/thread-worker.js',
            poolOptions
          )
        case WorkerTypes.CLUSTER:
          return new DynamicClusterPool(
            poolSize / 2,
            poolSize * 3,
            './benchmarks/internal/cluster-worker.js',
            poolOptions
          )
      }
      break
  }
}

module.exports = {
  WorkerFunctions,
  buildPool,
  executeWorkerFunction,
  generateRandomInteger,
  readWriteFiles,
  runTest
}
