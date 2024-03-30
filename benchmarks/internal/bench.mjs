import { exit } from 'node:process'
import { parseArgs } from 'node:util'

import { run } from 'mitata'

import {
  availableParallelism,
  PoolTypes,
  WorkerTypes
} from '../../lib/index.mjs'
import { TaskFunctions } from '../benchmarks-types.cjs'
import {
  buildPoolifierBenchmarkMitata,
  runPoolifierBenchmarkBenchmarkJs
} from '../benchmarks-utils.mjs'

const poolSize = availableParallelism()
const taskExecutions = 1
const workerData = {
  function: TaskFunctions.factorial,
  taskSize: 50000
}

const options = {
  type: {
    type: 'string',
    short: 't'
  }
}
const { values } = parseArgs({
  args: process.argv,
  options,
  strict: true,
  allowPositionals: true
})

let fixedThreadPool
let dynamicThreadPool
let fixedClusterPool
let dynamicClusterPool
switch (values.type) {
  case 'mitata':
    fixedThreadPool = buildPoolifierBenchmarkMitata(
      'FixedThreadPool',
      WorkerTypes.thread,
      PoolTypes.fixed,
      poolSize,
      {
        taskExecutions,
        workerData
      }
    )
    dynamicThreadPool = buildPoolifierBenchmarkMitata(
      'DynamicThreadPool',
      WorkerTypes.thread,
      PoolTypes.dynamic,
      poolSize,
      {
        taskExecutions,
        workerData
      }
    )
    fixedClusterPool = buildPoolifierBenchmarkMitata(
      'FixedClusterPool',
      WorkerTypes.cluster,
      PoolTypes.fixed,
      poolSize,
      {
        taskExecutions,
        workerData
      }
    )
    dynamicClusterPool = buildPoolifierBenchmarkMitata(
      'DynamicClusterPool',
      WorkerTypes.cluster,
      PoolTypes.dynamic,
      poolSize,
      {
        taskExecutions,
        workerData
      }
    )
    await run()
    await fixedThreadPool.destroy()
    await dynamicThreadPool.destroy()
    await fixedClusterPool.destroy()
    await dynamicClusterPool.destroy()
    break
  case 'benchmark.js':
  default:
    await runPoolifierBenchmarkBenchmarkJs(
      'FixedThreadPool',
      WorkerTypes.thread,
      PoolTypes.fixed,
      poolSize,
      {
        taskExecutions,
        workerData
      }
    )
    await runPoolifierBenchmarkBenchmarkJs(
      'DynamicThreadPool',
      WorkerTypes.thread,
      PoolTypes.dynamic,
      poolSize,
      {
        taskExecutions,
        workerData
      }
    )
    await runPoolifierBenchmarkBenchmarkJs(
      'FixedClusterPool',
      WorkerTypes.cluster,
      PoolTypes.fixed,
      poolSize,
      {
        taskExecutions,
        workerData
      }
    )
    await runPoolifierBenchmarkBenchmarkJs(
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
