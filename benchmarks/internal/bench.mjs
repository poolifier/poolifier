import { writeFileSync } from 'node:fs'
import { env } from 'node:process'
// eslint-disable-next-line n/no-unsupported-features/node-builtins
import { parseArgs } from 'node:util'

import {
  availableParallelism,
  PoolTypes,
  WorkerTypes
} from '../../lib/index.mjs'
import { TaskFunctions } from '../benchmarks-types.cjs'
import {
  convertTatamiNgToBmf,
  runPoolifierBenchmarkTatamiNg
} from '../benchmarks-utils.mjs'

const poolSize = availableParallelism()
const taskExecutions = 1
const workerData = {
  function: TaskFunctions.factorial,
  taskSize: 1000
}
const benchmarkReportFile = 'benchmark-report.json'
let benchmarkReport

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
  default:
    benchmarkReport = convertTatamiNgToBmf(
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
    )
    benchmarkReport = {
      ...benchmarkReport,
      ...convertTatamiNgToBmf(
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
      )
    }
    benchmarkReport = {
      ...benchmarkReport,
      ...convertTatamiNgToBmf(
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
      )
    }
    benchmarkReport = {
      ...benchmarkReport,
      ...convertTatamiNgToBmf(
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
      )
    }
    env.CI != null &&
      writeFileSync(benchmarkReportFile, JSON.stringify(benchmarkReport))
    break
}
