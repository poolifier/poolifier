'use strict'
const { FixedThreadPool, availableParallelism } = require('poolifier')

const pool = new FixedThreadPool(
  availableParallelism(),
  './multiFunctionWorker.cjs',
  {
    onlineHandler: () => console.info('worker is online'),
    errorHandler: e => console.error(e),
  }
)

pool
  .execute({ text: 'hello' }, 'fn0')
  .then(res => console.info(res))
  .catch(err => console.error(err))
pool
  .execute({ text: 'multiple functions' }, 'fn1')
  .then(res => console.info(res))
  .catch(err => console.error(err))

setTimeout(async () => await pool.destroy(), 3000)
