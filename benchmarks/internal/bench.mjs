import { exit } from 'node:process'
// eslint-disable-next-line n/no-unsupported-features/node-builtins
import { parseArgs } from 'node:util'

import {
  availableParallelism,
  PoolTypes,
  WorkerTypes
} from '../../lib/index.mjs'
import { TaskFunctions } from '../benchmarks-types.cjs'
import {
  runPoolifierBenchmarkBenchmarkJsSuite,
  runPoolifierBenchmarkTatamiNg
} from '../benchmarks-utils.mjs'

const poolSize = availableParallelism()
const taskExecutions = 1
const workerData = {
  function: TaskFunctions.factorial,
  taskSize: 50000
}

switch (
  parseArgs({
    args: process.argv,
    options: {
      type: {
        type: 'string',
        short: 't'
      }
    },
    strict: true,
    allowPositionals: true
  }).values.type
) {
  case 'tatami-ng':
    await runPoolifierBenchmarkTatamiNg(
      'FixedThreadPool',
      WorkerTypes.thread,
      PoolTypes.fixed,
      poolSize,
      {
        taskExecutions,
        workerData
      }
    )
    await runPoolifierBenchmarkTatamiNg(
      'DynamicThreadPool',
      WorkerTypes.thread,
      PoolTypes.dynamic,
      poolSize,
      {
        taskExecutions,
        workerData
      }
    )
    await runPoolifierBenchmarkTatamiNg(
      'FixedClusterPool',
      WorkerTypes.cluster,
      PoolTypes.fixed,
      poolSize,
      {
        taskExecutions,
        workerData
      }
    )
    await runPoolifierBenchmarkTatamiNg(
      'DynamicClusterPool',
      WorkerTypes.cluster,
      PoolTypes.dynamic,
      poolSize,
      {
        taskExecutions,
        workerData
      }
    )
    break
  case 'benchmark.js':
  default:
    await runPoolifierBenchmarkBenchmarkJsSuite(
      'FixedThreadPool',
      WorkerTypes.thread,
      PoolTypes.fixed,
      poolSize,
      {
        taskExecutions,
        workerData
      }
    )
    await runPoolifierBenchmarkBenchmarkJsSuite(
      'DynamicThreadPool',
      WorkerTypes.thread,
      PoolTypes.dynamic,
      poolSize,
      {
        taskExecutions,
        workerData
      }
    )
    await runPoolifierBenchmarkBenchmarkJsSuite(
      'FixedClusterPool',
      WorkerTypes.cluster,
      PoolTypes.fixed,
      poolSize,
      {
        taskExecutions,
        workerData
      }
    )
    await runPoolifierBenchmarkBenchmarkJsSuite(
      'DynamicClusterPool',
      WorkerTypes.cluster,
      PoolTypes.dynamic,
      poolSize,
      {
        taskExecutions,
        workerData
      }
    )
    break
}

exit()
