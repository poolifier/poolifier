import type { CircularArray } from '../circular-array'

/**
 * Callback invoked if the worker has received a message.
 */
export type MessageHandler<Worker extends IWorker> = (
  this: Worker,
  message: unknown
) => void

/**
 * Callback invoked if the worker raised an error.
 */
export type ErrorHandler<Worker extends IWorker> = (
  this: Worker,
  error: Error
) => void

/**
 * Callback invoked when the worker has started successfully.
 */
export type OnlineHandler<Worker extends IWorker> = (this: Worker) => void

/**
 * Callback invoked when the worker exits successfully.
 */
export type ExitHandler<Worker extends IWorker> = (
  this: Worker,
  exitCode: number
) => void

/**
 * Message object that is passed as a task between main worker and worker.
 *
 * @typeParam Data - Type of data sent to the worker. This can only be structured-cloneable data.
 * @internal
 */
export interface Task<Data = unknown> {
  /**
   * Worker id.
   */
  readonly workerId: number
  /**
   * Task name.
   */
  readonly name?: string
  /**
   * Task input data that will be passed to the worker.
   */
  readonly data?: Data
  /**
   * Timestamp.
   */
  readonly timestamp?: number
  /**
   * Message UUID.
   */
  readonly id?: string
}

/**
 * Measurement statistics.
 *
 * @internal
 */
export interface MeasurementStatistics {
  /**
   * Measurement aggregate.
   */
  aggregate?: number
  /**
   * Measurement minimum.
   */
  minimum?: number
  /**
   * Measurement maximum.
   */
  maximum?: number
  /**
   * Measurement average.
   */
  average?: number
  /**
   * Measurement median.
   */
  median?: number
  /**
   * Measurement history.
   */
  readonly history: CircularArray<number>
}

/**
 * Event loop utilization measurement statistics.
 *
 * @internal
 */
export interface EventLoopUtilizationMeasurementStatistics {
  readonly idle: MeasurementStatistics
  readonly active: MeasurementStatistics
  utilization?: number
}

/**
 * Task statistics.
 *
 * @internal
 */
export interface TaskStatistics {
  /**
   * Number of executed tasks.
   */
  executed: number
  /**
   * Number of executing tasks.
   */
  executing: number
  /**
   * Number of queued tasks.
   */
  readonly queued: number
  /**
   * Maximum number of queued tasks.
   */
  readonly maxQueued: number
  /**
   * Number of failed tasks.
   */
  failed: number
}

/**
 * Enumeration of worker types.
 */
export const WorkerTypes = Object.freeze({
  cluster: 'cluster',
  thread: 'thread'
} as const)

/**
 * Worker type.
 */
export type WorkerType = keyof typeof WorkerTypes

/**
 * Worker information.
 *
 * @internal
 */
export interface WorkerInfo {
  /**
   * Worker id.
   */
  readonly id: number | undefined
  /**
   * Worker type.
   */
  type: WorkerType
  /**
   * Dynamic flag.
   */
  dynamic: boolean
  /**
   * Ready flag.
   */
  ready: boolean
}

/**
 * Worker usage statistics.
 *
 * @internal
 */
export interface WorkerUsage {
  /**
   * Tasks statistics.
   */
  readonly tasks: TaskStatistics
  /**
   * Tasks runtime statistics.
   */
  readonly runTime: MeasurementStatistics
  /**
   * Tasks wait time statistics.
   */
  readonly waitTime: MeasurementStatistics
  /**
   * Tasks event loop utilization statistics.
   */
  readonly elu: EventLoopUtilizationMeasurementStatistics
}

/**
 * Worker interface.
 */
export interface IWorker {
  /**
   * Worker id.
   */
  readonly id?: number
  readonly threadId?: number
  /**
   * Registers an event listener.
   *
   * @param event - The event.
   * @param handler - The event handler.
   */
  readonly on: ((event: 'message', handler: MessageHandler<this>) => void) &
  ((event: 'error', handler: ErrorHandler<this>) => void) &
  ((event: 'online', handler: OnlineHandler<this>) => void) &
  ((event: 'exit', handler: ExitHandler<this>) => void)
  /**
   * Registers a listener to the exit event that will only be performed once.
   *
   * @param event - `'exit'`.
   * @param handler - The exit handler.
   */
  readonly once: (event: 'exit', handler: ExitHandler<this>) => void
}

/**
 * Worker node interface.
 *
 * @typeParam Worker - Type of worker.
 * @typeParam Data - Type of data sent to the worker. This can only be structured-cloneable data.
 * @internal
 */
export interface IWorkerNode<Worker extends IWorker, Data = unknown> {
  /**
   * Worker node worker.
   */
  readonly worker: Worker
  /**
   * Worker node worker info.
   */
  readonly info: WorkerInfo
  /**
   * Worker node worker usage statistics.
   */
  usage: WorkerUsage
  /**
   * Worker node tasks queue size.
   *
   * @returns The tasks queue size.
   */
  readonly tasksQueueSize: () => number
  /**
   * Worker node enqueue task.
   *
   * @param task - The task to queue.
   * @returns The task queue size.
   */
  readonly enqueueTask: (task: Task<Data>) => number
  /**
   * Worker node dequeue task.
   *
   * @returns The dequeued task.
   */
  readonly dequeueTask: () => Task<Data> | undefined
  /**
   * Worker node clear tasks queue.
   */
  readonly clearTasksQueue: () => void
  /**
   * Worker node reset usage statistics .
   */
  readonly resetUsage: () => void
  /**
   * Worker node get tasks usage statistics.
   */
  readonly getTasksWorkerUsage: (name: string) => WorkerUsage | undefined
}
