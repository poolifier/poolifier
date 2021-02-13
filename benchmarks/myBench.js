const { FixedThreadPool } = require('../lib/index')
const { DynamicThreadPool } = require('../lib/index')
const WorkerThreadsPool = require('worker-threads-pool')
const workerpool = require('workerpool')
const tasks = 1000
const size = 16

// pools
const workerThreadsPool = new WorkerThreadsPool({ max: size })
const workerPool = workerpool.pool('./external/workerpoolWorker.js', {
  minWorkers: size / 2,
  maxWorkers: size * 3,
  workerType: 'thread'
})
const fixedPool = new FixedThreadPool(size, './thread/worker.js', {
  maxTasks: 10000
})
const dynamicPool = new DynamicThreadPool(
  size / 2,
  size * 3,
  './thread/worker.js',
  { maxTasks: 10000 }
)

// data
const workerData = { proof: 'ok' }

// fixed pool proof
async function fixedTest () {
  let executions = 0
  const time = Date.now()
  for (let i = 0; i <= tasks; i++) {
    fixedPool
      .execute(workerData)
      .then(res => {
        executions++
        if (executions === tasks) {
          return console.log(
            `Fixed pool take ${
              Date.now() - time
            }ms to work on ${executions} tasks`
          )
        }
        return null
      })
      .catch(err => console.error(err))
  }
}

async function dynamicTest () {
  let executions = 0
  const time = Date.now()
  for (let i = 0; i <= tasks; i++) {
    dynamicPool
      .execute(workerData)
      .then(res => {
        executions++
        if (executions === tasks) {
          return console.log(
            `Dynamic pool take ${
              Date.now() - time
            }ms to work on ${executions} tasks`
          )
        }
        return null
      })
      .catch(err => console.error(err))
  }
}

async function workerThreadsPoolTest () {
  let executions = 0
  const time = Date.now()
  for (let i = 0; i <= tasks; i++) {
    new Promise((resolve, reject) => {
      workerThreadsPool.acquire(
        './external/workerThreadsWorker.js',
        { workerData: workerData },
        (err, worker) => {
          if (err) {
            return reject(err)
          }
          worker.on('error', reject)
          worker.on('message', res => {
            executions++
            resolve(res)
          })
        }
      )
    })
      .then(res => {
        if (tasks === executions) {
          return console.log(
            `worker threads pool take ${
              Date.now() - time
            }ms to work on ${executions} tasks`
          )
        }
        return null
      })
      .catch(err => console.error(err))
  }
}

async function workerpoolTest () {
  let executions = 0
  const time = Date.now()
  for (let i = 0; i <= tasks; i++) {
    workerPool
      .exec('yourFunction', [workerData])
      .then(res => {
        executions++
        if (tasks === executions) {
          return console.log(
            `workerpool take ${
              Date.now() - time
            }ms to work on ${executions} tasks`
          )
        }
        return null
      })
      .catch(err => console.error(err))
  }
}

async function test () {
  await fixedTest()
  await dynamicTest()
  await workerThreadsPoolTest()
  await workerpoolTest()
}

test()
