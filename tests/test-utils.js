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
}

module.exports = TestUtils
