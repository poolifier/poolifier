import { exit } from 'node:process'
import {
  PoolTypes,
  WorkerTypes,
  availableParallelism
} from '../../lib/index.mjs'
import { TaskFunctions } from '../benchmarks-types.js'
import { runPoolifierPoolBenchmark } from '../benchmarks-utils.js'

const poolSize = availableParallelism()
const taskExecutions = 1
const workerData = {
  function: TaskFunctions.jsonIntegerSerialization,
  taskSize: 1000
}

// FixedThreadPool
await runPoolifierPoolBenchmark(
  'FixedThreadPool',
  WorkerTypes.thread,
  PoolTypes.fixed,
  poolSize,
  {
    taskExecutions,
    workerData
  }
)

// DynamicThreadPool
await runPoolifierPoolBenchmark(
  'DynamicThreadPool',
  WorkerTypes.thread,
  PoolTypes.dynamic,
  poolSize,
  {
    taskExecutions,
    workerData
  }
)

// FixedClusterPool
await runPoolifierPoolBenchmark(
  'FixedClusterPool',
  WorkerTypes.cluster,
  PoolTypes.fixed,
  poolSize,
  {
    taskExecutions,
    workerData
  }
)

// DynamicClusterPool
await runPoolifierPoolBenchmark(
  'DynamicClusterPool',
  WorkerTypes.cluster,
  PoolTypes.dynamic,
  poolSize,
  {
    taskExecutions,
    workerData
  }
)

exit()
