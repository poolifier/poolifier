const Benchmark = require('benchmark')
const suite = new Benchmark.Suite()
const { FixedThreadPool } = require('../lib/index')
const { DynamicThreadPool } = require('../lib/index')
const size = 30
const tasks = 1

const LIST_FORMATTER = new Intl.ListFormat('en-US', {
  style: 'long',
  type: 'conjunction'
})

// pools
const fixedPool = new FixedThreadPool(size, './threadWorker.js', {
  maxTasks: 10000
})
const dynamicPool = new DynamicThreadPool(
  size / 2,
  size * 3,
  './threadWorker.js',
  { maxTasks: 10000 }
)
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
      fixedPool
        .execute(workerData)
        .then(res => {
          executions++
          if (executions === tasks) {
            return resolve('FINISH')
          }
          return null
        })
        .catch(err => {
          console.error(err)
        })
    }
  })
}

async function dynamicTest () {
  return new Promise((resolve, reject) => {
    let executions = 0
    for (let i = 0; i <= tasks; i++) {
      dynamicPool
        .execute(workerData)
        .then(res => {
          executions++
          if (executions === tasks) {
            return resolve('FINISH')
          }
          return null
        })
        .catch(err => console.error(err))
    }
  })
}

async function test () {
  // add tests
  suite
    .add('PioardiStaticPool', async function () {
      await fixedTest()
    })
    .add('PioardiDynamicPool', async function () {
      await dynamicTest()
    })
    // add listeners
    .on('cycle', function (event) {
      console.log(event.target.toString())
    })
    .on('complete', function () {
      console.log(
        'Fastest is ' +
          LIST_FORMATTER.format(this.filter('fastest').map('name'))
      )
      // eslint-disable-next-line no-process-exit
      process.exit()
    })
    // run async
    .run({ async: true })
}
