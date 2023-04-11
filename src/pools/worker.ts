import type { CircularArray } from '../circular-array'

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
 * Worker task interface.
 */
export interface Task<Data = unknown> {
  /**
   * Worker task data.
   */
  data: Data
  /**
   * Task UUID.
   */
  id: string
}

/**
 * Worker tasks usage statistics.
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
 * Worker interface.
 */
export interface IWorker {
  /**
   * Register an event listener.
   *
   * @param event - The event.
   * @param handler - The event listener.
   */
  on: ((event: 'message', handler: MessageHandler<this>) => void) &
  ((event: 'error', handler: ErrorHandler<this>) => void) &
  ((event: 'online', handler: OnlineHandler<this>) => void) &
  ((event: 'exit', handler: ExitHandler<this>) => void)
  /**
   * Register a listener to the exit event that will only performed once.
   *
   * @param event - `'exit'`.
   * @param handler - The exit handler.
   */
  once: (event: 'exit', handler: ExitHandler<this>) => void
}

/**
 * Worker node interface.
 */
export interface WorkerNode<Worker extends IWorker, Data = unknown> {
  worker: Worker
  tasksUsage: TasksUsage
  tasksQueue: Array<Task<Data>>
}
