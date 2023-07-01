const {
  DynamicThreadPool,
  PoolEvents,
  availableParallelism
} = require('poolifier')

const pool = new DynamicThreadPool(
  availableParallelism() / 2,
  availableParallelism(),
  './yourWorker.js',
  {
    errorHandler: e => console.error(e),
    onlineHandler: () => console.info('worker is online')
  }
)
let poolFull = 0
let poolBusy = 0
pool.emitter.on(PoolEvents.full, () => poolFull++)
pool.emitter.on(PoolEvents.busy, () => poolBusy++)

let resolved = 0
const start = performance.now()
const iterations = 1000
for (let i = 1; i <= iterations; i++) {
  pool
    .execute({})
    .then(() => {
      resolved++
      if (resolved === iterations) {
        console.info('Time taken is ' + (performance.now() - start))
        console.info('The pool was full for ' + poolFull + ' times')
        return console.info('The pool was busy for ' + poolBusy + ' times')
      }
      return null
    })
    .catch(err => console.error(err))
}
