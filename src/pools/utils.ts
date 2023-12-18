import { existsSync } from 'node:fs'
import cluster from 'node:cluster'
import { SHARE_ENV, Worker, type WorkerOptions } from 'node:worker_threads'
import { env } from 'node:process'
import { average, isPlainObject, max, median, min } from '../utils'
import type { MessageValue, Task } from '../utility-types'
import {
  type MeasurementStatisticsRequirements,
  WorkerChoiceStrategies,
  type WorkerChoiceStrategy
} from './selection-strategies/selection-strategies-types'
import type { TasksQueueOptions } from './pool'
import {
  type IWorker,
  type IWorkerNode,
  type MeasurementStatistics,
  type WorkerNodeOptions,
  type WorkerType,
  WorkerTypes,
  type WorkerUsage
} from './worker'
import type { WorkerChoiceStrategyContext } from './selection-strategies/worker-choice-strategy-context'

export const getDefaultTasksQueueOptions = (
  poolMaxSize: number
): Required<TasksQueueOptions> => {
  return {
    size: Math.pow(poolMaxSize, 2),
    concurrency: 1,
    taskStealing: true,
    tasksStealingOnBackPressure: true,
    tasksFinishedTimeout: 2000
  }
}

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
  if (!isPlainObject(opts)) {
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
const updateMeasurementStatistics = (
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
if (env.NODE_ENV === 'test') {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  exports.updateMeasurementStatistics = updateMeasurementStatistics
}

export const updateWaitTimeWorkerUsage = <
  Worker extends IWorker,
  Data = unknown,
  Response = unknown
>(
    workerChoiceStrategyContext: WorkerChoiceStrategyContext<
    Worker,
    Data,
    Response
    >,
    workerUsage: WorkerUsage,
    task: Task<Data>
  ): void => {
  const timestamp = performance.now()
  const taskWaitTime = timestamp - (task.timestamp ?? timestamp)
  updateMeasurementStatistics(
    workerUsage.waitTime,
    workerChoiceStrategyContext.getTaskStatisticsRequirements().waitTime,
    taskWaitTime
  )
}

export const updateTaskStatisticsWorkerUsage = <Response = unknown>(
  workerUsage: WorkerUsage,
  message: MessageValue<Response>
): void => {
  const workerTaskStatistics = workerUsage.tasks
  if (
    workerTaskStatistics.executing != null &&
    workerTaskStatistics.executing > 0
  ) {
    --workerTaskStatistics.executing
  }
  if (message.workerError == null) {
    ++workerTaskStatistics.executed
  } else {
    ++workerTaskStatistics.failed
  }
}

export const updateRunTimeWorkerUsage = <
  Worker extends IWorker,
  Data = unknown,
  Response = unknown
>(
    workerChoiceStrategyContext: WorkerChoiceStrategyContext<
    Worker,
    Data,
    Response
    >,
    workerUsage: WorkerUsage,
    message: MessageValue<Response>
  ): void => {
  if (message.workerError != null) {
    return
  }
  updateMeasurementStatistics(
    workerUsage.runTime,
    workerChoiceStrategyContext.getTaskStatisticsRequirements().runTime,
    message.taskPerformance?.runTime ?? 0
  )
}

export const updateEluWorkerUsage = <
  Worker extends IWorker,
  Data = unknown,
  Response = unknown
>(
    workerChoiceStrategyContext: WorkerChoiceStrategyContext<
    Worker,
    Data,
    Response
    >,
    workerUsage: WorkerUsage,
    message: MessageValue<Response>
  ): void => {
  if (message.workerError != null) {
    return
  }
  const eluTaskStatisticsRequirements: MeasurementStatisticsRequirements =
    workerChoiceStrategyContext.getTaskStatisticsRequirements().elu
  updateMeasurementStatistics(
    workerUsage.elu.active,
    eluTaskStatisticsRequirements,
    message.taskPerformance?.elu?.active ?? 0
  )
  updateMeasurementStatistics(
    workerUsage.elu.idle,
    eluTaskStatisticsRequirements,
    message.taskPerformance?.elu?.idle ?? 0
  )
  if (eluTaskStatisticsRequirements.aggregate) {
    if (message.taskPerformance?.elu != null) {
      if (workerUsage.elu.utilization != null) {
        workerUsage.elu.utilization =
          (workerUsage.elu.utilization +
            message.taskPerformance.elu.utilization) /
          2
      } else {
        workerUsage.elu.utilization = message.taskPerformance.elu.utilization
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

export const waitWorkerNodeEvents = async <
  Worker extends IWorker,
  Data = unknown
>(
  workerNode: IWorkerNode<Worker, Data>,
  workerNodeEvent: string,
  numberOfEventsToWait: number,
  timeout: number
): Promise<number> => {
  return await new Promise<number>(resolve => {
    let events = 0
    if (numberOfEventsToWait === 0) {
      resolve(events)
      return
    }
    workerNode.on(workerNodeEvent, () => {
      ++events
      if (events === numberOfEventsToWait) {
        resolve(events)
      }
    })
    if (timeout > 0) {
      setTimeout(() => {
        resolve(events)
      }, timeout)
    }
  })
}
