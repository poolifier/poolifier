import { existsSync } from 'node:fs'
import cluster, { Worker as ClusterWorker } from 'node:cluster'
import {
  SHARE_ENV,
  Worker as ThreadWorker,
  type WorkerOptions
} from 'node:worker_threads'
import { env } from 'node:process'
import { randomInt } from 'node:crypto'
import { cpus } from 'node:os'
import { average, isPlainObject, max, median, min } from '../utils.js'
import type { MessageValue, Task } from '../utility-types.js'
import {
  type MeasurementStatisticsRequirements,
  WorkerChoiceStrategies,
  type WorkerChoiceStrategy,
  type WorkerChoiceStrategyOptions
} from './selection-strategies/selection-strategies-types.js'
import type { IPool, TasksQueueOptions } from './pool.js'
import {
  type IWorker,
  type IWorkerNode,
  type MeasurementStatistics,
  type WorkerNodeOptions,
  type WorkerType,
  WorkerTypes,
  type WorkerUsage
} from './worker.js'
import type { WorkerChoiceStrategyContext } from './selection-strategies/worker-choice-strategy-context.js'

/**
 * Default measurement statistics requirements.
 */
export const DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS: MeasurementStatisticsRequirements =
  {
    aggregate: false,
    average: false,
    median: false
  }

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

export const getWorkerChoiceStrategyRetries = <
  Worker extends IWorker,
  Data,
  Response
>(
    pool: IPool<Worker, Data, Response>,
    opts?: WorkerChoiceStrategyOptions
  ): number => {
  return (
    pool.info.maxSize +
    Object.keys(opts?.weights ?? getDefaultWeights(pool.info.maxSize)).length
  )
}

export const buildWorkerChoiceStrategyOptions = <
  Worker extends IWorker,
  Data,
  Response
>(
    pool: IPool<Worker, Data, Response>,
    opts?: WorkerChoiceStrategyOptions
  ): WorkerChoiceStrategyOptions => {
  opts = clone(opts ?? {})
  opts.weights = opts.weights ?? getDefaultWeights(pool.info.maxSize)
  return {
    ...{
      runTime: { median: false },
      waitTime: { median: false },
      elu: { median: false }
    },
    ...opts
  }
}

const clone = <T>(object: T): T => {
  return structuredClone<T>(object)
}

const getDefaultWeights = (
  poolMaxSize: number,
  defaultWorkerWeight?: number
): Record<number, number> => {
  defaultWorkerWeight = defaultWorkerWeight ?? getDefaultWorkerWeight()
  const weights: Record<number, number> = {}
  for (let workerNodeKey = 0; workerNodeKey < poolMaxSize; workerNodeKey++) {
    weights[workerNodeKey] = defaultWorkerWeight
  }
  return weights
}

const getDefaultWorkerWeight = (): number => {
  const cpuSpeed = randomInt(500, 2500)
  let cpusCycleTimeWeight = 0
  for (const cpu of cpus()) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (cpu.speed == null || cpu.speed === 0) {
      cpu.speed =
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        cpus().find(cpu => cpu.speed != null && cpu.speed !== 0)?.speed ??
        cpuSpeed
    }
    // CPU estimated cycle time
    const numberOfDigits = cpu.speed.toString().length - 1
    const cpuCycleTime = 1 / (cpu.speed / Math.pow(10, numberOfDigits))
    cpusCycleTimeWeight += cpuCycleTime * Math.pow(10, numberOfDigits)
  }
  return Math.round(cpusCycleTimeWeight / cpus().length)
}

export const checkFilePath = (filePath: string | undefined): void => {
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

export const checkDynamicPoolSize = (
  min: number,
  max: number | undefined
): void => {
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
  workerChoiceStrategy: WorkerChoiceStrategy | undefined
): void => {
  if (
    workerChoiceStrategy != null &&
    !Object.values(WorkerChoiceStrategies).includes(workerChoiceStrategy)
  ) {
    throw new Error(`Invalid worker choice strategy '${workerChoiceStrategy}'`)
  }
}

export const checkValidTasksQueueOptions = (
  tasksQueueOptions: TasksQueueOptions | undefined
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
  type: WorkerType | undefined,
  filePath: string | undefined,
  opts: WorkerNodeOptions | undefined
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
 * @internal
 */
const updateMeasurementStatistics = (
  measurementStatistics: MeasurementStatistics,
  measurementRequirements: MeasurementStatisticsRequirements | undefined,
  measurementValue: number | undefined
): void => {
  if (
    measurementRequirements != null &&
    measurementValue != null &&
    measurementRequirements.aggregate
  ) {
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
    if (measurementRequirements.average || measurementRequirements.median) {
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
    workerChoiceStrategyContext:
    | WorkerChoiceStrategyContext<Worker, Data, Response>
    | undefined,
    workerUsage: WorkerUsage,
    task: Task<Data>
  ): void => {
  const timestamp = performance.now()
  const taskWaitTime = timestamp - (task.timestamp ?? timestamp)
  updateMeasurementStatistics(
    workerUsage.waitTime,
    workerChoiceStrategyContext?.getTaskStatisticsRequirements().waitTime,
    taskWaitTime
  )
}

export const updateTaskStatisticsWorkerUsage = <Response = unknown>(
  workerUsage: WorkerUsage,
  message: MessageValue<Response>
): void => {
  const workerTaskStatistics = workerUsage.tasks
  if (
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
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
    workerChoiceStrategyContext:
    | WorkerChoiceStrategyContext<Worker, Data, Response>
    | undefined,
    workerUsage: WorkerUsage,
    message: MessageValue<Response>
  ): void => {
  if (message.workerError != null) {
    return
  }
  updateMeasurementStatistics(
    workerUsage.runTime,
    workerChoiceStrategyContext?.getTaskStatisticsRequirements().runTime,
    message.taskPerformance?.runTime ?? 0
  )
}

export const updateEluWorkerUsage = <
  Worker extends IWorker,
  Data = unknown,
  Response = unknown
>(
    workerChoiceStrategyContext:
    | WorkerChoiceStrategyContext<Worker, Data, Response>
    | undefined,
    workerUsage: WorkerUsage,
    message: MessageValue<Response>
  ): void => {
  if (message.workerError != null) {
    return
  }
  const eluTaskStatisticsRequirements =
    workerChoiceStrategyContext?.getTaskStatisticsRequirements().elu
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
  if (eluTaskStatisticsRequirements?.aggregate === true) {
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
      return new ThreadWorker(filePath, {
        env: SHARE_ENV,
        ...opts.workerOptions
      }) as unknown as Worker
    case WorkerTypes.cluster:
      return cluster.fork(opts.env) as unknown as Worker
    default:
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      throw new Error(`Unknown worker type '${type}'`)
  }
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
    if (timeout >= 0) {
      setTimeout(() => {
        resolve(events)
      }, timeout)
    }
  })
}
