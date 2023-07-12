const { WorkerFunctions } = require('./test-types')

const waitWorkerEvents = async (pool, workerEvent, numberOfEventsToWait) => {
  return new Promise(resolve => {
    let events = 0
    if (numberOfEventsToWait === 0) {
      resolve(events)
    }
    for (const workerNode of pool.workerNodes) {
      workerNode.worker.on(workerEvent, () => {
        ++events
        if (events === numberOfEventsToWait) {
          resolve(events)
        }
      })
    }
  })
}

const waitPoolEvents = async (pool, poolEvent, numberOfEventsToWait) => {
  return new Promise(resolve => {
    let events = 0
    if (numberOfEventsToWait === 0) {
      resolve(events)
    }
    pool?.emitter.on(poolEvent, () => {
      ++events
      if (events === numberOfEventsToWait) {
        resolve(events)
      }
    })
  })
}

const sleep = async ms => {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const sleepWorkerFunction = async (
  data,
  ms,
  rejection = false,
  rejectionMessage = ''
) => {
  return new Promise((resolve, reject) => {
    setTimeout(
      () =>
        rejection === true
          ? reject(new Error(rejectionMessage))
          : resolve(data),
      ms
    )
  })
}

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

const executeWorkerFunction = data => {
  switch (data.function) {
    case WorkerFunctions.jsonIntegerSerialization:
      return jsonIntegerSerialization(data.n || 100)
    case WorkerFunctions.fibonacci:
      return fibonacci(data.n || 25)
    case WorkerFunctions.factorial:
      return factorial(data.n || 100)
    default:
      throw new Error('Unknown worker function')
  }
}

module.exports = {
  executeWorkerFunction,
  factorial,
  fibonacci,
  generateRandomInteger,
  jsonIntegerSerialization,
  sleep,
  sleepWorkerFunction,
  waitPoolEvents,
  waitWorkerEvents
}
