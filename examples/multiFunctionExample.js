const { FixedThreadPool } = require('poolifier')
const pool = new FixedThreadPool(15, './multiFunctionWorker.js', {
  errorHandler: e => console.error(e),
  onlineHandler: () => console.log('worker is online')
})

pool
  .execute({ functionName: 'fn0', input: 'hello' })
  .then(res => console.log(res))
  .catch(err => console.error(err))
pool
  .execute({ functionName: 'fn1', input: 'multiple functions' })
  .then(res => console.log(res))
  .catch(err => console.error(err))

setTimeout(pool.destroy.bind(pool), 3000)
