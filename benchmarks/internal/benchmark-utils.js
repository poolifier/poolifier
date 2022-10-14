const WorkerFunctions = {
  jsonIntegerSerialization: 'jsonIntegerSerialization',
  fibonacci: 'fibonacci',
  factorial: 'factorial'
}

async function runPoolifierTest (pool, { tasks, workerData }) {
  return new Promise((resolve, reject) => {
    let executions = 0
    for (let i = 1; i <= tasks; i++) {
      pool
        .execute(workerData)
        .then(res => {
          executions++
          if (executions === tasks) {
            return resolve('FINISH')
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
  max = Math.floor(max)
  if (min) {
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
      return jsonIntegerSerialization(data.n || 1000)
    case WorkerFunctions.fibonacci:
      return fibonacci(data.n || 50)
    case WorkerFunctions.factorial:
      return factorial(data.n || 1000)
    default:
      throw new Error('Unknown worker function')
  }
}

const LIST_FORMATTER = new Intl.ListFormat('en-US', {
  style: 'long',
  type: 'conjunction'
})

module.exports = {
  LIST_FORMATTER,
  WorkerFunctions,
  executeWorkerFunction,
  generateRandomInteger,
  runPoolifierTest
}
