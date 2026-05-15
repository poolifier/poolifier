/**
 * Pool-level typed error classes.
 *
 * `*Options` interfaces are file-scoped exports for TS4063 declaration-emit
 * compliance and are deliberately NOT re-exported from `src/index.ts`.
 *
 * For discrimination semantics and dual-package (CJS/ESM) guidance, see
 * `docs/api.md` §"Error handling on worker crash".
 */

import type { TaskUUID } from '../utility-types.js'

/**
 * Options for {@link WorkerCrashError}.
 *
 * `taskId` is set by the pool at rejection time so fire-and-forget callers
 * can identify which task failed when handling N concurrent in-flight tasks.
 *
 * `exitCode` and `signal` mirror the args of Node's worker `'exit'` event.
 * For thread workers the `'exit'` event passes `(exitCode)` only — `signal`
 * is normalised to `null` at construction.
 * @internal
 */
export interface WorkerCrashErrorOptions {
  readonly cause?: unknown
  readonly exitCode?: null | number
  readonly signal?: NodeJS.Signals | null
  readonly taskId?: TaskUUID
  readonly workerId?: number
}

/**
 * Options for {@link WorkerTerminationError}.
 * @internal
 */
export interface WorkerTerminationErrorOptions {
  readonly cause?: unknown
  readonly taskId?: TaskUUID
  readonly workerId?: number
}

/**
 * Raised when a task promise is rejected because its assigned worker exited
 * unexpectedly (uncaught exception, signal kill, OOM-killer,
 * `process.exit(N)` from worker code, etc.).
 */
export class WorkerCrashError extends Error {
  public readonly exitCode: null | number
  public readonly signal: NodeJS.Signals | null
  public readonly taskId?: TaskUUID
  public readonly workerId?: number
  public constructor (message: string, options: WorkerCrashErrorOptions = {}) {
    super(message, options.cause != null ? { cause: options.cause } : undefined)
    Object.setPrototypeOf(this, new.target.prototype)
    // Tamper-resistant `name`: non-writable so subclass shadowing or
    // `Object.assign(err, { name: 'fake' })` cannot break the string-equal
    // discrimination contract documented in docs/api.md.
    Object.defineProperty(this, 'name', {
      configurable: false,
      enumerable: false,
      value: 'WorkerCrashError',
      writable: false,
    })
    this.exitCode = options.exitCode ?? null
    this.signal = options.signal ?? null
    this.taskId = options.taskId
    this.workerId = options.workerId
  }
}

/**
 * Raised when a task promise is rejected because the pool initiated worker
 * termination while the task was still in-flight (`pool.destroy()` reached
 * its `tasksFinishedTimeout`, or a queued task could not be redistributed).
 */
export class WorkerTerminationError extends Error {
  public readonly taskId?: TaskUUID
  public readonly workerId?: number
  public constructor (
    message: string,
    options: WorkerTerminationErrorOptions = {}
  ) {
    super(message, options.cause != null ? { cause: options.cause } : undefined)
    Object.setPrototypeOf(this, new.target.prototype)
    Object.defineProperty(this, 'name', {
      configurable: false,
      enumerable: false,
      value: 'WorkerTerminationError',
      writable: false,
    })
    this.taskId = options.taskId
    this.workerId = options.workerId
  }
}
