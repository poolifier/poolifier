import { exit } from 'node:process'
import { parseArgs } from 'node:util'

import {
  availableParallelism,
  PoolTypes,
  WorkerTypes
} from '../../lib/index.mjs'
import { TaskFunctions } from '../benchmarks-types.cjs'
import {
  runPoolifierBenchmarkBenchmarkJsSuite,
  runPoolifierBenchmarkMitata
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
  case 'mitata':
    await runPoolifierBenchmarkMitata(
      'FixedThreadPool',
      WorkerTypes.thread,
      PoolTypes.fixed,
      poolSize,
      {
        taskExecutions,
        workerData
      }
    )
    await runPoolifierBenchmarkMitata(
      'DynamicThreadPool',
      WorkerTypes.thread,
      PoolTypes.dynamic,
      poolSize,
      {
        taskExecutions,
        workerData
      }
    )
    await runPoolifierBenchmarkMitata(
      'FixedClusterPool',
      WorkerTypes.cluster,
      PoolTypes.fixed,
      poolSize,
      {
        taskExecutions,
        workerData
      }
    )
    await runPoolifierBenchmarkMitata(
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
