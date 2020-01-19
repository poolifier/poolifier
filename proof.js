const FixedThreadPool = require('./lib/fixed')
const DynamicThreadPool = require('./lib/dynamic')
let resolved = 0
// const pool = new FixedThreadPool(15, './yourWorker.js')
const pool = new DynamicThreadPool(300, 1020, './yourWorker.js')

const start = Date.now()
const iterations = 300
for (let i = 0; i <= iterations; i++) {
  pool.execute({}).then(res => {
    resolved++
    if (resolved === iterations) {
      console.log('Time take is ' + (Date.now() - start))
    }
  })
}
