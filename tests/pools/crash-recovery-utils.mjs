export const echoThreadWorkerPath = './tests/worker-files/thread/echoWorker.mjs'

export const collectRejection = (promise, rejections) =>
  promise.catch(error => {
    rejections.push(error)
    return undefined
  })

export const createPoolCleanup = () => {
  const pools = []
  return {
    cleanupPools: async () => {
      let failureSeen = false
      let firstFailure
      while (pools.length > 0) {
        const pool = pools.pop()
        if (pool.info.started) {
          try {
            await pool.destroy()
          } catch (error) {
            if (!failureSeen) {
              firstFailure = error
              failureSeen = true
            }
          }
        }
      }
      if (failureSeen) {
        throw firstFailure
      }
    },
    trackPool: pool => {
      pools.push(pool)
      return pool
    },
  }
}
