import type { IPool } from './pool'
import type { IPoolWorker } from './pool-worker'

/**
 * Internal pool types.
 */
export enum PoolType {
  FIXED = 'fixed',
  DYNAMIC = 'dynamic'
}

/**
 * Internal tasks usage statistics.
 */
export interface TasksUsage {
  run: number
  running: number
  runTime: number
  avgRunTime: number
  error: number
}

/**
 * Internal worker type.
 *
 * @typeParam Worker - Type of worker which manages this pool.
 */
export interface WorkerType<Worker extends IPoolWorker> {
  worker: Worker
  tasksUsage: TasksUsage
}

/**
 * Internal contract definition for a poolifier pool.
 *
 * @typeParam Worker - Type of worker which manages this pool.
 * @typeParam Data - Type of data sent to the worker.
 * @typeParam Response - Type of response of execution.
 */
export interface IPoolInternal<
  Worker extends IPoolWorker,
  Data = unknown,
  Response = unknown
> extends IPool<Data, Response> {
  /**
   * Pool workers item array.
   */
  readonly workers: Array<WorkerType<Worker>>

  /**
   * Pool type.
   *
   * If it is `'dynamic'`, it provides the `max` property.
   */
  readonly type: PoolType

  /**
   * Whether the pool is busy or not.
   *
   * The pool busyness boolean status.
   */
  readonly busy: boolean

  /**
   * Number of tasks currently concurrently running.
   */
  readonly numberOfRunningTasks: number

  /**
   * Finds a free worker key based on the number of tasks the worker has applied.
   *
   * If a worker is found with `0` running tasks, it is detected as free and its key is returned.
   *
   * If no free worker is found, `false` is returned.
   *
   * @returns A worker key if there is one, otherwise `false`.
   */
  findFreeWorkerKey: () => number | false
}
