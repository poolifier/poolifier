const { DynamicThreadPool } = require('poolifier')
let resolved = 0
let poolFull = 0
let poolBusy = 0
const pool = new DynamicThreadPool(10, 20, './yourWorker.js', {
  errorHandler: e => console.error(e),
  onlineHandler: () => console.log('worker is online')
})
pool.emitter.on('full', () => poolFull++)
pool.emitter.on('busy', () => poolBusy++)

const start = Date.now()
const iterations = 1000
for (let i = 1; i <= iterations; i++) {
  pool
    .execute({})
    .then(() => {
      resolved++
      if (resolved === iterations) {
        console.log('Time taken is ' + (Date.now() - start))
        console.log('The pool was full for ' + poolFull + ' times')
        return console.log('The pool was busy for ' + poolBusy + ' times')
      }
      return null
    })
    .catch(err => console.error(err))
}
