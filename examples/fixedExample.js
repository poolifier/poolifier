const { FixedThreadPool } = require('poolifier')
let resolved = 0
const pool = new FixedThreadPool(15, './yourWorker.js', {
  errorHandler: e => console.error(e),
  onlineHandler: () => console.log('worker is online')
})

const start = Date.now()
const iterations = 1000
for (let i = 1; i <= iterations; i++) {
  pool
    .execute({})
    .then(res => {
      resolved++
      if (resolved === iterations) {
        return console.log('Time take is ' + (Date.now() - start))
      }
      return null
    })
    .catch(err => console.error(err))
}
