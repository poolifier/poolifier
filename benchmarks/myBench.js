const FixedThreadPool = require('../lib/fixed')
const DynamicThreadPool = require('../lib/dynamic')
const Pool = require('worker-threads-pool')
const tasks = 1000
const size = 10

// pools
const externalPool = new Pool({ max: size })
const fixedPool = new FixedThreadPool(size, './yourWorker.js', { maxTasks: 10000 })
const dynamicPool = new DynamicThreadPool(size, size * 2, './yourWorker.js', { maxTasks: 10000 })

// data
const workerData = { proof: 'ok' }

// fixed pool proof
async function fixedTest () {
  let executions = 0
  const time = Date.now()
  for (let i = 0; i < tasks; i++) {
    await fixedPool.execute(workerData)
    executions++
  }
  console.log(`Fixed pool take ${Date.now() - time} to work on ${executions} tasks`)
}

async function dynamicTest () {
  let executions = 0
  const time = Date.now()
  for (let i = 0; i < tasks; i++) {
    await dynamicPool.execute(workerData)
    executions++
  }
  console.log(`Dynamic pool take ${Date.now() - time} to work on ${executions} tasks`)
}

async function externalPoolTest () {
  let executions = 0
  const time = Date.now()
  for (let i = 0; i < tasks; i++) {
    await new Promise((resolve, reject) => {
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
    })
  }
  console.log(`External pool take ${Date.now() - time} to work  on ${executions} tasks`)
}

async function test () {
  await fixedTest()
  await dynamicTest()
  await externalPoolTest()
}

test()
