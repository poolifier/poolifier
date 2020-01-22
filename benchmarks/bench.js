const Benchmark = require('benchmark')
const suite = new Benchmark.Suite()
const FixedThreadPool = require('../lib/fixed')
const DynamicThreadPool = require('../lib/dynamic')
const Pool = require('worker-threads-pool')
const size = 30
const tasks = 1

// pools
const externalPool = new Pool({ max: size })
const fixedPool = new FixedThreadPool(size,
  './yourWorker.js', { maxTasks: 10000 })
const dynamicPool = new DynamicThreadPool(size / 2, size * 3, './yourWorker.js', { maxTasks: 10000 })
const workerData = { proof: 'ok' }

// wait some seconds before start, my pools need to load threads !!!
setTimeout(async () => {
  test()
}, 3000)

// fixed pool proof
async function fixedTest () {
  return new Promise((resolve, reject) => {
    let executions = 0
    for (let i = 0; i <= tasks; i++) {
      fixedPool.execute(workerData).then(res => {
        executions++
        if (executions === tasks) {
          resolve('FINISH')
        }
      })
    }
  })
}

async function dynamicTest () {
  return new Promise((resolve, reject) => {
    let executions = 0
    for (let i = 0; i <= tasks; i++) {
      dynamicPool.execute(workerData).then(res => {
        executions++
        if (executions === tasks) {
          resolve('FINISH')
        }
      })
    }
  })
}

async function externalPoolTest () {
  return new Promise((resolve, reject) => {
    let executions = 0
    for (let i = 0; i <= tasks; i++) {
      new Promise((resolve, reject) => {
        externalPool.acquire('./externalWorker.js', { workerData: workerData }, (err, worker) => {
          if (err) {
            return reject(err)
          }
          worker.on('error', reject)
          worker.on('message', res => {
            executions++
            resolve(res)
          })
        })
      }).then(res => {
        if (tasks === executions) {
          resolve('FINISH')
        }
      })
    }
  })
}

async function test () {
  // add tests
  suite.add('PioardiStaticPool', async function () {
    await fixedTest()
  })
    .add('PioardiDynamicPool', async function () {
      await dynamicTest()
    })
    .add('ExternalPool', async function () {
      await externalPoolTest()
    })
  // add listeners
    .on('cycle', function (event) {
      console.log(String(event.target))
    })
    .on('complete', function () {
      this.filter('fastest').map('name')
      console.log('Fastest is ' + this.filter('fastest').map('name'))
    })
  // run async
    .run({ async: true })
}
