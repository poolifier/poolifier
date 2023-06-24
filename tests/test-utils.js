const { WorkerFunctions } = require('./test-types')

class TestUtils {
  static async waitWorkerEvents (pool, workerEvent, numberOfEventsToWait) {
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

  static async waitPoolEvents (pool, poolEvent, numberOfEventsToWait) {
    return new Promise(resolve => {
      let events = 0
      if (numberOfEventsToWait === 0) {
        resolve(events)
      }
      pool.emitter.on(poolEvent, () => {
        ++events
        if (events === numberOfEventsToWait) {
          resolve(events)
        }
      })
    })
  }

  static async sleep (ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  static async sleepWorkerFunction (
    data,
    ms,
    rejection = false,
    rejectionMessage = ''
  ) {
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

  static generateRandomInteger (max = Number.MAX_SAFE_INTEGER, min = 0) {
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

  static jsonIntegerSerialization (n) {
    for (let i = 0; i < n; i++) {
      const o = {
        a: i
      }
      JSON.stringify(o)
    }
  }

  /**
   * Intentionally inefficient implementation.
   * @param {number} n - The number of fibonacci numbers to generate.
   * @returns {number} - The nth fibonacci number.
   */
  static fibonacci (n) {
    if (n <= 1) return 1
    return TestUtils.fibonacci(n - 1) + TestUtils.fibonacci(n - 2)
  }

  /**
   * Intentionally inefficient implementation.
   * @param {number} n - The number to calculate the factorial of.
   * @returns {number} - The factorial of n.
   */
  static factorial (n) {
    if (n === 0) {
      return 1
    }
    return TestUtils.factorial(n - 1) * n
  }

  static executeWorkerFunction (data) {
    switch (data.function) {
      case WorkerFunctions.jsonIntegerSerialization:
        return TestUtils.jsonIntegerSerialization(data.n || 100)
      case WorkerFunctions.fibonacci:
        return TestUtils.fibonacci(data.n || 25)
      case WorkerFunctions.factorial:
        return TestUtils.factorial(data.n || 100)
      default:
        throw new Error('Unknown worker function')
    }
  }
}

module.exports = TestUtils
