const Benchmark = require('benny')
const { WorkerChoiceStrategies } = require('../../lib')
const {
  PoolTypes,
  WorkerFunctions,
  WorkerTypes
} = require('../benchmarks-types')
const { buildPool, runTest } = require('../benchmarks-utils')

const poolSize = 30
const taskExecutions = 1
const workerData = {
  function: WorkerFunctions.jsonIntegerSerialization,
  taskSize: 1000
}
const tasksQueuePoolOption = { enableTasksQueue: true }
const workerChoiceStrategyRoundRobinPoolOption = {
  workerChoiceStrategy: WorkerChoiceStrategies.ROUND_ROBIN
}
const workerChoiceStrategyLessUsedPoolOption = {
  workerChoiceStrategy: WorkerChoiceStrategies.LESS_USED
}
const workerChoiceStrategyLessBusyPoolOption = {
  workerChoiceStrategy: WorkerChoiceStrategies.LESS_BUSY
}
const workerChoiceStrategyWeightedRoundRobinPoolOption = {
  workerChoiceStrategy: WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN
}
const workerChoiceStrategyFairSharePoolOption = {
  workerChoiceStrategy: WorkerChoiceStrategies.FAIR_SHARE
}

const fixedThreadPoolRoundRobin = buildPool(
  PoolTypes.FIXED,
  poolSize,
  WorkerTypes.THREAD,
  workerChoiceStrategyRoundRobinPoolOption
)

const fixedThreadPoolRoundRobinTasksQueue = buildPool(
  PoolTypes.FIXED,
  poolSize,
  WorkerTypes.THREAD,
  { ...workerChoiceStrategyRoundRobinPoolOption, ...tasksQueuePoolOption }
)

const fixedThreadPoolLessUsed = buildPool(
  PoolTypes.FIXED,
  poolSize,
  WorkerTypes.THREAD,
  workerChoiceStrategyLessUsedPoolOption
)

const fixedThreadPoolLessBusy = buildPool(
  PoolTypes.FIXED,
  poolSize,
  WorkerTypes.THREAD,
  workerChoiceStrategyLessBusyPoolOption
)

const fixedThreadPoolWeightedRoundRobin = buildPool(
  PoolTypes.FIXED,
  poolSize,
  WorkerTypes.THREAD,
  workerChoiceStrategyWeightedRoundRobinPoolOption
)

const fixedThreadPoolFairShare = buildPool(
  PoolTypes.FIXED,
  poolSize,
  WorkerTypes.THREAD,
  workerChoiceStrategyFairSharePoolOption
)

const dynamicThreadPoolRoundRobin = buildPool(
  PoolTypes.DYNAMIC,
  poolSize,
  WorkerTypes.THREAD,
  workerChoiceStrategyRoundRobinPoolOption
)

const dynamicThreadPoolLessUsed = buildPool(
  PoolTypes.DYNAMIC,
  poolSize,
  WorkerTypes.THREAD,
  workerChoiceStrategyLessUsedPoolOption
)

const dynamicThreadPoolLessBusy = buildPool(
  PoolTypes.DYNAMIC,
  poolSize,
  WorkerTypes.THREAD,
  workerChoiceStrategyLessBusyPoolOption
)

const dynamicThreadPoolWeightedRoundRobin = buildPool(
  PoolTypes.DYNAMIC,
  poolSize,
  WorkerTypes.THREAD,
  workerChoiceStrategyWeightedRoundRobinPoolOption
)

const dynamicThreadPoolFairShare = buildPool(
  PoolTypes.DYNAMIC,
  poolSize,
  WorkerTypes.THREAD,
  workerChoiceStrategyFairSharePoolOption
)

const fixedClusterPoolRoundRobin = buildPool(
  PoolTypes.FIXED,
  poolSize,
  WorkerTypes.CLUSTER,
  workerChoiceStrategyRoundRobinPoolOption
)

const fixedClusterPoolRoundRobinTasksQueue = buildPool(
  PoolTypes.FIXED,
  poolSize,
  WorkerTypes.CLUSTER,
  { ...workerChoiceStrategyRoundRobinPoolOption, ...tasksQueuePoolOption }
)

const fixedClusterPoolLessUsed = buildPool(
  PoolTypes.FIXED,
  poolSize,
  WorkerTypes.CLUSTER,
  workerChoiceStrategyLessUsedPoolOption
)

const fixedClusterPoolLessBusy = buildPool(
  PoolTypes.FIXED,
  poolSize,
  WorkerTypes.CLUSTER,
  workerChoiceStrategyLessBusyPoolOption
)

const fixedClusterPoolWeightedRoundRobin = buildPool(
  PoolTypes.FIXED,
  poolSize,
  WorkerTypes.CLUSTER,
  workerChoiceStrategyWeightedRoundRobinPoolOption
)

const fixedClusterPoolFairShare = buildPool(
  PoolTypes.FIXED,
  poolSize,
  WorkerTypes.CLUSTER,
  workerChoiceStrategyFairSharePoolOption
)

const dynamicClusterPoolRoundRobin = buildPool(
  PoolTypes.DYNAMIC,
  poolSize,
  WorkerTypes.CLUSTER,
  workerChoiceStrategyRoundRobinPoolOption
)

const dynamicClusterPoolLessUsed = buildPool(
  PoolTypes.DYNAMIC,
  poolSize,
  WorkerTypes.CLUSTER,
  workerChoiceStrategyLessUsedPoolOption
)

const dynamicClusterPoolLessBusy = buildPool(
  PoolTypes.DYNAMIC,
  poolSize,
  WorkerTypes.CLUSTER,
  workerChoiceStrategyLessBusyPoolOption
)

const dynamicClusterPoolWeightedRoundRobin = buildPool(
  PoolTypes.DYNAMIC,
  poolSize,
  WorkerTypes.CLUSTER,
  workerChoiceStrategyWeightedRoundRobinPoolOption
)

const dynamicClusterPoolFairShare = buildPool(
  PoolTypes.DYNAMIC,
  poolSize,
  WorkerTypes.CLUSTER,
  workerChoiceStrategyFairSharePoolOption
)

const resultsFile = 'poolifier'
const resultsFolder = 'benchmarks/internal/results'

Benchmark.suite(
  'Poolifier',
  Benchmark.add('Fixed:ThreadPool:RoundRobin', async () => {
    await runTest(fixedThreadPoolRoundRobin, {
      taskExecutions,
      workerData
    })
  }),
  Benchmark.add(
    'Fixed:ThreadPool:RoundRobin:{ enableTasksQueue: true }',
    async () => {
      await runTest(fixedThreadPoolRoundRobinTasksQueue, {
        taskExecutions,
        workerData
      })
    }
  ),
  Benchmark.add('Fixed:ThreadPool:LessUsed', async () => {
    await runTest(fixedThreadPoolLessUsed, {
      taskExecutions,
      workerData
    })
  }),
  Benchmark.add('Fixed:ThreadPool:LessBusy', async () => {
    await runTest(fixedThreadPoolLessBusy, {
      taskExecutions,
      workerData
    })
  }),
  Benchmark.add('Fixed:ThreadPool:WeightedRoundRobin', async () => {
    await runTest(fixedThreadPoolWeightedRoundRobin, {
      taskExecutions,
      workerData
    })
  }),
  Benchmark.add('Fixed:ThreadPool:FairShare', async () => {
    await runTest(fixedThreadPoolFairShare, {
      taskExecutions,
      workerData
    })
  }),
  Benchmark.add('Dynamic:ThreadPool:RoundRobin', async () => {
    await runTest(dynamicThreadPoolRoundRobin, {
      taskExecutions,
      workerData
    })
  }),
  Benchmark.add('Dynamic:ThreadPool:LessUsed', async () => {
    await runTest(dynamicThreadPoolLessUsed, {
      taskExecutions,
      workerData
    })
  }),
  Benchmark.add('Dynamic:ThreadPool:LessBusy', async () => {
    await runTest(dynamicThreadPoolLessBusy, {
      taskExecutions,
      workerData
    })
  }),
  Benchmark.add('Dynamic:ThreadPool:WeightedRoundRobin', async () => {
    await runTest(dynamicThreadPoolWeightedRoundRobin, {
      taskExecutions,
      workerData
    })
  }),
  Benchmark.add('Dynamic:ThreadPool:FairShare', async () => {
    await runTest(dynamicThreadPoolFairShare, {
      taskExecutions,
      workerData
    })
  }),
  Benchmark.add('Fixed:ClusterPool:RoundRobin', async () => {
    await runTest(fixedClusterPoolRoundRobin, {
      taskExecutions,
      workerData
    })
  }),
  Benchmark.add(
    'Fixed:ClusterPool:RoundRobin:{ enableTasksQueue: true }',
    async () => {
      await runTest(fixedClusterPoolRoundRobinTasksQueue, {
        taskExecutions,
        workerData
      })
    }
  ),
  Benchmark.add('Fixed:ClusterPool:LessUsed', async () => {
    await runTest(fixedClusterPoolLessUsed, {
      taskExecutions,
      workerData
    })
  }),
  Benchmark.add('Fixed:ClusterPool:LessBusy', async () => {
    await runTest(fixedClusterPoolLessBusy, {
      taskExecutions,
      workerData
    })
  }),
  Benchmark.add('Fixed:ClusterPool:WeightedRoundRobin', async () => {
    await runTest(fixedClusterPoolWeightedRoundRobin, {
      taskExecutions,
      workerData
    })
  }),
  Benchmark.add('Fixed:ClusterPool:FairShare', async () => {
    await runTest(fixedClusterPoolFairShare, {
      taskExecutions,
      workerData
    })
  }),
  Benchmark.add('Dynamic:ClusterPool:RoundRobin', async () => {
    await runTest(dynamicClusterPoolRoundRobin, {
      taskExecutions,
      workerData
    })
  }),
  Benchmark.add('Dynamic:ClusterPool:LessUsed', async () => {
    await runTest(dynamicClusterPoolLessUsed, {
      taskExecutions,
      workerData
    })
  }),
  Benchmark.add('Dynamic:ClusterPool:LessBusy', async () => {
    await runTest(dynamicClusterPoolLessBusy, {
      taskExecutions,
      workerData
    })
  }),
  Benchmark.add('Dynamic:ClusterPool:WeightedRoundRobin', async () => {
    await runTest(dynamicClusterPoolWeightedRoundRobin, {
      taskExecutions,
      workerData
    })
  }),
  Benchmark.add('Dynamic:ClusterPool:FairShare', async () => {
    await runTest(dynamicClusterPoolFairShare, {
      taskExecutions,
      workerData
    })
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
