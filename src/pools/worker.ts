import type { MessageChannel } from 'node:worker_threads'
import type { CircularArray } from '../circular-array'
import type { Task } from '../utility-types'
import type { Deque } from '../deque'

/**
 * Callback invoked when the worker has started successfully.
 *
 * @typeParam Worker - Type of worker.
 */
export type OnlineHandler<Worker extends IWorker> = (this: Worker) => void

/**
 * Callback invoked if the worker has received a message.
 *
 * @typeParam Worker - Type of worker.
 */
export type MessageHandler<Worker extends IWorker> = (
  this: Worker,
  message: unknown
) => void

/**
 * Callback invoked if the worker raised an error.
 *
 * @typeParam Worker - Type of worker.
 */
export type ErrorHandler<Worker extends IWorker> = (
  this: Worker,
  error: Error
) => void

/**
 * Callback invoked when the worker exits successfully.
 *
 * @typeParam Worker - Type of worker.
 */
export type ExitHandler<Worker extends IWorker> = (
  this: Worker,
  exitCode: number
) => void

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
  readonly maxQueued?: number
  /**
   * Number of stolen tasks.
   */
  stolen: number
  /**
   * Number of failed tasks.
   */
  failed: number
}

/**
 * Enumeration of worker types.
 */
export const WorkerTypes = Object.freeze({
  thread: 'thread',
  cluster: 'cluster'
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
  readonly type: WorkerType
  /**
   * Dynamic flag.
   */
  dynamic: boolean
  /**
   * Ready flag.
   */
  ready: boolean
  /**
   * Task function names.
   */
  taskFunctionNames?: string[]
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
 * Worker choice strategy data.
 *
 * @internal
 */
export interface StrategyData {
  virtualTaskEndTimestamp?: number
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
  readonly on: ((event: 'online', handler: OnlineHandler<this>) => void) &
  ((event: 'message', handler: MessageHandler<this>) => void) &
  ((event: 'error', handler: ErrorHandler<this>) => void) &
  ((event: 'exit', handler: ExitHandler<this>) => void)
  /**
   * Registers a listener to the exit event that will only be performed once.
   *
   * @param event - The `'exit'` event.
   * @param handler - The exit handler.
   */
  readonly once: (event: 'exit', handler: ExitHandler<this>) => void
}

/**
 * Worker node event detail.
 *
 * @internal
 */
export interface WorkerNodeEventDetail {
  workerId: number
  taskId?: string
}

/**
 * Worker node interface.
 *
 * @typeParam Worker - Type of worker.
 * @typeParam Data - Type of data sent to the worker. This can only be structured-cloneable data.
 * @internal
 */
export interface IWorkerNode<Worker extends IWorker, Data = unknown>
  extends EventTarget {
  /**
   * Worker.
   */
  readonly worker: Worker
  /**
   * Worker info.
   */
  readonly info: WorkerInfo
  /**
   * Worker usage statistics.
   */
  readonly usage: WorkerUsage
  /**
   * Worker choice strategy data.
   * This is used to store data that are specific to the worker choice strategy.
   */
  strategyData?: StrategyData
  /**
   * Message channel (worker_threads only).
   */
  readonly messageChannel?: MessageChannel
  /**
   * Tasks queue.
   */
  readonly tasksQueue: Deque<Task<Data>>
  /**
   * Tasks queue back pressure size.
   * This is the number of tasks that can be enqueued before the worker node has back pressure.
   */
  tasksQueueBackPressureSize: number
  /**
   * Tasks queue size.
   *
   * @returns The tasks queue size.
   */
  readonly tasksQueueSize: () => number
  /**
   * Enqueue task.
   *
   * @param task - The task to queue.
   * @returns The tasks queue size.
   */
  readonly enqueueTask: (task: Task<Data>) => number
  /**
   * Prepends a task to the tasks queue.
   *
   * @param task - The task to prepend.
   * @returns The tasks queue size.
   */
  readonly unshiftTask: (task: Task<Data>) => number
  /**
   * Dequeue task.
   *
   * @returns The dequeued task.
   */
  readonly dequeueTask: () => Task<Data> | undefined
  /**
   * Pops a task from the tasks queue.
   *
   * @returns The popped task.
   */
  readonly popTask: () => Task<Data> | undefined
  /**
   * Deletes a task from the tasks queue.
   *
   * @returns `true` if the task was deleted, `false` otherwise.
   */
  readonly deleteTask: (task: Task<Data>) => boolean
  /**
   * Clears tasks queue.
   */
  readonly clearTasksQueue: () => void
  /**
   * Whether the worker node has back pressure (i.e. its tasks queue is full).
   *
   * @returns `true` if the worker node has back pressure, `false` otherwise.
   */
  readonly hasBackPressure: () => boolean
  /**
   * Resets usage statistics.
   */
  readonly resetUsage: () => void
  /**
   * Closes communication channel.
   */
  readonly closeChannel: () => void
  /**
   * Gets task function worker usage statistics.
   *
   * @param name - The task function name.
   * @returns The task function worker usage statistics if the task function worker usage statistics are initialized, `undefined` otherwise.
   */
  readonly getTaskFunctionWorkerUsage: (name: string) => WorkerUsage | undefined
  /**
   * Deletes task function worker usage statistics.
   *
   * @param name - The task function name.
   * @returns `true` if the task function worker usage statistics were deleted, `false` otherwise.
   */
  readonly deleteTaskFunctionWorkerUsage: (name: string) => boolean
}
