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
  fixed: 'fixed'
  dynamic: 'dynamic'
}> = Object.freeze({
  /**
   * Fixed pool type.
   */
  fixed: 'fixed',
  /**
   * Dynamic pool type.
   */
  dynamic: 'dynamic',
} as const)

/**
 * Pool type.
 */
export type PoolType = keyof typeof PoolTypes

/**
 * Enumeration of pool events.
 */
export const PoolEvents: Readonly<{
  ready: 'ready'
  busy: 'busy'
  full: 'full'
  empty: 'empty'
  destroy: 'destroy'
  error: 'error'
  taskError: 'taskError'
  backPressure: 'backPressure'
}> = Object.freeze({
  ready: 'ready',
  busy: 'busy',
  full: 'full',
  empty: 'empty',
  destroy: 'destroy',
  error: 'error',
  taskError: 'taskError',
  backPressure: 'backPressure',
} as const)

/**
 * Pool event.
 */
export type PoolEvent = keyof typeof PoolEvents

/**
 * Pool information.
 */
export interface PoolInfo {
  readonly version: string
  readonly type: PoolType
  readonly worker: WorkerType
  readonly started: boolean
  readonly ready: boolean
  readonly defaultStrategy: WorkerChoiceStrategy
  readonly strategyRetries: number
  readonly minSize: number
  readonly maxSize: number
  /** Pool utilization. */
  readonly utilization?: number
  /** Pool total worker nodes. */
  readonly workerNodes: number
  /** Pool stealing worker nodes. */
  readonly stealingWorkerNodes?: number
  /** Pool idle worker nodes. */
  readonly idleWorkerNodes: number
  /** Pool busy worker nodes. */
  readonly busyWorkerNodes: number
  readonly executedTasks: number
  readonly executingTasks: number
  readonly queuedTasks?: number
  readonly maxQueuedTasks?: number
  readonly backPressure?: boolean
  readonly stolenTasks?: number
  readonly failedTasks: number
  readonly runTime?: {
    readonly minimum: number
    readonly maximum: number
    readonly average?: number
    readonly median?: number
  }
  readonly waitTime?: {
    readonly minimum: number
    readonly maximum: number
    readonly average?: number
    readonly median?: number
  }
  readonly elu?: {
    idle: {
      readonly minimum: number
      readonly maximum: number
      readonly average?: number
      readonly median?: number
    }
    active: {
      readonly minimum: number
      readonly maximum: number
      readonly average?: number
      readonly median?: number
    }
    utilization: {
      readonly average?: number
      readonly median?: number
    }
  }
}

/**
 * Worker node tasks queue options.
 */
export interface TasksQueueOptions {
  /**
   * Maximum tasks queue size per worker node flagging it as back pressured.
   * @defaultValue (pool maximum size)^2
   */
  readonly size?: number
  /**
   * Maximum number of tasks that can be executed concurrently on a worker node.
   * @defaultValue 1
   */
  readonly concurrency?: number
  /**
   * Whether to enable task stealing on idle.
   * @defaultValue true
   */
  readonly taskStealing?: boolean
  /**
   * Whether to enable tasks stealing under back pressure.
   * @defaultValue false
   */
  readonly tasksStealingOnBackPressure?: boolean
  /**
   * Queued tasks finished timeout in milliseconds at worker node termination.
   * @defaultValue 2000
   */
  readonly tasksFinishedTimeout?: number
}

/**
 * Options for a poolifier pool.
 * @typeParam Worker - Type of worker.
 */
export interface PoolOptions<Worker extends IWorker> {
  /**
   * A function that will listen for online event on each worker.
   * @defaultValue `() => {}`
   */
  onlineHandler?: OnlineHandler<Worker>
  /**
   * A function that will listen for message event on each worker.
   * @defaultValue `() => {}`
   */
  messageHandler?: MessageHandler<Worker>
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
   * Whether to start the minimum number of workers at pool initialization.
   * @defaultValue true
   */
  startWorkers?: boolean
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
   * Restart worker on error.
   */
  restartWorkerOnError?: boolean
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
   * Pool worker node tasks queue options.
   */
  tasksQueueOptions?: TasksQueueOptions
  /**
   * Worker options.
   * @see https://nodejs.org/api/worker_threads.html#new-workerfilename-options
   */
  workerOptions?: WorkerOptions
  /**
   * Key/value pairs to add to worker process environment.
   * @see https://nodejs.org/api/cluster.html#cluster_cluster_fork_env
   */
  env?: Record<string, unknown>
  /**
   * Cluster settings.
   * @see https://nodejs.org/api/cluster.html#cluster_cluster_settings
   */
  settings?: ClusterSettings
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
   * Pool information.
   */
  readonly info: PoolInfo
  /**
   * Pool worker nodes.
   * @internal
   */
  readonly workerNodes: IWorkerNode<Worker, Data>[]
  /**
   * Pool event emitter integrated with async resource.
   * The async tracking tooling identifier is `poolifier:<PoolType>-<WorkerType>-pool`.
   *
   * Events that can currently be listened to:
   *
   * - `'ready'`: Emitted when the number of workers created in the pool has reached the minimum size expected and are ready. If the pool is dynamic with a minimum number of workers is set to zero, this event is emitted when at least one dynamic worker is ready.
   * - `'busy'`: Emitted when the number of workers created in the pool has reached the maximum size expected and are executing concurrently their tasks quota.
   * - `'full'`: Emitted when the pool is dynamic and the number of workers created has reached the maximum size expected.
   * - `'empty'`: Emitted when the pool is dynamic with a minimum number of workers set to zero and the number of workers has reached the minimum size expected.
   * - `'destroy'`: Emitted when the pool is destroyed.
   * - `'error'`: Emitted when an uncaught error occurs.
   * - `'taskError'`: Emitted when an error occurs while executing a task.
   * - `'backPressure'`: Emitted when all worker nodes have back pressure (i.e. their tasks queue is full: queue size \>= maximum queue size).
   */
  readonly emitter?: EventEmitterAsyncResource
  /**
   * Executes the specified function in the worker constructor with the task data input parameter.
   * @param data - The optional task input data for the specified task function. This can only be structured-cloneable data.
   * @param name - The optional name of the task function to execute. If not specified, the default task function will be executed.
   * @param transferList - An optional array of transferable objects to transfer ownership of. Ownership of the transferred objects is given to the chosen pool's worker_threads worker and they should not be used in the main thread afterwards.
   * @param abortSignal - An optional AbortSignal to abort the task.
   * @returns Promise with a task function response that will be fulfilled when the task is completed.
   */
  readonly execute: (
    data?: Data,
    name?: string,
    transferList?: readonly TransferListItem[],
    abortSignal?: AbortSignal
  ) => Promise<Response>
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
   * Starts the minimum number of workers in this pool.
   */
  readonly start: () => void
  /**
   * Terminates all workers in this pool.
   */
  readonly destroy: () => Promise<void>
  /**
   * Whether the specified task function exists in this pool.
   * @param name - The name of the task function.
   * @returns `true` if the task function exists, `false` otherwise.
   */
  readonly hasTaskFunction: (name: string) => boolean
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
   * Removes a task function from this pool.
   * @param name - The name of the task function.
   * @returns `true` if the task function was removed, `false` otherwise.
   */
  readonly removeTaskFunction: (name: string) => Promise<boolean>
  /**
   * Lists the properties of task functions available in this pool.
   * @returns The properties of task functions available in this pool.
   */
  readonly listTaskFunctionsProperties: () => TaskFunctionProperties[]
  /**
   * Sets the default task function in this pool.
   * @param name - The name of the task function.
   * @returns `true` if the default task function was set, `false` otherwise.
   */
  readonly setDefaultTaskFunction: (name: string) => Promise<boolean>
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
   * Enables/disables the worker node tasks queue in this pool.
   * @param enable - Whether to enable or disable the worker node tasks queue.
   * @param tasksQueueOptions - The worker node tasks queue options.
   */
  readonly enableTasksQueue: (
    enable: boolean,
    tasksQueueOptions?: TasksQueueOptions
  ) => void
  /**
   * Sets the worker node tasks queue options in this pool.
   * @param tasksQueueOptions - The worker node tasks queue options.
   */
  readonly setTasksQueueOptions: (tasksQueueOptions: TasksQueueOptions) => void
}
