const { DynamicThreadPool } = require('poolifier')
let resolved = 0
let maxReached = 0
const pool = new DynamicThreadPool(10, 20, './yourWorker.js', {
  errorHandler: e => console.error(e),
  onlineHandler: () => console.log('worker is online')
})
pool.emitter.on('busy', () => maxReached++)

const start = Date.now()
const iterations = 1000
for (let i = 1; i <= iterations; i++) {
  pool
    .execute({})
    .then(res => {
      resolved++
      if (resolved === iterations) {
        console.log('Time take is ' + (Date.now() - start))
        return console.log('The pool was busy for ' + maxReached + ' times')
      }
      return null
    })
    .catch(err => console.error(err))
}
