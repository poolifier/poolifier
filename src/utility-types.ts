import type { Worker } from 'cluster'
import type { MessagePort } from 'worker_threads'
import type { KillBehavior } from './worker/worker-options'

/**
 * Make all properties in T non-readonly.
 */
export type Draft<T> = { -readonly [P in keyof T]?: T[P] }

/**
 * Message object that is passed between worker and main worker.
 */
export interface MessageValue<
  Data = unknown,
  MainWorker extends Worker | MessagePort | unknown = unknown
> {
  /**
   * Input data that will be passed to the worker.
   */
  readonly data?: Data
  /**
   * ID of the message.
   */
  readonly id?: number
  /**
   * Kill code.
   */
  readonly kill?: KillBehavior | 1
  /**
   * Error.
   */
  readonly error?: string
  /**
   * Reference to main worker.
   *
   * _Only for internal use_
   */
  readonly parent?: MainWorker
}

/**
 *
 */
export type JustTempValue = {
  /**
   * Input data that will be passed to the worker.
   */
  readonly resolve?: Function
  /**
   * ID of the message.
   */
  readonly reject?: Function
  readonly worker: Worker | MessagePort | unknown
}
