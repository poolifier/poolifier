const FixedThreadPool = require('../lib/fixed')
const pool = new FixedThreadPool(15,
  './multifunctionWorker.js',
  { errorHandler: (e) => console.error(e), onlineHandler: () => console.log('worker is online') })

pool.execute({ fname: 'fn0', input: 'hello' }).then(res => console.log(res))
pool.execute({ fname: 'fn1', input: 'multifunction' }).then(res => console.log(res))

setTimeout(pool.destroy.bind(pool), 3000)
