const Benchmark = require('benchmark')
const {
  dynamicClusterTest,
  dynamicClusterTestLessRecentlyUsed
} = require('./cluster/dynamic')
const {
  fixedClusterTest,
  fixedClusterTestLessRecentlyUsed
} = require('./cluster/fixed')
const {
  dynamicThreadTest,
  dynamicThreadTestLessRecentlyUsed
} = require('./thread/dynamic')
const {
  fixedThreadTest,
  fixedThreadTestLessRecentlyUsed
} = require('./thread/fixed')
const { LIST_FORMATTER } = require('./benchmark-utils')

const suite = new Benchmark.Suite('poolifier')

// Wait some seconds before start, pools need to load threads !!!
setTimeout(async () => {
  test()
}, 3000)

async function test () {
  // Add tests
  suite
    .add('Poolifier:Fixed:ThreadPool', async function () {
      await fixedThreadTest()
    })
    .add('Poolifier:Fixed:ThreadPool:LessRecentlyUsed', async function () {
      await fixedThreadTestLessRecentlyUsed()
    })
    .add('Poolifier:Dynamic:ThreadPool', async function () {
      await dynamicThreadTest()
    })
    .add('Poolifier:Dynamic:ThreadPool:LessRecentlyUsed', async function () {
      await dynamicThreadTestLessRecentlyUsed()
    })
    .add('Poolifier:Fixed:ClusterPool', async function () {
      await fixedClusterTest()
    })
    .add('Poolifier:Fixed:ClusterPool:LessRecentlyUsed', async function () {
      await fixedClusterTestLessRecentlyUsed()
    })
    .add('Poolifier:Dynamic:ClusterPool', async function () {
      await dynamicClusterTest()
    })
    .add('Poolifier:Dynamic:ClusterPool:LessRecentlyUsed', async function () {
      await dynamicClusterTestLessRecentlyUsed()
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
