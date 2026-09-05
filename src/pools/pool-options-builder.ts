import type { PoolOptions, TasksQueueOptions } from './pool.js'
import type { WorkerChoiceStrategyOptions } from './selection-strategies/selection-strategies-types.js'
import type { IWorker } from './worker.js'

import { isPlainObject } from '../utils.js'
import {
  Measurements,
  WorkerChoiceStrategies,
} from './selection-strategies/selection-strategies-types.js'
import {
  checkValidTasksQueueOptions,
  checkValidWorkerChoiceStrategy,
  checkValidWorkerRestartPolicyOptions,
  getDefaultTasksQueueOptions,
} from './utils.js'

export const checkValidWorkerChoiceStrategyOptions = (
  workerChoiceStrategyOptions: undefined | WorkerChoiceStrategyOptions,
  poolMaxSize: number
): void => {
  if (
    workerChoiceStrategyOptions != null &&
    !isPlainObject(workerChoiceStrategyOptions)
  ) {
    throw new TypeError(
      'Invalid worker choice strategy options: must be a plain object'
    )
  }
  if (
    workerChoiceStrategyOptions?.weights != null &&
    Object.keys(workerChoiceStrategyOptions.weights).length !== poolMaxSize
  ) {
    throw new Error(
      'Invalid worker choice strategy options: must have a weight for each worker node'
    )
  }
  if (
    workerChoiceStrategyOptions?.measurement != null &&
    !Object.values(Measurements).includes(
      workerChoiceStrategyOptions.measurement
    )
  ) {
    throw new Error(
      `Invalid worker choice strategy options: invalid measurement '${workerChoiceStrategyOptions.measurement}'`
    )
  }
}

export const mergeTasksQueueOptions = (
  poolMaxSize: number,
  current: TasksQueueOptions | undefined,
  update: TasksQueueOptions | undefined
): TasksQueueOptions => {
  return {
    ...getDefaultTasksQueueOptions(poolMaxSize),
    ...current,
    ...update,
  }
}

export const buildPoolOptions = <Worker extends IWorker>(
  opts: PoolOptions<Worker>,
  poolMaxSize: number
): PoolOptions<Worker> => {
  if (!isPlainObject(opts)) {
    throw new TypeError('Invalid pool options: must be a plain object')
  }
  checkValidWorkerChoiceStrategy(opts.workerChoiceStrategy)
  checkValidWorkerChoiceStrategyOptions(
    opts.workerChoiceStrategyOptions,
    poolMaxSize
  )
  const enableTasksQueue = opts.enableTasksQueue ?? false
  if (enableTasksQueue) {
    checkValidTasksQueueOptions(opts.tasksQueueOptions)
  }
  checkValidWorkerRestartPolicyOptions(opts.restartPolicy)
  return {
    ...opts,
    enableEvents: opts.enableEvents ?? true,
    enableTasksQueue,
    restartWorkerOnError: opts.restartWorkerOnError ?? true,
    startWorkers: opts.startWorkers ?? true,
    ...(opts.restartPolicy != null && {
      restartPolicy: { ...opts.restartPolicy },
    }),
    ...(enableTasksQueue
      ? {
          tasksQueueOptions: {
            ...getDefaultTasksQueueOptions(poolMaxSize),
            ...opts.tasksQueueOptions,
          },
        }
      : opts.tasksQueueOptions != null
        ? { tasksQueueOptions: { ...opts.tasksQueueOptions } }
        : {}),
    workerChoiceStrategy:
      opts.workerChoiceStrategy ?? WorkerChoiceStrategies.LEAST_USED,
    ...(opts.workerChoiceStrategyOptions != null && {
      workerChoiceStrategyOptions: { ...opts.workerChoiceStrategyOptions },
    }),
  }
}
