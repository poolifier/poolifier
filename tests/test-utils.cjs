const { TaskFunctions } = require('./test-types.cjs')

const waitWorkerEvents = async (
  pool,
  workerEvent,
  numberOfEventsToWait,
  timeoutMs = 5000
) => {
  return await new Promise((resolve, reject) => {
    let events = 0
    if (numberOfEventsToWait === 0) {
      resolve(events)
      return
    }
    const listeners = []
    const timeout = setTimeout(() => {
      listeners.forEach(({ listener, workerNode }) => {
        workerNode.worker.off(workerEvent, listener)
      })
      reject(
        new Error(
          `Timed out after ${timeoutMs.toString()}ms waiting for ${numberOfEventsToWait.toString()} '${workerEvent}' events. Received ${events.toString()} events`
        )
      )
    }, timeoutMs)
    const listener = () => {
      events++
      if (events === numberOfEventsToWait) {
        clearTimeout(timeout)
        listeners.forEach(({ listener, workerNode }) => {
          workerNode.worker.off(workerEvent, listener)
        })
        resolve(events)
      }
    }
    for (const workerNode of pool.workerNodes) {
      listeners.push({ listener, workerNode })
      workerNode.worker.on(workerEvent, listener)
    }
  })
}

const waitPoolEvents = async (
  pool,
  poolEvent,
  numberOfEventsToWait,
  timeoutMs = 5000
) => {
  const eventPromises = []
  const eventPromise = (eventEmitter, event, timeoutMs = 5000) => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        eventEmitter.off(event, listener)
        reject(new Error(`Event '${event}' timed out after ${timeoutMs}ms`))
      }, timeoutMs)

      const listener = evt => {
        clearTimeout(timeout)
        eventEmitter.off(event, listener)
        resolve(evt)
      }

      eventEmitter.on(event, listener)
    })
  }
  for (let i = 0; i < numberOfEventsToWait; i++) {
    eventPromises.push(eventPromise(pool.emitter, poolEvent, timeoutMs))
  }
  return await Promise.all(eventPromises)
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
  if (n === 0) {
    return 0
  }
  if (n === 1) {
    return 1
  }
  let current = 1
  let previous = 0
  while (n-- > 1) {
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
  }
  let factorial = 1
  for (let i = 1; i <= n; i++) {
    factorial *= i
  }
  return factorial
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
