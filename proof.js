const FixedThreadPool = require('./fixed')
let resolved = 0
const pool = new FixedThreadPool(3, './yourWorker.js')

async function proof () {
  const o = {
    a: 123
  }
  const res = await pool.execute(o)
  // console.log('Here we are')
  console.log('I am logging the result ' + res)
}

// proof()

const start = Date.now()
const iterations = 50000
for (let i = 0; i <= iterations; i++) {
  const o = {
    a: i
  }
  pool.execute(o).then(res => {
    console.log(res)
    resolved++
    if (resolved === iterations) {
      console.log('Time take is ' + (Date.now() - start))
    }
  })
}
