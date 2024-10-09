import { writeFileSync } from 'node:fs'
import { env } from 'node:process'
// eslint-disable-next-line n/no-unsupported-features/node-builtins
import { parseArgs } from 'node:util'
import { bmf } from 'tatami-ng'

import {
  availableParallelism,
  PoolTypes,
  WorkerTypes,
} from '../../lib/index.mjs'
import { TaskFunctions } from '../benchmarks-types.cjs'
import { runPoolifierBenchmarkTatamiNg } from '../benchmarks-utils.mjs'

const poolSize = availableParallelism()
const taskExecutions = 1
const workerData = {
  function: TaskFunctions.factorial,
  taskSize: 1000,
}
const benchmarkReportFile = 'benchmark-report.json'
let benchmarkReport

switch (
  parseArgs({
    allowPositionals: true,
    args: process.argv,
    options: {
      type: {
        short: 't',
        type: 'string',
      },
    },
    strict: true,
  }).values.type
) {
  case 'tatami-ng':
  default:
    benchmarkReport = await runPoolifierBenchmarkTatamiNg(
      'FixedThreadPool',
      WorkerTypes.thread,
      PoolTypes.fixed,
      poolSize,
      bmf,
      {
        taskExecutions,
        workerData,
      }
    )
    benchmarkReport = {
      ...benchmarkReport,
      ...(await runPoolifierBenchmarkTatamiNg(
        'DynamicThreadPool',
        WorkerTypes.thread,
        PoolTypes.dynamic,
        poolSize,
        bmf,
        {
          taskExecutions,
          workerData,
        }
      )),
    }
    benchmarkReport = {
      ...benchmarkReport,
      ...(await runPoolifierBenchmarkTatamiNg(
        'FixedClusterPool',
        WorkerTypes.cluster,
        PoolTypes.fixed,
        poolSize,
        bmf,
        {
          taskExecutions,
          workerData,
        }
      )),
    }
    benchmarkReport = {
      ...benchmarkReport,
      ...(await runPoolifierBenchmarkTatamiNg(
        'DynamicClusterPool',
        WorkerTypes.cluster,
        PoolTypes.dynamic,
        poolSize,
        bmf,
        {
          taskExecutions,
          workerData,
        }
      )),
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    env.CI != null &&
      writeFileSync(benchmarkReportFile, JSON.stringify(benchmarkReport))
    break
}
