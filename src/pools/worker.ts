import type { EventEmitter } from 'node:events'
import type { MessageChannel, WorkerOptions } from 'node:worker_threads'

import type { CircularBuffer } from '../circular-buffer.js'
import type { PriorityQueue } from '../queues/priority-queue.js'
import type { Task, TaskFunctionProperties } from '../utility-types.js'

/**
 * Callback invoked when the worker has started successfully.
 * @typeParam Worker - Type of worker.
 */
export type OnlineHandler<Worker extends IWorker> = (this: Worker) => void

/**
 * Callback invoked if the worker has received a message.
 * @typeParam Worker - Type of worker.
 */
export type MessageHandler<Worker extends IWorker> = (
  this: Worker,
  message: unknown
) => void

/**
 * Callback invoked if the worker raised an error.
 * @typeParam Worker - Type of worker.
 */
export type ErrorHandler<Worker extends IWorker> = (
  this: Worker,
  error: Error
) => void

/**
 * Callback invoked when the worker exits successfully.
 * @typeParam Worker - Type of worker.
 */
export type ExitHandler<Worker extends IWorker> = (
  this: Worker,
  exitCode: number
) => void

/**
 * Worker event handler.
 * @typeParam Worker - Type of worker.
 */
export type EventHandler<Worker extends IWorker> =
  | OnlineHandler<Worker>
  | MessageHandler<Worker>
  | ErrorHandler<Worker>
  | ExitHandler<Worker>

/**
 * Measurement history size.
 */
export const MeasurementHistorySize = 386

/**
 * Measurement statistics.
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
  readonly history: CircularBuffer
}

/**
 * Event loop utilization measurement statistics.
 * @internal
 */
export interface EventLoopUtilizationMeasurementStatistics {
  readonly idle: MeasurementStatistics
  readonly active: MeasurementStatistics
  utilization?: number
}

/**
 * Task statistics.
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
   * Number of sequentially stolen tasks.
   */
  sequentiallyStolen: number
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
export const WorkerTypes: Readonly<{ thread: 'thread'; cluster: 'cluster' }> =
  Object.freeze({
    thread: 'thread',
    cluster: 'cluster',
  } as const)

/**
 * Worker type.
 */
export type WorkerType = keyof typeof WorkerTypes

/**
 * Worker information.
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
   * Stealing flag.
   * This flag is set to `true` when worker node is stealing tasks from another worker node.
   */
  stealing: boolean
  /**
   * Back pressure flag.
   * This flag is set to `true` when worker node tasks queue has back pressure.
   */
  backPressure: boolean
  /**
   * Task functions properties.
   */
  taskFunctionsProperties?: TaskFunctionProperties[]
}

/**
 * Worker usage statistics.
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
 * @internal
 */
export interface StrategyData {
  virtualTaskEndTimestamp?: number
}

/**
 * Worker interface.
 */
export interface IWorker extends EventEmitter {
  /**
   * Cluster worker id.
   */
  readonly id?: number
  /**
   * Worker thread worker id.
   */
  readonly threadId?: number
  /**
   * Registers an event handler.
   * @param event - The event.
   * @param handler - The event handler.
   */
  readonly on: (event: string, handler: EventHandler<this>) => this
  /**
   * Registers once an event handler.
   * @param event - The event.
   * @param handler - The event handler.
   */
  readonly once: (event: string, handler: EventHandler<this>) => this
  /**
   * Calling `unref()` on a worker allows the thread to exit if this is the only
   * active handle in the event system. If the worker is already `unref()`ed calling`unref()` again has no effect.
   * @since v10.5.0
   */
  readonly unref?: () => void
  /**
   * Stop all JavaScript execution in the worker thread as soon as possible.
   * Returns a Promise for the exit code that is fulfilled when the `'exit' event` is emitted.
   */
  readonly terminate?: () => Promise<number>
  /**
   * Cluster worker disconnect.
   */
  readonly disconnect?: () => void
  /**
   * Cluster worker kill.
   */
  readonly kill?: (signal?: string) => void
}

/**
 * Worker node options.
 * @internal
 */
export interface WorkerNodeOptions {
  workerOptions?: WorkerOptions
  env?: Record<string, unknown>
  tasksQueueBackPressureSize: number | undefined
  tasksQueueBucketSize: number | undefined
  tasksQueuePriority: boolean | undefined
}

/**
 * Worker node interface.
 * @typeParam Worker - Type of worker.
 * @typeParam Data - Type of data sent to the worker. This can only be structured-cloneable data.
 * @internal
 */
export interface IWorkerNode<Worker extends IWorker, Data = unknown>
  extends EventEmitter {
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
   * Message channel (worker thread only).
   */
  readonly messageChannel?: MessageChannel
  /**
   * Tasks queue.
   */
  readonly tasksQueue: PriorityQueue<Task<Data>>
  /**
   * Tasks queue back pressure size.
   * This is the number of tasks that can be enqueued before the worker node has back pressure.
   */
  tasksQueueBackPressureSize: number
  /**
   * Sets tasks queue priority.
   * @param enablePriority - Whether to enable tasks queue priority.
   */
  readonly setTasksQueuePriority: (enablePriority: boolean) => void
  /**
   * Tasks queue size.
   * @returns The tasks queue size.
   */
  readonly tasksQueueSize: () => number
  /**
   * Enqueue task.
   * @param task - The task to queue.
   * @returns The tasks queue size.
   */
  readonly enqueueTask: (task: Task<Data>) => number
  /**
   * Dequeue task.
   * @param bucket - The prioritized bucket to dequeue from. @defaultValue 0
   * @returns The dequeued task.
   */
  readonly dequeueTask: (bucket?: number) => Task<Data> | undefined
  /**
   * Dequeue last prioritized task.
   * @returns The dequeued task.
   */
  readonly dequeueLastPrioritizedTask: () => Task<Data> | undefined
  /**
   * Deletes a task from the tasks queue.
   * @param task - The task to delete.
   * @returns `true` if the task was deleted, `false` otherwise.
   */
  readonly deleteTask: (task: Task<Data>) => boolean
  /**
   * Clears tasks queue.
   */
  readonly clearTasksQueue: () => void
  /**
   * Whether the worker node has back pressure (i.e. its tasks queue is full).
   * @returns `true` if the worker node has back pressure, `false` otherwise.
   */
  readonly hasBackPressure: () => boolean
  /**
   * Terminates the worker node.
   */
  readonly terminate: () => Promise<void>
  /**
   * Registers a worker event handler.
   * @param event - The event.
   * @param handler - The event handler.
   */
  readonly registerWorkerEventHandler: (
    event: string,
    handler: EventHandler<Worker>
  ) => void
  /**
   * Registers once a worker event handler.
   * @param event - The event.
   * @param handler - The event handler.
   */
  readonly registerOnceWorkerEventHandler: (
    event: string,
    handler: EventHandler<Worker>
  ) => void
  /**
   * Gets task function worker usage statistics.
   * @param name - The task function name.
   * @returns The task function worker usage statistics if the task function worker usage statistics are initialized, `undefined` otherwise.
   */
  readonly getTaskFunctionWorkerUsage: (name: string) => WorkerUsage | undefined
  /**
   * Deletes task function worker usage statistics.
   * @param name - The task function name.
   * @returns `true` if the task function worker usage statistics were deleted, `false` otherwise.
   */
  readonly deleteTaskFunctionWorkerUsage: (name: string) => boolean
}

/**
 * Worker node event detail.
 * @internal
 */
export interface WorkerNodeEventDetail {
  workerId?: number
  workerNodeKey?: number
  taskId?: `${string}-${string}-${string}-${string}-${string}`
}
