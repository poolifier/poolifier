import { writeFileSync } from 'node:fs'
import { env, exit } from 'node:process'
import { parseArgs } from 'node:util'

import {
  availableParallelism,
  PoolTypes,
  WorkerTypes,
} from '../../lib/index.mjs'
import { TaskFunctions } from '../benchmarks-types.cjs'
import { runPoolifierBenchmarkTinyBench } from '../benchmarks-utils.mjs'

const poolSize = availableParallelism()
const taskExecutions = 1
const workerData = {
  function: TaskFunctions.factorial,
  taskSize: 1000,
}
const benchmarkReportFile = 'benchmark-report.json'

const runBenchmark = async () => {
  let benchmarkReport = {}

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
    case 'tinybench':
    default:
      benchmarkReport = await runPoolifierBenchmarkTinyBench(
        'FixedThreadPool',
        WorkerTypes.thread,
        PoolTypes.fixed,
        poolSize,
        {
          taskExecutions,
          workerData,
        }
      )
      benchmarkReport = {
        ...benchmarkReport,
        ...(await runPoolifierBenchmarkTinyBench(
          'DynamicThreadPool',
          WorkerTypes.thread,
          PoolTypes.dynamic,
          poolSize,
          {
            taskExecutions,
            workerData,
          }
        )),
      }
      benchmarkReport = {
        ...benchmarkReport,
        ...(await runPoolifierBenchmarkTinyBench(
          'FixedClusterPool',
          WorkerTypes.cluster,
          PoolTypes.fixed,
          poolSize,
          {
            taskExecutions,
            workerData,
          }
        )),
      }
      benchmarkReport = {
        ...benchmarkReport,
        ...(await runPoolifierBenchmarkTinyBench(
          'DynamicClusterPool',
          WorkerTypes.cluster,
          PoolTypes.dynamic,
          poolSize,
          {
            taskExecutions,
            workerData,
          }
        )),
      }
      break
  }

  return benchmarkReport
}

try {
  const benchmarkReport = await runBenchmark()
  if (env.CI != null) {
    writeFileSync(benchmarkReportFile, JSON.stringify(benchmarkReport))
  }
} catch (error) {
  console.error(error)
  exit(1)
}
