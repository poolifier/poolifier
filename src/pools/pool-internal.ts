import type { IPool } from './pool'
import type { IWorker, WorkerNode } from './worker'

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
 * Internal contract definition for a poolifier pool.
 *
 * @typeParam Worker - Type of worker which manages this pool.
 * @typeParam Data - Type of data sent to the worker. This can only be serializable data.
 * @typeParam Response - Type of response of execution. This can only be serializable data.
 */
export interface IPoolInternal<
  Worker extends IWorker,
  Data = unknown,
  Response = unknown
> extends IPool<Data, Response> {
  /**
   * Pool worker nodes.
   */
  readonly workerNodes: Array<WorkerNode<Worker, Data>>

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
   * Finds a free worker node key based on the number of tasks the worker has applied.
   *
   * If a worker is found with `0` running tasks, it is detected as free and its worker node key is returned.
   *
   * If no free worker is found, `-1` is returned.
   *
   * @returns A worker node key if there is one, `-1` otherwise.
   */
  findFreeWorkerNodeKey: () => number
}
