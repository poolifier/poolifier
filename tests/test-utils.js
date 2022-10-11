const { WorkerFunctions } = require('./test-types')

class TestUtils {
  static async waitExits (pool, numberOfExitEventsToWait) {
    let exitEvents = 0
    return new Promise(resolve => {
      pool.workers.forEach(w => {
        w.on('exit', () => {
          exitEvents++
          if (exitEvents === numberOfExitEventsToWait) {
            resolve(exitEvents)
          }
        })
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
   *
   * @param {number} n - The number of fibonacci numbers to generate.
   * @returns {number} - The nth fibonacci number.
   */
  static fibonacci (n) {
    if (n <= 1) return 1
    return TestUtils.fibonacci(n - 1) + TestUtils.fibonacci(n - 2)
  }

  /**
   * Intentionally inefficient implementation.
   *
   * @param {number} n - The number to calculate the factorial of.
   * @returns {number} - The factorial of n.
   */
  static factorial (n) {
    if (n === 0) {
      return 1
    } else {
      return TestUtils.factorial(n - 1) * n
    }
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
