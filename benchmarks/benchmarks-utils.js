const { WorkerFunctions } = require('./benchmarks-types')

async function runPoolifierTest (pool, { tasks, workerData }) {
  return new Promise((resolve, reject) => {
    let executions = 0
    for (let i = 1; i <= tasks; i++) {
      pool
        .execute(workerData)
        .then(() => {
          executions++
          if (executions === tasks) {
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

function jsonIntegerSerialization (n) {
  for (let i = 0; i < n; i++) {
    const o = {
      a: i
    }
    JSON.stringify(o)
  }
}

function generateRandomInteger (max = Number.MAX_SAFE_INTEGER, min = 0) {
  if (max < 0) {
    throw new RangeError('Invalid interval')
  }
  max = Math.floor(max)
  if (min != null && min !== 0) {
    if (max < min || min < 0) {
      throw new RangeError('Invalid interval')
    }
    min = Math.ceil(min)
    return Math.floor(Math.random() * (max - min + 1)) + min
  }
  return Math.floor(Math.random() * (max + 1))
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
  } else {
    return factorial(n - 1) * n
  }
}

function executeWorkerFunction (data) {
  switch (data.function) {
    case WorkerFunctions.jsonIntegerSerialization:
      return jsonIntegerSerialization(data.taskSize || 1000)
    case WorkerFunctions.fibonacci:
      return fibonacci(data.taskSize || 1000)
    case WorkerFunctions.factorial:
      return factorial(data.taskSize || 1000)
    default:
      throw new Error('Unknown worker function')
  }
}

module.exports = {
  WorkerFunctions,
  executeWorkerFunction,
  generateRandomInteger,
  runPoolifierTest
}
