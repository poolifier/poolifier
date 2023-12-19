import * as os from 'node:os'
import { getRandomValues } from 'node:crypto'
import { Worker as ClusterWorker } from 'node:cluster'
import { Worker as ThreadWorker } from 'node:worker_threads'
import type {
  InternalWorkerChoiceStrategyOptions,
  MeasurementStatisticsRequirements
} from './pools/selection-strategies/selection-strategies-types'
import type { KillBehavior } from './worker/worker-options'
import { type IWorker, type WorkerType, WorkerTypes } from './pools/worker'

/**
 * Default task name.
 */
export const DEFAULT_TASK_NAME = 'default'

/**
 * An intentional empty function.
 */
export const EMPTY_FUNCTION: () => void = Object.freeze(() => {
  /* Intentionally empty */
})

/**
 * Gets default worker choice strategy options.
 *
 * @param retries - The number of worker choice retries.
 * @returns The default worker choice strategy options.
 */
export const getDefaultInternalWorkerChoiceStrategyOptions = (
  retries: number
): InternalWorkerChoiceStrategyOptions => {
  return {
    retries,
    runTime: { median: false },
    waitTime: { median: false },
    elu: { median: false }
  }
}

/**
 * Default measurement statistics requirements.
 */
export const DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS: MeasurementStatisticsRequirements =
  {
    aggregate: false,
    average: false,
    median: false
  }

/**
 * Returns safe host OS optimized estimate of the default amount of parallelism a pool should use.
 * Always returns a value greater than zero.
 *
 * @returns The host OS optimized maximum pool size.
 */
export const availableParallelism = (): number => {
  let availableParallelism = 1
  try {
    availableParallelism = os.availableParallelism()
  } catch {
    const cpus = os.cpus()
    if (Array.isArray(cpus) && cpus.length > 0) {
      availableParallelism = cpus.length
    }
  }
  return availableParallelism
}

/**
 * Returns the worker type of the given worker.
 *
 * @param worker - The worker to get the type of.
 * @returns The worker type of the given worker.
 * @internal
 */
export const getWorkerType = (worker: IWorker): WorkerType | undefined => {
  if (worker instanceof ThreadWorker) {
    return WorkerTypes.thread
  } else if (worker instanceof ClusterWorker) {
    return WorkerTypes.cluster
  }
}

/**
 * Returns the worker id of the given worker.
 *
 * @param worker - The worker to get the id of.
 * @returns The worker id of the given worker.
 * @internal
 */
export const getWorkerId = (worker: IWorker): number | undefined => {
  if (worker instanceof ThreadWorker) {
    return worker.threadId
  } else if (worker instanceof ClusterWorker) {
    return worker.id
  }
}

/**
 * Sleeps for the given amount of milliseconds.
 *
 * @param ms - The amount of milliseconds to sleep.
 * @returns A promise that resolves after the given amount of milliseconds.
 * @internal
 */
export const sleep = async (ms: number): Promise<void> => {
  await new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

/**
 * Computes the retry delay in milliseconds using an exponential back off algorithm.
 *
 * @param retryNumber - The number of retries that have already been attempted
 * @param delayFactor - The base delay factor in milliseconds
 * @returns Delay in milliseconds
 * @internal
 */
export const exponentialDelay = (
  retryNumber = 0,
  delayFactor = 100
): number => {
  const delay = Math.pow(2, retryNumber) * delayFactor
  const randomSum = delay * 0.2 * secureRandom() // 0-20% of the delay
  return delay + randomSum
}

/**
 * Computes the average of the given data set.
 *
 * @param dataSet - Data set.
 * @returns The average of the given data set.
 * @internal
 */
export const average = (dataSet: number[]): number => {
  if (Array.isArray(dataSet) && dataSet.length === 0) {
    return 0
  }
  if (Array.isArray(dataSet) && dataSet.length === 1) {
    return dataSet[0]
  }
  return (
    dataSet.reduce((accumulator, number) => accumulator + number, 0) /
    dataSet.length
  )
}

/**
 * Computes the median of the given data set.
 *
 * @param dataSet - Data set.
 * @returns The median of the given data set.
 * @internal
 */
export const median = (dataSet: number[]): number => {
  if (Array.isArray(dataSet) && dataSet.length === 0) {
    return 0
  }
  if (Array.isArray(dataSet) && dataSet.length === 1) {
    return dataSet[0]
  }
  const sortedDataSet = dataSet.slice().sort((a, b) => a - b)
  return (
    (sortedDataSet[(sortedDataSet.length - 1) >> 1] +
      sortedDataSet[sortedDataSet.length >> 1]) /
    2
  )
}

/**
 * Rounds the given number to the given scale.
 * The rounding is done using the "round half away from zero" method.
 *
 * @param num - The number to round.
 * @param scale - The scale to round to.
 * @returns The rounded number.
 * @internal
 */
export const round = (num: number, scale = 2): number => {
  const rounder = Math.pow(10, scale)
  return Math.round(num * rounder * (1 + Number.EPSILON)) / rounder
}

/**
 * Is the given object a plain object?
 *
 * @param obj - The object to check.
 * @returns `true` if the given object is a plain object, `false` otherwise.
 * @internal
 */
export const isPlainObject = (obj: unknown): boolean =>
  typeof obj === 'object' &&
  obj !== null &&
  obj?.constructor === Object &&
  Object.prototype.toString.call(obj) === '[object Object]'

/**
 * Detects whether the given value is a kill behavior or not.
 *
 * @typeParam KB - Which specific KillBehavior type to test against.
 * @param killBehavior - Which kind of kill behavior to detect.
 * @param value - Any value.
 * @returns `true` if `value` was strictly equals to `killBehavior`, otherwise `false`.
 * @internal
 */
export const isKillBehavior = <KB extends KillBehavior>(
  killBehavior: KB,
  value: unknown
): value is KB => {
  return value === killBehavior
}

/**
 * Detects whether the given value is an asynchronous function or not.
 *
 * @param fn - Any value.
 * @returns `true` if `fn` was an asynchronous function, otherwise `false`.
 * @internal
 */
export const isAsyncFunction = (
  fn: unknown
): fn is (...args: unknown[]) => Promise<unknown> => {
  return typeof fn === 'function' && fn.constructor.name === 'AsyncFunction'
}

/**
 * Generates a cryptographically secure random number in the [0,1[ range
 *
 * @returns A number in the [0,1[ range
 * @internal
 */
export const secureRandom = (): number => {
  return getRandomValues(new Uint32Array(1))[0] / 0x100000000
}

/**
 * Returns the minimum of the given numbers.
 * If no numbers are given, `Infinity` is returned.
 *
 * @param args - The numbers to get the minimum of.
 * @returns The minimum of the given numbers.
 * @internal
 */
export const min = (...args: number[]): number =>
  args.reduce((minimum, num) => (minimum < num ? minimum : num), Infinity)

/**
 * Returns the maximum of the given numbers.
 * If no numbers are given, `-Infinity` is returned.
 *
 * @param args - The numbers to get the maximum of.
 * @returns The maximum of the given numbers.
 * @internal
 */
export const max = (...args: number[]): number =>
  args.reduce((maximum, num) => (maximum > num ? maximum : num), -Infinity)

/**
 * Wraps a function so that it can only be called once.
 *
 * @param fn - The function to wrap.
 * @param context - The context to bind the function to.
 * @returns The wrapped function.
 * @internal
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const once = <T, A extends any[], R>(
  fn: (...args: A) => R,
  context: T
): ((...args: A) => R) => {
  let result: R
  return (...args: A) => {
    if (fn != null) {
      result = fn.apply<T, A, R>(context, args)
      ;(fn as unknown as undefined) = (context as unknown as undefined) =
        undefined
    }
    return result
  }
}
