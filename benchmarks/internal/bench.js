const Benchmark = require('benchmark')
const {
  dynamicClusterTest,
  dynamicClusterTestLessRecentlyUsed,
  dynamicClusterTestRandom
} = require('./cluster/dynamic')
const { fixedClusterTest } = require('./cluster/fixed')
const {
  dynamicThreadTest,
  dynamicThreadTestLessRecentlyUsed,
  dynamicThreadTestRandom
} = require('./thread/dynamic')
const { fixedThreadTest } = require('./thread/fixed')

const suite = new Benchmark.Suite('poolifier')

const LIST_FORMATTER = new Intl.ListFormat('en-US', {
  style: 'long',
  type: 'conjunction'
})

// Wait some seconds before start, pools need to load threads !!!
setTimeout(async () => {
  test()
}, 3000)

async function test () {
  // Add tests
  suite
    .add('Poolifier:Static:ThreadPool', async function () {
      await fixedThreadTest()
    })
    .add('Poolifier:Dynamic:ThreadPool', async function () {
      await dynamicThreadTest()
    })
    .add('Poolifier:Dynamic:ThreadPool:LessRecentlyUsed', async function () {
      await dynamicThreadTestLessRecentlyUsed()
    })
    .add('Poolifier:Dynamic:ThreadPool:Random', async function () {
      await dynamicThreadTestRandom()
    })
    .add('Poolifier:Static:ClusterPool', async function () {
      await fixedClusterTest()
    })
    .add('Poolifier:Dynamic:ClusterPool', async function () {
      await dynamicClusterTest()
    })
    .add('Poolifier:Dynamic:ClusterPool:LessRecentlyUsed', async function () {
      await dynamicClusterTestLessRecentlyUsed()
    })
    .add('Poolifier:Dynamic:ClusterPool:Random', async function () {
      await dynamicClusterTestRandom()
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
    .run({ async: true, queued: true })
}
