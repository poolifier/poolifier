const Benchmark = require('benchmark')
const {
  dynamicClusterTest,
  dynamicClusterTestFairShare,
  dynamicClusterTestLessRecentlyUsed,
  dynamicClusterTestWeightedRoundRobin
} = require('./cluster/dynamic')
const {
  fixedClusterTest,
  fixedClusterTestFairShare,
  fixedClusterTestLessRecentlyUsed,
  fixedClusterTestWeightedRoundRobin
} = require('./cluster/fixed')
const {
  dynamicThreadTest,
  dynamicThreadTestFairShare,
  dynamicThreadTestLessRecentlyUsed,
  dynamicThreadTestWeightedRoundRobin
} = require('./thread/dynamic')
const {
  fixedThreadTest,
  fixedThreadTestFairShare,
  fixedThreadTestLessRecentlyUsed,
  fixedThreadTestWeightedRoundRobin
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
    .add('Poolifier:Fixed:ThreadPool:WeightedRoundRobin', async function () {
      await fixedThreadTestWeightedRoundRobin()
    })
    .add('Poolifier:Fixed:ThreadPool:FairShare', async function () {
      await fixedThreadTestFairShare()
    })
    .add('Poolifier:Dynamic:ThreadPool', async function () {
      await dynamicThreadTest()
    })
    .add('Poolifier:Dynamic:ThreadPool:LessRecentlyUsed', async function () {
      await dynamicThreadTestLessRecentlyUsed()
    })
    .add('Poolifier:Dynamic:ThreadPool:WeightedRoundRobin', async function () {
      await dynamicThreadTestWeightedRoundRobin()
    })
    .add('Poolifier:Dynamic:ThreadPool:FairShare', async function () {
      await dynamicThreadTestFairShare()
    })
    .add('Poolifier:Fixed:ClusterPool', async function () {
      await fixedClusterTest()
    })
    .add('Poolifier:Fixed:ClusterPool:LessRecentlyUsed', async function () {
      await fixedClusterTestLessRecentlyUsed()
    })
    .add('Poolifier:Fixed:ClusterPool:WeightedRoundRobin', async function () {
      await fixedClusterTestWeightedRoundRobin
    })
    .add('Poolifier:Fixed:ClusterPool:FairShare', async function () {
      await fixedClusterTestFairShare()
    })
    .add('Poolifier:Dynamic:ClusterPool', async function () {
      await dynamicClusterTest()
    })
    .add('Poolifier:Dynamic:ClusterPool:LessRecentlyUsed', async function () {
      await dynamicClusterTestLessRecentlyUsed()
    })
    .add('Poolifier:Dynamic:ClusterPool:WeightedRoundRobin', async function () {
      await dynamicClusterTestWeightedRoundRobin
    })
    .add('Poolifier:Dynamic:ClusterPool:FairShare', async function () {
      await dynamicClusterTestFairShare()
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
