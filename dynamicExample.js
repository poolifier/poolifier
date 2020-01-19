const DynamicThreadPool = require('./lib/dynamic')
let resolved = 0
let maxReached = 0
const pool = new DynamicThreadPool(100, 200, './yourWorker.js', { errorHandler: (e) => console.error(e), onlineHandler: () => console.log('worker is online') })
pool.emitter.on('FullPool', () => maxReached++)

const start = Date.now()
const iterations = 1000
for (let i = 0; i <= iterations; i++) {
  pool.execute({}).then(res => {
    resolved++
    if (resolved === iterations) {
      console.log('Time take is ' + (Date.now() - start))
      console.log('The pool was full for ' + maxReached + ' times')
    }
  })
}
