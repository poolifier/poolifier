const { FixedThreadPool, PoolEvents } = require('poolifier')
let resolved = 0
let poolBusy = 0
const pool = new FixedThreadPool(15, './yourWorker.js', {
  errorHandler: e => console.error(e),
  onlineHandler: () => console.info('worker is online')
})
pool.emitter.on(PoolEvents.busy, () => poolBusy++)

const start = performance.now()
const iterations = 1000
for (let i = 1; i <= iterations; i++) {
  pool
    .execute({})
    .then(() => {
      resolved++
      if (resolved === iterations) {
        console.info('Time taken is ' + (performance.now() - start))
        return console.info('The pool was busy for ' + poolBusy + ' times')
      }
      return null
    })
    .catch(err => console.error(err))
}
