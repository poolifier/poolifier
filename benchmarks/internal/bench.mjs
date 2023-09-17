import {
  PoolTypes,
  WorkerTypes,
  availableParallelism
} from '../../lib/index.mjs'
import { TaskFunctions } from '../benchmarks-types.mjs'
import {
  buildPoolifierPool,
  runPoolifierPoolBenchmark
} from '../benchmarks-utils.mjs'

const poolSize = availableParallelism()
const taskExecutions = 1
const workerData = {
  function: TaskFunctions.jsonIntegerSerialization,
  taskSize: 1000
}

// FixedThreadPool
await runPoolifierPoolBenchmark(
  'Poolifier FixedThreadPool',
  buildPoolifierPool(WorkerTypes.thread, PoolTypes.fixed, poolSize),
  {
    taskExecutions,
    workerData
  }
)

// DynamicThreadPool
await runPoolifierPoolBenchmark(
  'Poolifier DynamicThreadPool',
  buildPoolifierPool(WorkerTypes.thread, PoolTypes.dynamic, poolSize),
  {
    taskExecutions,
    workerData
  }
)
