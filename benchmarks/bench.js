const Benchmark = require('benchmark')
const suite = new Benchmark.Suite()
const FixedThreadPool = require('../lib/fixed')
const DynamicThreadPool = require('../lib/dynamic')
const Pool = require('worker-threads-pool')
const size = 40
const externalPool = new Pool({ max: size })

const fixedPool = new FixedThreadPool(size,
  './yourWorker.js', { maxTasks: 10000 })
const dynamicPool = new DynamicThreadPool(size, size * 2, './yourWorker.js', { maxTasks: 10000 })
const workerData = { proof: 'ok' }
let executions = 0
let executions1 = 0

// wait some seconds before start, my pools need to load threads !!!
setTimeout(async () => {
  test()
}, 3000)

async function test () {
  // add tests
  suite.add('PioardiStaticPool', async function () {
    executions++
    await fixedPool.execute(workerData)
  })

    .add('ExternalPool', async function () {
      await new Promise((resolve, reject) => {
        externalPool.acquire('./externalWorker.js', { workerData: workerData }, (err, worker) => {
          if (err) {
            return reject(err)
          }
          executions1++
          worker.on('error', reject)
          worker.on('message', res => {
            resolve(res)
          })
        })
      })
    })
    .add('PioardiDynamicPool', async function () {
      await dynamicPool.execute(workerData)
    })
  // add listeners
    .on('cycle', function (event) {
      console.log(String(event.target))
    })
    .on('complete', function () {
      console.log(executions)
      console.log(executions1)
      this.filter('fastest').map('name')
      console.log('Fastest is ' + this.filter('fastest').map('name'))
    })
  // run async
    .run({ async: true })
}
