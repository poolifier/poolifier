import type { CircularArray } from '../circular-array'
import type { Queue } from '../queue'

/**
 * Callback invoked if the worker has received a message.
 */
export type MessageHandler<Worker extends IWorker> = (
  this: Worker,
  m: unknown
) => void

/**
 * Callback invoked if the worker raised an error.
 */
export type ErrorHandler<Worker extends IWorker> = (
  this: Worker,
  e: Error
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
  code: number
) => void

/**
 * Message object that is passed as a task between main worker and worker.
 *
 * @typeParam Data - Type of data sent to the worker. This can only be serializable data.
 * @internal
 */
export interface Task<Data = unknown> {
  /**
   * Task name.
   */
  readonly name?: string
  /**
   * Task input data that will be passed to the worker.
   */
  readonly data?: Data
  /**
   * Submission timestamp.
   */
  readonly submissionTimestamp?: number
  /**
   * Message UUID.
   */
  readonly id?: string
}

/**
 * Worker tasks usage statistics.
 *
 * @internal
 */
export interface TasksUsage {
  /**
   * Number of tasks executed.
   */
  run: number
  /**
   * Number of tasks running.
   */
  running: number
  /**
   * Tasks runtime.
   */
  runTime: number
  /**
   * Tasks runtime history.
   */
  runTimeHistory: CircularArray<number>
  /**
   * Average tasks runtime.
   */
  avgRunTime: number
  /**
   * Median tasks runtime.
   */
  medRunTime: number
  /**
   * Tasks wait time.
   */
  waitTime: number
  /**
   * Tasks wait time history.
   */
  waitTimeHistory: CircularArray<number>
  /**
   * Average tasks wait time.
   */
  avgWaitTime: number
  /**
   * Median tasks wait time.
   */
  medWaitTime: number
  /**
   * Number of tasks errored.
   */
  error: number
}

/**
 * Worker interface.
 */
export interface IWorker {
  /**
   * Register an event listener.
   *
   * @param event - The event.
   * @param handler - The event handler.
   */
  on: ((event: 'message', handler: MessageHandler<this>) => void) &
  ((event: 'error', handler: ErrorHandler<this>) => void) &
  ((event: 'online', handler: OnlineHandler<this>) => void) &
  ((event: 'exit', handler: ExitHandler<this>) => void)
  /**
   * Register a listener to the exit event that will only be performed once.
   *
   * @param event - `'exit'`.
   * @param handler - The exit handler.
   */
  once: (event: 'exit', handler: ExitHandler<this>) => void
}

/**
 * Worker node interface.
 *
 * @typeParam Worker - Type of worker.
 * @typeParam Data - Type of data sent to the worker. This can only be serializable data.
 * @internal
 */
export interface WorkerNode<Worker extends IWorker, Data = unknown> {
  /**
   * Worker node worker.
   */
  readonly worker: Worker
  /**
   * Worker node tasks usage statistics.
   */
  tasksUsage: TasksUsage
  /**
   * Worker node tasks queue.
   */
  readonly tasksQueue: Queue<Task<Data>>
}
