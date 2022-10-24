const Benchmark = require('benny')
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

const resultsFile = 'poolifier'
const resultsFolder = 'benchmarks/internal/results'

Benchmark.suite(
  'Poolifier',
  Benchmark.add('Poolifier:Fixed:ThreadPool', async () => {
    await fixedThreadTest()
  }),
  Benchmark.add('Poolifier:Fixed:ThreadPool:LessRecentlyUsed', async () => {
    await fixedThreadTestLessRecentlyUsed()
  }),
  Benchmark.add('Poolifier:Fixed:ThreadPool:WeightedRoundRobin', async () => {
    await fixedThreadTestWeightedRoundRobin()
  }),
  Benchmark.add('Poolifier:Fixed:ThreadPool:FairShare', async () => {
    await fixedThreadTestFairShare()
  }),
  Benchmark.add('Poolifier:Dynamic:ThreadPool', async () => {
    await dynamicThreadTest()
  }),
  Benchmark.add('Poolifier:Dynamic:ThreadPool:LessRecentlyUsed', async () => {
    await dynamicThreadTestLessRecentlyUsed()
  }),
  Benchmark.add('Poolifier:Dynamic:ThreadPool:WeightedRoundRobin', async () => {
    await dynamicThreadTestWeightedRoundRobin()
  }),
  Benchmark.add('Poolifier:Dynamic:ThreadPool:FairShare', async () => {
    await dynamicThreadTestFairShare()
  }),
  Benchmark.add('Poolifier:Fixed:ClusterPool', async () => {
    await fixedClusterTest()
  }),
  Benchmark.add('Poolifier:Fixed:ClusterPool:LessRecentlyUsed', async () => {
    await fixedClusterTestLessRecentlyUsed()
  }),
  Benchmark.add('Poolifier:Fixed:ClusterPool:WeightedRoundRobin', async () => {
    await fixedClusterTestWeightedRoundRobin
  }),
  Benchmark.add('Poolifier:Fixed:ClusterPool:FairShare', async () => {
    await fixedClusterTestFairShare()
  }),
  Benchmark.add('Poolifier:Dynamic:ClusterPool', async () => {
    await dynamicClusterTest()
  }),
  Benchmark.add('Poolifier:Dynamic:ClusterPool:LessRecentlyUsed', async () => {
    await dynamicClusterTestLessRecentlyUsed()
  }),
  Benchmark.add(
    'Poolifier:Dynamic:ClusterPool:WeightedRoundRobin',
    async () => {
      await dynamicClusterTestWeightedRoundRobin
    }
  ),
  Benchmark.add('Poolifier:Dynamic:ClusterPool:FairShare', async () => {
    await dynamicClusterTestFairShare()
  }),
  Benchmark.cycle(),
  Benchmark.complete(),
  Benchmark.save({
    file: resultsFile,
    folder: resultsFolder,
    format: 'json',
    details: true
  }),
  Benchmark.save({
    file: resultsFile,
    folder: resultsFolder,
    format: 'chart.html',
    details: true
  }),
  Benchmark.save({
    file: resultsFile,
    folder: resultsFolder,
    format: 'table.html',
    details: true
  })
)
  .then(() => {
    // eslint-disable-next-line n/no-process-exit
    return process.exit()
  })
  .catch(err => console.error(err))
