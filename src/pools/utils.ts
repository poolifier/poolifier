import { existsSync } from 'node:fs'
import cluster from 'node:cluster'
import { SHARE_ENV, Worker, type WorkerOptions } from 'node:worker_threads'
import { average, isPlainObject, max, median, min } from '../utils'
import {
  type MeasurementStatisticsRequirements,
  WorkerChoiceStrategies,
  type WorkerChoiceStrategy
} from './selection-strategies/selection-strategies-types'
import type { TasksQueueOptions } from './pool'
import {
  type IWorker,
  type MeasurementStatistics,
  type WorkerNodeOptions,
  type WorkerType,
  WorkerTypes
} from './worker'

export const checkFilePath = (filePath: string): void => {
  if (filePath == null) {
    throw new TypeError('The worker file path must be specified')
  }
  if (typeof filePath !== 'string') {
    throw new TypeError('The worker file path must be a string')
  }
  if (!existsSync(filePath)) {
    throw new Error(`Cannot find the worker file '${filePath}'`)
  }
}

export const checkDynamicPoolSize = (min: number, max: number): void => {
  if (max == null) {
    throw new TypeError(
      'Cannot instantiate a dynamic pool without specifying the maximum pool size'
    )
  } else if (!Number.isSafeInteger(max)) {
    throw new TypeError(
      'Cannot instantiate a dynamic pool with a non safe integer maximum pool size'
    )
  } else if (min > max) {
    throw new RangeError(
      'Cannot instantiate a dynamic pool with a maximum pool size inferior to the minimum pool size'
    )
  } else if (max === 0) {
    throw new RangeError(
      'Cannot instantiate a dynamic pool with a maximum pool size equal to zero'
    )
  } else if (min === max) {
    throw new RangeError(
      'Cannot instantiate a dynamic pool with a minimum pool size equal to the maximum pool size. Use a fixed pool instead'
    )
  }
}

export const checkValidWorkerChoiceStrategy = (
  workerChoiceStrategy: WorkerChoiceStrategy
): void => {
  if (
    workerChoiceStrategy != null &&
    !Object.values(WorkerChoiceStrategies).includes(workerChoiceStrategy)
  ) {
    throw new Error(`Invalid worker choice strategy '${workerChoiceStrategy}'`)
  }
}

export const checkValidTasksQueueOptions = (
  tasksQueueOptions: TasksQueueOptions
): void => {
  if (tasksQueueOptions != null && !isPlainObject(tasksQueueOptions)) {
    throw new TypeError('Invalid tasks queue options: must be a plain object')
  }
  if (
    tasksQueueOptions?.concurrency != null &&
    !Number.isSafeInteger(tasksQueueOptions.concurrency)
  ) {
    throw new TypeError(
      'Invalid worker node tasks concurrency: must be an integer'
    )
  }
  if (
    tasksQueueOptions?.concurrency != null &&
    tasksQueueOptions.concurrency <= 0
  ) {
    throw new RangeError(
      `Invalid worker node tasks concurrency: ${tasksQueueOptions.concurrency} is a negative integer or zero`
    )
  }
  if (
    tasksQueueOptions?.size != null &&
    !Number.isSafeInteger(tasksQueueOptions.size)
  ) {
    throw new TypeError(
      'Invalid worker node tasks queue size: must be an integer'
    )
  }
  if (tasksQueueOptions?.size != null && tasksQueueOptions.size <= 0) {
    throw new RangeError(
      `Invalid worker node tasks queue size: ${tasksQueueOptions.size} is a negative integer or zero`
    )
  }
}

export const checkWorkerNodeArguments = (
  type: WorkerType,
  filePath: string,
  opts: WorkerNodeOptions
): void => {
  if (type == null) {
    throw new TypeError('Cannot construct a worker node without a worker type')
  }
  if (!Object.values(WorkerTypes).includes(type)) {
    throw new TypeError(
      `Cannot construct a worker node with an invalid worker type '${type}'`
    )
  }
  checkFilePath(filePath)
  if (opts == null) {
    throw new TypeError(
      'Cannot construct a worker node without worker node options'
    )
  }
  if (opts != null && !isPlainObject(opts)) {
    throw new TypeError(
      'Cannot construct a worker node with invalid options: must be a plain object'
    )
  }
  if (opts.tasksQueueBackPressureSize == null) {
    throw new TypeError(
      'Cannot construct a worker node without a tasks queue back pressure size option'
    )
  }
  if (!Number.isSafeInteger(opts.tasksQueueBackPressureSize)) {
    throw new TypeError(
      'Cannot construct a worker node with a tasks queue back pressure size option that is not an integer'
    )
  }
  if (opts.tasksQueueBackPressureSize <= 0) {
    throw new RangeError(
      'Cannot construct a worker node with a tasks queue back pressure size option that is not a positive integer'
    )
  }
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
    measurementStatistics.minimum = min(
      measurementValue,
      measurementStatistics.minimum ?? Infinity
    )
    measurementStatistics.maximum = max(
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
      } else if (measurementStatistics.average != null) {
        delete measurementStatistics.average
      }
      if (measurementRequirements.median) {
        measurementStatistics.median = median(measurementStatistics.history)
      } else if (measurementStatistics.median != null) {
        delete measurementStatistics.median
      }
    }
  }
}

export const createWorker = <Worker extends IWorker>(
  type: WorkerType,
  filePath: string,
  opts: { env?: Record<string, unknown>, workerOptions?: WorkerOptions }
): Worker => {
  switch (type) {
    case WorkerTypes.thread:
      return new Worker(filePath, {
        env: SHARE_ENV,
        ...opts?.workerOptions
      }) as unknown as Worker
    case WorkerTypes.cluster:
      return cluster.fork(opts?.env) as unknown as Worker
    default:
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      throw new Error(`Unknown worker type '${type}'`)
  }
}
