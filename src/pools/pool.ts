import type { ClusterSettings } from 'node:cluster'
import type { EventEmitterAsyncResource } from 'node:events'
import type { Transferable, WorkerOptions } from 'node:worker_threads'

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
  degraded: 'degraded'
  degradedEnd: 'degradedEnd'
  destroy: 'destroy'
  empty: 'empty'
  error: 'error'
  full: 'full'
  fullEnd: 'fullEnd'
  ready: 'ready'
  taskError: 'taskError'
}> = Object.freeze({
  backPressure: 'backPressure',
  backPressureEnd: 'backPressureEnd',
  busy: 'busy',
  busyEnd: 'busyEnd',
  degraded: 'degraded',
  degradedEnd: 'degradedEnd',
  destroy: 'destroy',
  empty: 'empty',
  error: 'error',
  full: 'full',
  fullEnd: 'fullEnd',
  ready: 'ready',
  taskError: 'taskError',
} as const)

/**
 * Contract definition for a poolifier pool.
 * @template Worker - Type of worker which manages this pool.
 * @template Data - Type of data sent to the worker. This can only be structured-cloneable data.
 * @template Response - Type of execution response. This can only be structured-cloneable data.
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
   * @throws {TypeError} If the `name` parameter is not a string or an empty string.
   * @throws {TypeError} If the `fn` parameter is not a function or task function object.
   */
  readonly addTaskFunction: (
    name: string,
    fn: TaskFunction<Data, Response> | TaskFunctionObject<Data, Response>
  ) => Promise<boolean>
  /**
   * Terminates all workers in this pool. Calls made during the same destruction
   * return the shared completion promise. A completed pool can be restarted.
   */
  readonly destroy: () => Promise<void>
  /**
   * Pool event emitter integrated with async resource.
   * The async tracking tooling identifier is `poolifier:<PoolType>-<WorkerType>-pool`.
   *
   * Events that can currently be listened to:
   *
   * - `'ready'`: Emitted when the number of workers created in the pool has reached the minimum size expected and are ready. If the pool is dynamic with a minimum number of workers set to zero, this event is emitted when the pool is started.
   * - `'busy'`: Emitted when the number of workers created in the pool has reached the maximum size expected and are executing concurrently their tasks quota.
   * - `'busyEnd'`: Emitted when the number of workers created in the pool has reached the maximum size expected and are no longer executing concurrently their tasks quota.
   * - `'full'`: Emitted when the pool is dynamic and the number of workers created has reached the maximum size expected.
   * - `'fullEnd'`: Emitted when the pool is dynamic and the number of workers created has no longer reached the maximum size expected.
   * - `'empty'`: Emitted when the pool is dynamic with a minimum number of workers set to zero and the number of workers has reached the minimum size expected.
   * - `'destroy'`: Emitted when the pool is destroyed.
   * - `'error'`: Emitted once with a `WorkerCrashError` when a worker crashes. Other pool failures are emitted as their corresponding `Error` value.
   * - `'taskError'`: Emitted when an error occurs while executing a task.
   * - `'backPressure'`: Emitted when the number of workers created in the pool has reached the maximum size expected and are back pressured (i.e. their tasks queue is full: queue size \>= maximum queue size).
   * - `'backPressureEnd'`: Emitted when the number of workers created in the pool has reached the maximum size expected and are no longer back pressured (i.e. their tasks queue is no longer full: queue size \< maximum queue size).
   * - `'degraded'`: Emitted with a `PoolDegradedEvent` when the pool health transitions away from healthy, either because the number of ready worker nodes dropped below the minimum size or because the worker restart circuit breaker tripped (rendering the pool unrecoverable).
   * - `'degradedEnd'`: Emitted when the pool health recovers back to healthy.
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
   * @param abortSignal - The optional AbortSignal to abort the task.
   * @param transferList - The optional array of transferable objects to transfer ownership of. Ownership of the transferred objects is given to the chosen pool's worker_threads worker and they should not be used in the main thread afterwards.
   * @returns Promise with a task function response that will be fulfilled when the task is completed.
   */
  readonly execute: (
    data?: Data,
    name?: string,
    abortSignal?: AbortSignal,
    transferList?: readonly Transferable[]
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
   * @param abortSignals - The optional iterable of AbortSignal to abort the tasks iterable.
   * @param transferList - The optional array of transferable objects to transfer ownership of. Ownership of the transferred objects is given to the chosen pool's worker_threads worker and they should not be used in the main thread afterwards.
   * @returns Promise with an array of task function responses that will be fulfilled when the tasks are completed.
   */
  readonly mapExecute: (
    data: Iterable<Data>,
    name?: string,
    abortSignals?: Iterable<AbortSignal>,
    transferList?: readonly Transferable[]
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
   * Starts the minimum number of workers as one operation. A failed attempt
   * preserves the original thrown value and leaves the pool restartable.
   */
  readonly start: () => void
  /**
   * Pool worker nodes.
   * @internal
   */
  readonly workerNodes: IWorkerNode<Worker, Data>[]
}

/**
 * Payload emitted with the `'degraded'` pool event when the pool health
 * transitions away from healthy.
 */
export interface PoolDegradedEvent {
  /** Pool minimum size. */
  readonly minSize: number
  /** Number of ready worker nodes at the time of the transition. */
  readonly readyWorkerNodeCount: number
  /** Reason for the transition. */
  readonly reason: PoolDegradedReason
  /** Whether the pool has become unrecoverable (circuit breaker tripped). */
  readonly unrecoverable: boolean
}

/**
 * Reason the pool health transitions away from healthy.
 *
 * - `'belowMinimum'`: The number of ready worker nodes dropped below the pool minimum size.
 * - `'circuitBreakerTripped'`: The worker restart circuit breaker tripped, rendering the pool unrecoverable.
 */
export type PoolDegradedReason = 'belowMinimum' | 'circuitBreakerTripped'

/**
 * Pool event.
 */
export type PoolEvent = keyof typeof PoolEvents

/**
 * Pool health state.
 *
 * - `'healthy'`: The pool has at least its minimum number of ready worker nodes and the worker restart circuit breaker has not tripped.
 * - `'degraded'`: The pool is started but the number of ready worker nodes dropped below its minimum size.
 * - `'unrecoverable'`: The worker restart circuit breaker tripped; the pool can no longer replace faulted workers. Latched.
 * @internal
 */
export type PoolHealthState = 'degraded' | 'healthy' | 'unrecoverable'

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
  /** Pool dynamic worker nodes. */
  readonly dynamicWorkerNodes?: number
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
 * Options for a poolifier pool.
 * @template Worker - Type of worker.
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
   * Synchronous worker error callback. A throw is rethrown asynchronously
   * exactly once after task settlement and cleanup complete.
   * @defaultValue `() => {}`
   */
  errorHandler?: ErrorHandler<Worker>
  /**
   * Synchronous worker exit callback. See {@link ExitHandler} for argument
   * semantics and throw behavior.
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
   * Bounds faulted worker replacements within a sliding time window. Prevents a
   * crash loop (e.g. a poison task or a leaking worker) from replacing workers
   * unboundedly; once the bound is exceeded the pool becomes unrecoverable.
   * Disabled by default.
   */
  restartPolicy?: WorkerRestartPolicyOptions
  /**
   * Restart workers after abnormal exits. A clean exit with no in-flight task
   * replenishes the pool minimum regardless of this option. A clean exit while
   * a task is in-flight is treated as abnormal and follows this option.
   * In-flight task promises bound to an abnormal exit always reject with
   * `WorkerCrashError` regardless of this option.
   * @defaultValue `true`
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
   * @defaultValue WorkerChoiceStrategies.LEAST_USED
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
 * Worker node tasks queue options.
 */
export interface TasksQueueOptions {
  /**
   * Controls the priority queue anti-starvation aging rate.
   * @defaultValue 0.001
   */
  readonly agingFactor?: number
  /**
   * Maximum number of tasks that can be executed concurrently on a worker node.
   * @defaultValue 1
   */
  readonly concurrency?: number
  /**
   * Controls load-based aging adjustment exponent.
   * @defaultValue 0.667
   */
  readonly loadExponent?: number
  /**
   * Maximum tasks queue size per worker node flagging it as back pressured.
   * @defaultValue (pool maximum size)^2
   */
  readonly size?: number
  /**
   * Maximum time in milliseconds to wait for in-flight tasks to finish during
   * worker node termination.
   * Must be an integer in the range `0..2_147_483_647`. A value of `0`
   * applies the timeout immediately.
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
 * Worker restart policy options.
 */
export interface WorkerRestartPolicyOptions {
  /**
   * Maximum number of faulted worker replacements permitted within
   * `windowTime`. Exceeding it trips the pool into an unrecoverable state.
   * Must be a safe integer in the range `1..1000`, or `Infinity` to disable
   * the bound.
   * @defaultValue Infinity
   */
  readonly maxRestarts?: number
  /**
   * Trailing sliding window in milliseconds over which `maxRestarts` faulted
   * replacements are counted.
   * Must be an integer in the range `1000..2_147_483_647`.
   * @defaultValue 60_000
   */
  readonly windowTime?: number
}
