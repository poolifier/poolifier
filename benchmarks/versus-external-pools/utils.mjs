import { availableParallelism } from 'poolifier'

export const executeAsyncFn = async fn => {
  try {
    await fn()
  } catch (e) {
    console.error(e)
    // eslint-disable-next-line n/no-process-exit
    process.exit(1)
  }
}

export const BenchmarkDefaults = {
  poolSize: availableParallelism(),
  numIterations: 100000,
  taskType: 'CPU_INTENSIVE',
  taskSize: 5000
}
