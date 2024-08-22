'use strict'
const {
  availableParallelism,
  FixedThreadPool,
  PoolEvents,
} = require('poolifier')

const pool = new FixedThreadPool(availableParallelism(), './yourWorker.cjs', {
  errorHandler: e => console.error(e),
  onlineHandler: () => console.info('worker is online'),
})
let poolReady = 0
let poolBusy = 0
pool.emitter?.on(PoolEvents.ready, () => poolReady++)
pool.emitter?.on(PoolEvents.busy, () => poolBusy++)

let resolved = 0
const start = performance.now()
const iterations = 1000
for (let i = 1; i <= iterations; i++) {
  pool
    .execute()
    .then(() => {
      resolved++
      if (resolved === iterations) {
        console.info(
          `Time taken is ${(performance.now() - start).toFixed(2)}ms`
        )
        console.info(`The pool was ready for ${poolReady} times`)
        console.info(`The pool was busy for ${poolBusy} times`)
        return pool.destroy()
      }
      return undefined
    })
    .catch(err => console.error(err))
}
