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
const workerChoiceStrategyLeastUsedPoolOption = {
  workerChoiceStrategy: WorkerChoiceStrategies.LEAST_USED
}
const workerChoiceStrategyLeastBusyPoolOption = {
  workerChoiceStrategy: WorkerChoiceStrategies.LEAST_BUSY
}
const workerChoiceStrategyWeightedRoundRobinPoolOption = {
  workerChoiceStrategy: WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN
}
const workerChoiceStrategyFairSharePoolOption = {
  workerChoiceStrategy: WorkerChoiceStrategies.FAIR_SHARE
}

const fixedThreadPoolRoundRobin = buildPool(
  WorkerTypes.THREAD,
  PoolTypes.FIXED,
  poolSize,
  workerChoiceStrategyRoundRobinPoolOption
)

const fixedThreadPoolRoundRobinTasksQueue = buildPool(
  WorkerTypes.THREAD,
  PoolTypes.FIXED,
  poolSize,
  { ...workerChoiceStrategyRoundRobinPoolOption, ...tasksQueuePoolOption }
)

const fixedThreadPoolLeastUsed = buildPool(
  WorkerTypes.THREAD,
  PoolTypes.FIXED,
  poolSize,
  workerChoiceStrategyLeastUsedPoolOption
)

const fixedThreadPoolLeastBusy = buildPool(
  WorkerTypes.THREAD,
  PoolTypes.FIXED,
  poolSize,
  workerChoiceStrategyLeastBusyPoolOption
)

const fixedThreadPoolWeightedRoundRobin = buildPool(
  WorkerTypes.THREAD,
  PoolTypes.FIXED,
  poolSize,
  workerChoiceStrategyWeightedRoundRobinPoolOption
)

const fixedThreadPoolFairShare = buildPool(
  WorkerTypes.THREAD,
  PoolTypes.FIXED,
  poolSize,
  workerChoiceStrategyFairSharePoolOption
)

const fixedThreadPoolFairShareTasksQueue = buildPool(
  WorkerTypes.THREAD,
  PoolTypes.FIXED,
  poolSize,
  { ...workerChoiceStrategyFairSharePoolOption, ...tasksQueuePoolOption }
)

const dynamicThreadPoolRoundRobin = buildPool(
  WorkerTypes.THREAD,
  PoolTypes.DYNAMIC,
  poolSize,
  workerChoiceStrategyRoundRobinPoolOption
)

const dynamicThreadPoolLeastUsed = buildPool(
  WorkerTypes.THREAD,
  PoolTypes.DYNAMIC,
  poolSize,
  workerChoiceStrategyLeastUsedPoolOption
)

const dynamicThreadPoolLeastBusy = buildPool(
  WorkerTypes.THREAD,
  PoolTypes.DYNAMIC,
  poolSize,
  workerChoiceStrategyLeastBusyPoolOption
)

const dynamicThreadPoolWeightedRoundRobin = buildPool(
  WorkerTypes.THREAD,
  PoolTypes.DYNAMIC,
  poolSize,
  workerChoiceStrategyWeightedRoundRobinPoolOption
)

const dynamicThreadPoolFairShare = buildPool(
  WorkerTypes.THREAD,
  PoolTypes.DYNAMIC,
  poolSize,
  workerChoiceStrategyFairSharePoolOption
)

const fixedClusterPoolRoundRobin = buildPool(
  WorkerTypes.CLUSTER,
  PoolTypes.FIXED,
  poolSize,
  workerChoiceStrategyRoundRobinPoolOption
)

const fixedClusterPoolRoundRobinTasksQueue = buildPool(
  WorkerTypes.CLUSTER,
  PoolTypes.FIXED,
  poolSize,
  { ...workerChoiceStrategyRoundRobinPoolOption, ...tasksQueuePoolOption }
)

const fixedClusterPoolLeastUsed = buildPool(
  WorkerTypes.CLUSTER,
  PoolTypes.FIXED,
  poolSize,
  workerChoiceStrategyLeastUsedPoolOption
)

const fixedClusterPoolLeastBusy = buildPool(
  WorkerTypes.CLUSTER,
  PoolTypes.FIXED,
  poolSize,
  workerChoiceStrategyLeastBusyPoolOption
)

const fixedClusterPoolWeightedRoundRobin = buildPool(
  WorkerTypes.CLUSTER,
  PoolTypes.FIXED,
  poolSize,
  workerChoiceStrategyWeightedRoundRobinPoolOption
)

const fixedClusterPoolFairShare = buildPool(
  WorkerTypes.CLUSTER,
  PoolTypes.FIXED,
  poolSize,
  workerChoiceStrategyFairSharePoolOption
)

const fixedClusterPoolFairShareTaskQueue = buildPool(
  WorkerTypes.CLUSTER,
  PoolTypes.FIXED,
  poolSize,
  { ...workerChoiceStrategyFairSharePoolOption, ...tasksQueuePoolOption }
)

const dynamicClusterPoolRoundRobin = buildPool(
  WorkerTypes.CLUSTER,
  PoolTypes.DYNAMIC,
  poolSize,
  workerChoiceStrategyRoundRobinPoolOption
)

const dynamicClusterPoolLeastUsed = buildPool(
  WorkerTypes.CLUSTER,
  PoolTypes.DYNAMIC,
  poolSize,
  workerChoiceStrategyLeastUsedPoolOption
)

const dynamicClusterPoolLeastBusy = buildPool(
  WorkerTypes.CLUSTER,
  PoolTypes.DYNAMIC,
  poolSize,
  workerChoiceStrategyLeastBusyPoolOption
)

const dynamicClusterPoolWeightedRoundRobin = buildPool(
  WorkerTypes.CLUSTER,
  PoolTypes.DYNAMIC,
  poolSize,
  workerChoiceStrategyWeightedRoundRobinPoolOption
)

const dynamicClusterPoolFairShare = buildPool(
  WorkerTypes.CLUSTER,
  PoolTypes.DYNAMIC,
  poolSize,
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
  Benchmark.add('Fixed:ThreadPool:LeastUsed', async () => {
    await runTest(fixedThreadPoolLeastUsed, {
      taskExecutions,
      workerData
    })
  }),
  Benchmark.add('Fixed:ThreadPool:LeastBusy', async () => {
    await runTest(fixedThreadPoolLeastBusy, {
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
  Benchmark.add(
    'Fixed:ThreadPool:FairShare:{ enableTasksQueue: true }',
    async () => {
      await runTest(fixedThreadPoolFairShareTasksQueue, {
        taskExecutions,
        workerData
      })
    }
  ),
  Benchmark.add('Dynamic:ThreadPool:RoundRobin', async () => {
    await runTest(dynamicThreadPoolRoundRobin, {
      taskExecutions,
      workerData
    })
  }),
  Benchmark.add('Dynamic:ThreadPool:LeastUsed', async () => {
    await runTest(dynamicThreadPoolLeastUsed, {
      taskExecutions,
      workerData
    })
  }),
  Benchmark.add('Dynamic:ThreadPool:LeastBusy', async () => {
    await runTest(dynamicThreadPoolLeastBusy, {
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
  Benchmark.add('Fixed:ClusterPool:LeastUsed', async () => {
    await runTest(fixedClusterPoolLeastUsed, {
      taskExecutions,
      workerData
    })
  }),
  Benchmark.add('Fixed:ClusterPool:LeastBusy', async () => {
    await runTest(fixedClusterPoolLeastBusy, {
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
  Benchmark.add(
    'Fixed:ClusterPool:FairShare:{ enableTasksQueue: true }',
    async () => {
      await runTest(fixedClusterPoolFairShareTaskQueue, {
        taskExecutions,
        workerData
      })
    }
  ),
  Benchmark.add('Dynamic:ClusterPool:RoundRobin', async () => {
    await runTest(dynamicClusterPoolRoundRobin, {
      taskExecutions,
      workerData
    })
  }),
  Benchmark.add('Dynamic:ClusterPool:LeastUsed', async () => {
    await runTest(dynamicClusterPoolLeastUsed, {
      taskExecutions,
      workerData
    })
  }),
  Benchmark.add('Dynamic:ClusterPool:LeastBusy', async () => {
    await runTest(dynamicClusterPoolLeastBusy, {
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
