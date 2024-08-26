import type { EventEmitter } from 'node:events'
import type { MessageChannel, WorkerOptions } from 'node:worker_threads'

import type { CircularBuffer } from '../circular-buffer.js'
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
  | ErrorHandler<Worker>
  | ExitHandler<Worker>
  | MessageHandler<Worker>
  | OnlineHandler<Worker>

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
   * Measurement average.
   */
  average?: number
  /**
   * Measurement history.
   */
  readonly history: CircularBuffer
  /**
   * Measurement maximum.
   */
  maximum?: number
  /**
   * Measurement median.
   */
  median?: number
  /**
   * Measurement minimum.
   */
  minimum?: number
}

/**
 * Event loop utilization measurement statistics.
 * @internal
 */
export interface EventLoopUtilizationMeasurementStatistics {
  readonly active: MeasurementStatistics
  readonly idle: MeasurementStatistics
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
   * Number of failed tasks.
   */
  failed: number
  /**
   * Maximum number of queued tasks.
   */
  readonly maxQueued?: number
  /**
   * Number of queued tasks.
   */
  readonly queued: number
  /**
   * Number of sequentially stolen tasks.
   */
  sequentiallyStolen: number
  /**
   * Number of stolen tasks.
   */
  stolen: number
}

/**
 * Enumeration of worker types.
 */
export const WorkerTypes: Readonly<{ cluster: 'cluster'; thread: 'thread' }> =
  Object.freeze({
    cluster: 'cluster',
    thread: 'thread',
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
   * Back pressure flag.
   * This flag is set to `true` when worker node tasks queue has back pressure.
   */
  backPressure: boolean
  /**
   * Back pressure stealing flag.
   * This flag is set to `true` when worker node is stealing one task from another back pressured worker node.
   */
  backPressureStealing: boolean
  /**
   * Continuous stealing flag.
   * This flag is set to `true` when worker node is continuously stealing tasks from other worker nodes.
   */
  continuousStealing: boolean
  /**
   * Dynamic flag.
   */
  dynamic: boolean
  /**
   * Worker id.
   */
  readonly id: number | undefined
  /**
   * Ready flag.
   */
  ready: boolean
  /**
   * Stealing flag.
   * This flag is set to `true` when worker node is stealing one task from another worker node.
   */
  stealing: boolean
  /**
   * Stolen flag.
   * This flag is set to `true` when worker node has one task stolen from another worker node.
   */
  stolen: boolean
  /**
   * Task functions properties.
   */
  taskFunctionsProperties?: TaskFunctionProperties[]
  /**
   * Worker type.
   */
  readonly type: WorkerType
}

/**
 * Worker usage statistics.
 * @internal
 */
export interface WorkerUsage {
  /**
   * Tasks event loop utilization statistics.
   */
  readonly elu: EventLoopUtilizationMeasurementStatistics
  /**
   * Tasks runtime statistics.
   */
  readonly runTime: MeasurementStatistics
  /**
   * Tasks statistics.
   */
  readonly tasks: TaskStatistics
  /**
   * Tasks wait time statistics.
   */
  readonly waitTime: MeasurementStatistics
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
   * Cluster worker disconnect.
   */
  readonly disconnect?: () => void
  /**
   * Cluster worker id.
   */
  readonly id?: number
  /**
   * Cluster worker kill.
   */
  readonly kill?: (signal?: string) => void
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
   * Stop all JavaScript execution in the worker thread as soon as possible.
   * Returns a Promise for the exit code that is fulfilled when the `'exit' event` is emitted.
   */
  readonly terminate?: () => Promise<number>
  /**
   * Worker thread worker id.
   */
  readonly threadId?: number
  /**
   * Calling `unref()` on a worker allows the thread to exit if this is the only
   * active handle in the event system. If the worker is already `unref()`ed calling`unref()` again has no effect.
   * @since v10.5.0
   */
  readonly unref?: () => void
}

/**
 * Worker node options.
 * @internal
 */
export interface WorkerNodeOptions {
  env?: Record<string, unknown>
  tasksQueueBackPressureSize: number | undefined
  tasksQueueBucketSize: number | undefined
  tasksQueuePriority: boolean | undefined
  workerOptions?: WorkerOptions
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
   * Clears tasks queue.
   */
  readonly clearTasksQueue: () => void
  /**
   * Deletes task function worker usage statistics.
   * @param name - The task function name.
   * @returns `true` if the task function worker usage statistics were deleted, `false` otherwise.
   */
  readonly deleteTaskFunctionWorkerUsage: (name: string) => boolean
  /**
   * Dequeue last prioritized task.
   * @returns The dequeued task.
   */
  readonly dequeueLastPrioritizedTask: () => Task<Data> | undefined
  /**
   * Dequeue task.
   * @param bucket - The prioritized bucket to dequeue from. @defaultValue 0
   * @returns The dequeued task.
   */
  readonly dequeueTask: (bucket?: number) => Task<Data> | undefined
  /**
   * Enqueue task.
   * @param task - The task to queue.
   * @returns The tasks queue size.
   */
  readonly enqueueTask: (task: Task<Data>) => number
  /**
   * Gets task function worker usage statistics.
   * @param name - The task function name.
   * @returns The task function worker usage statistics if the task function worker usage statistics are initialized, `undefined` otherwise.
   */
  readonly getTaskFunctionWorkerUsage: (name: string) => undefined | WorkerUsage
  /**
   * Worker info.
   */
  readonly info: WorkerInfo
  /**
   * Message channel (worker thread only).
   */
  readonly messageChannel?: MessageChannel
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
   * Registers a worker event handler.
   * @param event - The event.
   * @param handler - The event handler.
   */
  readonly registerWorkerEventHandler: (
    event: string,
    handler: EventHandler<Worker>
  ) => void
  /**
   * Sets tasks queue priority.
   * @param enablePriority - Whether to enable tasks queue priority.
   */
  readonly setTasksQueuePriority: (enablePriority: boolean) => void
  /**
   * Worker choice strategy data.
   * This is used to store data that are specific to the worker choice strategy.
   */
  strategyData?: StrategyData
  /**
   * Tasks queue back pressure size.
   * This is the number of tasks that can be enqueued before the worker node has back pressure.
   */
  tasksQueueBackPressureSize: number
  /**
   * Tasks queue size.
   * @returns The tasks queue size.
   */
  readonly tasksQueueSize: () => number
  /**
   * Terminates the worker node.
   */
  readonly terminate: () => Promise<void>
  /**
   * Worker usage statistics.
   */
  readonly usage: WorkerUsage
  /**
   * Worker.
   */
  readonly worker: Worker
}

/**
 * Worker node event detail.
 * @internal
 */
export interface WorkerNodeEventDetail {
  workerId?: number
  workerNodeKey?: number
}
