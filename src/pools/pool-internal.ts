import type { CircularArray } from '../circular-array'
import type { IPool } from './pool'
import type { IPoolWorker } from './pool-worker'

/**
 * Internal pool types.
 *
 * @enum
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
  runTimeHistory: CircularArray<number>
  avgRunTime: number
  medRunTime: number
  error: number
}

/**
 * Internal worker type.
 *
 * @typeParam Worker - Type of worker type items which manages this pool.
 */
export interface WorkerType<Worker extends IPoolWorker> {
  worker: Worker
  tasksUsage: TasksUsage
}

/**
 * Internal contract definition for a poolifier pool.
 *
 * @typeParam Worker - Type of worker which manages this pool.
 * @typeParam Data - Type of data sent to the worker. This can only be serializable data.
 * @typeParam Response - Type of response of execution. This can only be serializable data.
 */
export interface IPoolInternal<
  Worker extends IPoolWorker,
  Data = unknown,
  Response = unknown
> extends IPool<Data, Response> {
  /**
   * Pool worker type items array.
   */
  readonly workers: Array<WorkerType<Worker>>

  /**
   * Pool type.
   *
   * If it is `'dynamic'`, it provides the `max` property.
   */
  readonly type: PoolType

  /**
   * Whether the pool is full or not.
   *
   * The pool filling boolean status.
   */
  readonly full: boolean

  /**
   * Whether the pool is busy or not.
   *
   * The pool busyness boolean status.
   */
  readonly busy: boolean

  /**
   * Finds a free worker key based on the number of tasks the worker has applied.
   *
   * If a worker is found with `0` running tasks, it is detected as free and its key is returned.
   *
   * If no free worker is found, `-1` is returned.
   *
   * @returns A worker key if there is one, `-1` otherwise.
   */
  findFreeWorkerKey: () => number
}
