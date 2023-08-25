import * as os from 'node:os'
import type {
  MeasurementStatisticsRequirements,
  WorkerChoiceStrategyOptions
} from './pools/selection-strategies/selection-strategies-types'
import type { KillBehavior } from './worker/worker-options'
import type { MeasurementStatistics } from './pools/worker'

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
 * Default worker choice strategy options.
 */
export const DEFAULT_WORKER_CHOICE_STRATEGY_OPTIONS: WorkerChoiceStrategyOptions =
  {
    choiceRetries: 6,
    runTime: { median: false },
    waitTime: { median: false },
    elu: { median: false }
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
 * @internal
 */
export const availableParallelism = (): number => {
  let availableParallelism = 1
  try {
    availableParallelism = os.availableParallelism()
  } catch {
    const numberOfCpus = os.cpus()
    if (Array.isArray(numberOfCpus) && numberOfCpus.length > 0) {
      availableParallelism = numberOfCpus.length
    }
  }
  return availableParallelism
}

/**
 * Sleeps for the given amount of milliseconds.
 *
 * @param ms - The amount of milliseconds to sleep.
 * @returns A promise that resolves after the given amount of milliseconds.
 */
export const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

/**
 * Computes the retry delay in milliseconds using an exponential back off algorithm.
 *
 * @param retryNumber - The number of retries that have already been attempted
 * @param maxDelayRatio - The maximum ratio of the delay that can be randomized
 * @returns Delay in milliseconds
 * @internal
 */
export const exponentialDelay = (
  retryNumber = 0,
  maxDelayRatio = 0.2
): number => {
  const delay = Math.pow(2, retryNumber) * 100
  const randomSum = delay * maxDelayRatio * secureRandom() // 0-(maxDelayRatio*100)% of the delay
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
 */
export const isAsyncFunction = (
  fn: unknown
): fn is (...args: unknown[]) => Promise<unknown> => {
  return typeof fn === 'function' && fn.constructor.name === 'AsyncFunction'
}

/**
 * Updates the given measurement statistics.
 *
 * @param measurementStatistics - The measurement statistics to update.
 * @param measurementRequirements - The measurement statistics requirements.
 * @param measurementValue - The measurement value.
 * @param numberOfMeasurements - The number of measurements.
 * @internal
 */
export const updateMeasurementStatistics = (
  measurementStatistics: MeasurementStatistics,
  measurementRequirements: MeasurementStatisticsRequirements,
  measurementValue: number
): void => {
  if (measurementRequirements.aggregate) {
    measurementStatistics.aggregate =
      (measurementStatistics.aggregate ?? 0) + measurementValue
    measurementStatistics.minimum = Math.min(
      measurementValue,
      measurementStatistics.minimum ?? Infinity
    )
    measurementStatistics.maximum = Math.max(
      measurementValue,
      measurementStatistics.maximum ?? -Infinity
    )
    if (
      (measurementRequirements.average || measurementRequirements.median) &&
      measurementValue != null
    ) {
      measurementStatistics.history.push(measurementValue)
      if (measurementRequirements.average) {
        measurementStatistics.average = average(measurementStatistics.history)
      }
      if (measurementRequirements.median) {
        measurementStatistics.median = median(measurementStatistics.history)
      }
    }
  }
}

/**
 * Executes a function once at a time.
 *
 * @param fn - The function to execute.
 * @param context - The context to bind the function to.
 * @returns The function to execute.
 */
export const once = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fn: (...args: any[]) => void,
  context: unknown
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): ((...args: any[]) => void) => {
  let called = false
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function (...args: any[]): void {
    if (!called) {
      called = true
      fn.apply(context, args)
      called = false
    }
  }
}

/**
 * Generate a cryptographically secure random number in the [0,1[ range
 *
 * @returns A number in the [0,1[ range
 */
const secureRandom = (): number => {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 0x100000000
}
