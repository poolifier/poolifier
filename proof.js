const FixedThreadPool = require('./fixed')
let resolved = 0

const pool = new FixedThreadPool(10)

const start = Date.now()
const iterations = 100000

for (let i = 0; i <= iterations; i++) {
  const o = {
    a: i
  }
  pool.execute(JSON.stringify, o).then(res => {
    console.log(res)
    resolved++
    if (resolved === iterations) {
      console.log('Time take is ' + (Date.now() - start))
    }
  })
}
