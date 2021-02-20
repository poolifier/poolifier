const Benchmark = require('benchmark')
const suite = new Benchmark.Suite()
const { performance } = require('performance_hooks')
const size = 30

// IMPORT LIBRARIES
const { FixedThreadPool, DynamicThreadPool } = require('poolifier')
const { DynamicPool, StaticPool } = require('node-worker-threads-pool')

// FINISH IMPORT LIBRARIES

// IMPORT FUNCTION TO BENCH
const jsonStringify = require('./functions/jsonstringify')
// FINISH IMPORT FUNCTION TO BENCH
const LIST_FORMATTER = new Intl.ListFormat('en-US', {
  style: 'long',
  type: 'conjunction'
})

// PREPARING POOLS FOR EACH LIBRARY TO
// Poolifier pools
const dynamicPool = new DynamicThreadPool(
  size / 2,
  size * 3,
  './workers/poolifier/json-stringify.worker.js',
  {
    maxTasks: 10000
  }
)
const fixedPool = new FixedThreadPool(
  size / 2,
  './workers/poolifier/json-stringify.worker.js',
  {
    maxTasks: 10000
  }
)
// End poolifier pools
// Start node-worker-threads-pool
// this library create new workers without any limit on the number of workers into the pool in my understanding.
// the value specified here is the number of initial workers.
const nodeWorkerThreadDynamicPool = new DynamicPool(size / 2)
console.log(typeof jsonStringify)
const nodeWorkerThreadStaticPool = new StaticPool({
  size: size / 2,
  task: jsonStringify
})

// FINISH POOLS FOR EACH LIBRARY TO

const data = { test: 'bench' }

async function run () {
  // check
  console.log('start run')
  const i2 = performance.now()
  await nodeWorkerThreadStaticPool.exec(data)
  console.log('FIXED sumsd TOOK: ' + (performance.now() - i2))
  const i1 = performance.now()
  await fixedPool.execute(data)
  console.log('FIXED POOLIFIER TOOK: ' + (performance.now() - i1))
}

function runSuite () {
  // HERE START THE BENCHMARK SUITE
  suite
    .add('Pioardi:Static:ThreadPool', async function () {
      await fixedPool.execute(data)
    })
    .add('Pioardi:Dynamic:ThreadPool', async function () {
      await dynamicPool.execute(data)
    })
    .add('SUCHMOKUO:Dynamic:node-worker-threads-pool', async function () {
      await nodeWorkerThreadDynamicPool.exec({
        task: jsonStringify,
        param: data,
        workerData: data
      })
    })
    .add('SUCHMOKUO:Static:node-worker-threads-pool', async function () {
      await nodeWorkerThreadStaticPool.exec(data)
    })
    // Add listeners
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
    .run({ async: true })
}

setTimeout(() => {
  runSuite()
}, 1000 * 30)
