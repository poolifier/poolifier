import { availableParallelism, FixedThreadPool } from 'poolifier'

const pool = new FixedThreadPool(
  availableParallelism(),
  './multiFunctionWorker.mjs',
  {
    errorHandler: e => console.error(e),
    onlineHandler: () => console.info('worker is online'),
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
