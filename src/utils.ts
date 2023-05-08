import type { WorkerChoiceStrategyOptions } from './pools/selection-strategies/selection-strategies-types'

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
    medRunTime: false
  }

/**
 * Compute the median of the given data set.
 *
 * @param dataSet - Data set.
 * @returns The median of the given data set.
 */
export const median = (dataSet: number[]): number => {
  if (Array.isArray(dataSet) && dataSet.length === 1) {
    return dataSet[0]
  }
  dataSet = [...dataSet].slice().sort((a, b) => a - b)
  return (dataSet[(dataSet.length - 1) >> 1] + dataSet[dataSet.length >> 1]) / 2
}

export const isPlainObject = (obj: unknown): boolean =>
  typeof obj === 'object' &&
  obj !== null &&
  obj?.constructor === Object &&
  Object.prototype.toString.call(obj) === '[object Object]'
