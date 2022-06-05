class TestUtils {
  static async waitExits (pool, numberOfExitEventsToWait) {
    let exitEvents = 0
    return new Promise(function (resolve, reject) {
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

  static async sleepWorkerFunction (data, ms) {
    return new Promise((resolve, reject) => {
      setTimeout(() => resolve(data), ms)
    })
  }

  /**
   * Intentionally inefficient implementation.
   *
   * @param {*} n
   * @returns
   */
  static fibonacci (n) {
    if (n <= 1) return 1
    return TestUtils.fibonacci(n - 1) + TestUtils.fibonacci(n - 2)
  }

  /**
   * Intentionally inefficient implementation.
   *
   * @param {*} n
   * @returns
   */
  static factorial (n) {
    if (n === 0) {
      return 1
    } else {
      return TestUtils.factorial(n - 1) * n
    }
  }
}

module.exports = TestUtils
