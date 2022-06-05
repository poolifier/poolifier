import type { Worker as ClusterWorker } from 'cluster'
import type { Worker as WorkerThread } from 'worker_threads'
import type { Draft } from '../utility-types'

/**
 * Poolifier supported worker type.
 */
export type WorkerType = WorkerThread & ClusterWorker & Draft<MessageChannel>

/**
 * Callback invoked if the worker has received a message.
 */
export type MessageHandler<Worker> = (this: Worker, m: unknown) => void

/**
 * Callback invoked if the worker raised an error.
 */
export type ErrorHandler<Worker> = (this: Worker, e: Error) => void

/**
 * Callback invoked when the worker has started successfully.
 */
export type OnlineHandler<Worker> = (this: Worker) => void

/**
 * Callback invoked when the worker exits successfully.
 */
export type ExitHandler<Worker> = (this: Worker, code: number) => void

/**
 * Basic interface that describes the minimum required implementation of listener events for a pool worker.
 */
export interface IPoolWorker {
  /**
   * Worker identifier.
   */
  readonly id?: number
  /**
   * Register a listener to the message event.
   *
   * @param event `'message'`.
   * @param handler The message handler.
   */
  on(event: 'message', handler: MessageHandler<this>): void
  /**
   * Register a listener to the error event.
   *
   * @param event `'error'`.
   * @param handler The error handler.
   */
  on(event: 'error', handler: ErrorHandler<this>): void
  /**
   * Register a listener to the online event.
   *
   * @param event `'online'`.
   * @param handler The online handler.
   */
  on(event: 'online', handler: OnlineHandler<this>): void
  /**
   * Register a listener to the exit event.
   *
   * @param event `'exit'`.
   * @param handler The exit handler.
   */
  on(event: 'exit', handler: ExitHandler<this>): void
  /**
   * Register a listener to the exit event that will only performed once.
   *
   * @param event `'exit'`.
   * @param handler The exit handler.
   */
  once(event: 'exit', handler: ExitHandler<this>): void
}
