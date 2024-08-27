import type { ClusterSettings } from 'node:cluster'
import type { EventEmitterAsyncResource } from 'node:events'
import type { TransferListItem, WorkerOptions } from 'node:worker_threads'

import type { TaskFunctionProperties } from '../utility-types.js'
import type {
  TaskFunction,
  TaskFunctionObject,
} from '../worker/task-functions.js'
import type {
  WorkerChoiceStrategy,
  WorkerChoiceStrategyOptions,
} from './selection-strategies/selection-strategies-types.js'
import type {
  ErrorHandler,
  ExitHandler,
  IWorker,
  IWorkerNode,
  MessageHandler,
  OnlineHandler,
  WorkerType,
} from './worker.js'

/**
 * Enumeration of pool types.
 */
export const PoolTypes: Readonly<{
  dynamic: 'dynamic'
  fixed: 'fixed'
}> = Object.freeze({
  /**
   * Dynamic pool type.
   */
  dynamic: 'dynamic',
  /**
   * Fixed pool type.
   */
  fixed: 'fixed',
} as const)

/**
 * Pool type.
 */
export type PoolType = keyof typeof PoolTypes

/**
 * Enumeration of pool events.
 */
export const PoolEvents: Readonly<{
  backPressure: 'backPressure'
  backPressureEnd: 'backPressureEnd'
  busy: 'busy'
  busyEnd: 'busyEnd'
  destroy: 'destroy'
  empty: 'empty'
  error: 'error'
  full: 'full'
  ready: 'ready'
  taskError: 'taskError'
}> = Object.freeze({
  backPressure: 'backPressure',
  backPressureEnd: 'backPressureEnd',
  busy: 'busy',
  busyEnd: 'busyEnd',
  destroy: 'destroy',
  empty: 'empty',
  error: 'error',
  full: 'full',
  ready: 'ready',
  taskError: 'taskError',
} as const)

/**
 * Pool event.
 */
export type PoolEvent = keyof typeof PoolEvents

/**
 * Pool information.
 */
export interface PoolInfo {
  readonly backPressure?: boolean
  /** Pool tasks back pressure worker nodes. */
  readonly backPressureWorkerNodes?: number
  /** Pool busy worker nodes. */
  readonly busyWorkerNodes: number
  readonly defaultStrategy: WorkerChoiceStrategy
  readonly elu?: {
    active: {
      readonly average?: number
      readonly maximum: number
      readonly median?: number
      readonly minimum: number
    }
    idle: {
      readonly average?: number
      readonly maximum: number
      readonly median?: number
      readonly minimum: number
    }
    utilization: {
      readonly average?: number
      readonly median?: number
    }
  }
  readonly executedTasks: number
  readonly executingTasks: number
  readonly failedTasks: number
  /** Pool idle worker nodes. */
  readonly idleWorkerNodes: number
  readonly maxQueuedTasks?: number
  readonly maxSize: number
  readonly minSize: number
  readonly queuedTasks?: number
  readonly ready: boolean
  readonly runTime?: {
    readonly average?: number
    readonly maximum: number
    readonly median?: number
    readonly minimum: number
  }
  readonly started: boolean
  /** Pool tasks stealing worker nodes. */
  readonly stealingWorkerNodes?: number
  readonly stolenTasks?: number
  readonly strategyRetries: number
  readonly type: PoolType
  /** Pool utilization. */
  readonly utilization?: number
  readonly version: string
  readonly waitTime?: {
    readonly average?: number
    readonly maximum: number
    readonly median?: number
    readonly minimum: number
  }
  readonly worker: WorkerType
  /** Pool total worker nodes. */
  readonly workerNodes: number
}

/**
 * Worker node tasks queue options.
 */
export interface TasksQueueOptions {
  /**
   * Maximum number of tasks that can be executed concurrently on a worker node.
   * @defaultValue 1
   */
  readonly concurrency?: number
  /**
   * Maximum tasks queue size per worker node flagging it as back pressured.
   * @defaultValue (pool maximum size)^2
   */
  readonly size?: number
  /**
   * Queued tasks finished timeout in milliseconds at worker node termination.
   * @defaultValue 2000
   */
  readonly tasksFinishedTimeout?: number
  /**
   * Whether to enable tasks stealing under back pressure.
   * @defaultValue true
   */
  readonly tasksStealingOnBackPressure?: boolean
  /**
   * Ratio of worker nodes that can steal tasks from another worker node.
   * @defaultValue 0.6
   */
  readonly tasksStealingRatio?: number
  /**
   * Whether to enable task stealing on idle.
   * @defaultValue true
   */
  readonly taskStealing?: boolean
}

/**
 * Options for a poolifier pool.
 * @typeParam Worker - Type of worker.
 */
export interface PoolOptions<Worker extends IWorker> {
  /**
   * Pool events integrated with async resource emission.
   * @defaultValue true
   */
  enableEvents?: boolean
  /**
   * Pool worker node tasks queue.
   * @defaultValue false
   */
  enableTasksQueue?: boolean
  /**
   * Key/value pairs to add to worker process environment.
   * @see https://nodejs.org/api/cluster.html#cluster_cluster_fork_env
   */
  env?: Record<string, unknown>
  /**
   * A function that will listen for error event on each worker.
   * @defaultValue `() => {}`
   */
  errorHandler?: ErrorHandler<Worker>
  /**
   * A function that will listen for exit event on each worker.
   * @defaultValue `() => {}`
   */
  exitHandler?: ExitHandler<Worker>
  /**
   * A function that will listen for message event on each worker.
   * @defaultValue `() => {}`
   */
  messageHandler?: MessageHandler<Worker>
  /**
   * A function that will listen for online event on each worker.
   * @defaultValue `() => {}`
   */
  onlineHandler?: OnlineHandler<Worker>
  /**
   * Restart worker on error.
   */
  restartWorkerOnError?: boolean
  /**
   * Cluster settings.
   * @see https://nodejs.org/api/cluster.html#cluster_cluster_settings
   */
  settings?: ClusterSettings
  /**
   * Whether to start the minimum number of workers at pool initialization.
   * @defaultValue true
   */
  startWorkers?: boolean
  /**
   * Pool worker node tasks queue options.
   */
  tasksQueueOptions?: TasksQueueOptions
  /**
   * The default worker choice strategy to use in this pool.
   * @defaultValue WorkerChoiceStrategies.ROUND_ROBIN
   */
  workerChoiceStrategy?: WorkerChoiceStrategy
  /**
   * The worker choice strategy options.
   */
  workerChoiceStrategyOptions?: WorkerChoiceStrategyOptions
  /**
   * Worker options.
   * @see https://nodejs.org/api/worker_threads.html#new-workerfilename-options
   */
  workerOptions?: WorkerOptions
}

/**
 * Contract definition for a poolifier pool.
 * @typeParam Worker - Type of worker which manages this pool.
 * @typeParam Data - Type of data sent to the worker. This can only be structured-cloneable data.
 * @typeParam Response - Type of execution response. This can only be structured-cloneable data.
 */
export interface IPool<
  Worker extends IWorker,
  Data = unknown,
  Response = unknown
> {
  /**
   * Adds a task function to this pool.
   * If a task function with the same name already exists, it will be overwritten.
   * @param name - The name of the task function.
   * @param fn - The task function.
   * @returns `true` if the task function was added, `false` otherwise.
   * @throws {@link https://nodejs.org/api/errors.html#class-typeerror} If the `name` parameter is not a string or an empty string.
   * @throws {@link https://nodejs.org/api/errors.html#class-typeerror} If the `fn` parameter is not a function or task function object.
   */
  readonly addTaskFunction: (
    name: string,
    fn: TaskFunction<Data, Response> | TaskFunctionObject<Data, Response>
  ) => Promise<boolean>
  /**
   * Terminates all workers in this pool.
   */
  readonly destroy: () => Promise<void>
  /**
   * Pool event emitter integrated with async resource.
   * The async tracking tooling identifier is `poolifier:<PoolType>-<WorkerType>-pool`.
   *
   * Events that can currently be listened to:
   *
   * - `'ready'`: Emitted when the number of workers created in the pool has reached the minimum size expected and are ready. If the pool is dynamic with a minimum number of workers is set to zero, this event is emitted when at least one dynamic worker is ready.
   * - `'busy'`: Emitted when the number of workers created in the pool has reached the maximum size expected and are executing concurrently their tasks quota.
   * - `'busyEnd'`: Emitted when the number of workers created in the pool has reached the maximum size expected and are no longer executing concurrently their tasks quota.
   * - `'full'`: Emitted when the pool is dynamic and the number of workers created has reached the maximum size expected.
   * - `'empty'`: Emitted when the pool is dynamic with a minimum number of workers set to zero and the number of workers has reached the minimum size expected.
   * - `'destroy'`: Emitted when the pool is destroyed.
   * - `'error'`: Emitted when an uncaught error occurs.
   * - `'taskError'`: Emitted when an error occurs while executing a task.
   * - `'backPressure'`: Emitted when the number of workers created in the pool has reached the maximum size expected and are back pressured (i.e. their tasks queue is full: queue size \>= maximum queue size).
   * - `'backPressureEnd'`: Emitted when the number of workers created in the pool has reached the maximum size expected and are no longer back pressured (i.e. their tasks queue is no longer full: queue size \< maximum queue size).
   */
  readonly emitter?: EventEmitterAsyncResource
  /**
   * Enables/disables the worker node tasks queue in this pool.
   * @param enable - Whether to enable or disable the worker node tasks queue.
   * @param tasksQueueOptions - The worker node tasks queue options.
   */
  readonly enableTasksQueue: (
    enable: boolean,
    tasksQueueOptions?: TasksQueueOptions
  ) => void
  /**
   * Executes the specified function in the worker constructor with the task data input parameter.
   * @param data - The optional task input data for the specified task function. This can only be structured-cloneable data.
   * @param name - The optional name of the task function to execute. If not specified, the default task function will be executed.
   * @param transferList - An optional array of transferable objects to transfer ownership of. Ownership of the transferred objects is given to the chosen pool's worker_threads worker and they should not be used in the main thread afterwards.
   * @returns Promise with a task function response that will be fulfilled when the task is completed.
   */
  readonly execute: (
    data?: Data,
    name?: string,
    transferList?: readonly TransferListItem[]
  ) => Promise<Response>
  /**
   * Whether the specified task function exists in this pool.
   * @param name - The name of the task function.
   * @returns `true` if the task function exists, `false` otherwise.
   */
  readonly hasTaskFunction: (name: string) => boolean
  /**
   * Pool information.
   */
  readonly info: PoolInfo
  /**
   * Lists the properties of task functions available in this pool.
   * @returns The properties of task functions available in this pool.
   */
  readonly listTaskFunctionsProperties: () => TaskFunctionProperties[]
  /**
   * Executes the specified function in the worker constructor with the tasks data iterable input parameter.
   * @param data - The tasks iterable input data for the specified task function. This can only be an iterable of structured-cloneable data.
   * @param name - The optional name of the task function to execute. If not specified, the default task function will be executed.
   * @param transferList - An optional array of transferable objects to transfer ownership of. Ownership of the transferred objects is given to the chosen pool's worker_threads worker and they should not be used in the main thread afterwards.
   * @returns Promise with an array of task function responses that will be fulfilled when the tasks are completed.
   */
  readonly mapExecute: (
    data: Iterable<Data>,
    name?: string,
    transferList?: readonly TransferListItem[]
  ) => Promise<Response[]>
  /**
   * Removes a task function from this pool.
   * @param name - The name of the task function.
   * @returns `true` if the task function was removed, `false` otherwise.
   */
  readonly removeTaskFunction: (name: string) => Promise<boolean>
  /**
   * Sets the default task function in this pool.
   * @param name - The name of the task function.
   * @returns `true` if the default task function was set, `false` otherwise.
   */
  readonly setDefaultTaskFunction: (name: string) => Promise<boolean>
  /**
   * Sets the worker node tasks queue options in this pool.
   * @param tasksQueueOptions - The worker node tasks queue options.
   */
  readonly setTasksQueueOptions: (tasksQueueOptions: TasksQueueOptions) => void
  /**
   * Sets the default worker choice strategy in this pool.
   * @param workerChoiceStrategy - The default worker choice strategy.
   * @param workerChoiceStrategyOptions - The worker choice strategy options.
   */
  readonly setWorkerChoiceStrategy: (
    workerChoiceStrategy: WorkerChoiceStrategy,
    workerChoiceStrategyOptions?: WorkerChoiceStrategyOptions
  ) => void
  /**
   * Sets the worker choice strategy options in this pool.
   * @param workerChoiceStrategyOptions - The worker choice strategy options.
   * @returns `true` if the worker choice strategy options were set, `false` otherwise.
   */
  readonly setWorkerChoiceStrategyOptions: (
    workerChoiceStrategyOptions: WorkerChoiceStrategyOptions
  ) => boolean
  /**
   * Starts the minimum number of workers in this pool.
   */
  readonly start: () => void
  /**
   * Pool worker nodes.
   * @internal
   */
  readonly workerNodes: IWorkerNode<Worker, Data>[]
}
