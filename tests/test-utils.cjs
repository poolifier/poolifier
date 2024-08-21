const { TaskFunctions } = require('./test-types.cjs')

const waitWorkerEvents = async (pool, workerEvent, numberOfEventsToWait) => {
  return await new Promise(resolve => {
    let events = 0
    if (numberOfEventsToWait === 0) {
      resolve(events)
      return
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
  return await new Promise(resolve => {
    let events = 0
    if (numberOfEventsToWait === 0) {
      resolve(events)
      return
    }
    pool.emitter?.on(poolEvent, () => {
      ++events
      if (events === numberOfEventsToWait) {
        resolve(events)
      }
    })
  })
}

const sleep = async ms => {
  return await new Promise(resolve => setTimeout(resolve, ms))
}

const sleepTaskFunction = async (
  data,
  ms,
  rejection = false,
  rejectionMessage = ''
) => {
  return await new Promise((resolve, reject) => {
    setTimeout(
      () =>
        rejection === true
          ? reject(new Error(rejectionMessage))
          : resolve(data),
      ms
    )
  })
}

const jsonIntegerSerialization = n => {
  for (let i = 0; i < n; i++) {
    const o = {
      a: i,
    }
    JSON.stringify(o)
  }
  return { ok: 1 }
}

/**
 * @param n - The number of fibonacci numbers to generate.
 * @returns - The nth fibonacci number.
 */
const fibonacci = n => {
  let current = 1
  let previous = 0
  while (--n) {
    const tmp = current
    current += previous
    previous = tmp
  }
  return current
}

/**
 * @param n - The number to calculate the factorial of.
 * @returns - The factorial of n.
 */
const factorial = n => {
  if (n === 0 || n === 1) {
    return 1
  } else {
    let factorial = 1
    for (let i = 1; i <= n; i++) {
      factorial *= i
    }
    return factorial
  }
}

const executeTaskFunction = data => {
  switch (data.function) {
    case TaskFunctions.factorial:
      return factorial(data.n || 100)
    case TaskFunctions.fibonacci:
      return fibonacci(data.n || 100)
    case TaskFunctions.jsonIntegerSerialization:
      return jsonIntegerSerialization(data.n || 100)
    default:
      throw new Error('Unknown worker function')
  }
}

module.exports = {
  executeTaskFunction,
  factorial,
  fibonacci,
  jsonIntegerSerialization,
  sleep,
  sleepTaskFunction,
  waitPoolEvents,
  waitWorkerEvents,
}
