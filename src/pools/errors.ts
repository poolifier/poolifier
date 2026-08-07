import type { TaskUUID } from '../utility-types.js'

/**
 * Options for {@link WorkerCrashError}.
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
 * Raised when a task is submitted to a pool that has become unrecoverable, i.e.
 * its worker restart circuit breaker has tripped and it can no longer replace
 * faulted workers. Fails fast instead of queuing tasks that can never run.
 */
export class PoolUnrecoverableError extends Error {
  public constructor (message: string) {
    super(message)
    Object.setPrototypeOf(this, new.target.prototype)
    // Non-writable per the documented `error.name` discrimination contract.
    Object.defineProperty(this, 'name', {
      configurable: false,
      enumerable: false,
      value: 'PoolUnrecoverableError',
      writable: false,
    })
  }
}

/**
 * Raised when a task promise is rejected because its assigned worker exited
 * abnormally. Abnormal exits include worker errors, signal exits, nonzero exit
 * codes, and exit code `0` while the worker still owns an in-flight task.
 *
 * For cluster workers, `exitCode` and `signal` preserve raw Node.js exit-event
 * semantics.
 */
export class WorkerCrashError extends Error {
  /** Raw Node.js exit code, or `null` when unavailable or signal-terminated. */
  public declare readonly exitCode: null | number
  /** Raw Node.js exit signal, or `null` when the exit was not signal-driven. */
  public declare readonly signal: NodeJS.Signals | null
  /** Identifier of the task rejected by this error. */
  public declare readonly taskId?: TaskUUID
  /** Stable runtime identifier of the worker that owned the task. */
  public declare readonly workerId?: number
  public constructor (message: string, options: WorkerCrashErrorOptions = {}) {
    super(message, options.cause != null ? { cause: options.cause } : undefined)
    Object.setPrototypeOf(this, new.target.prototype)
    // Non-writable per the documented `error.name` discrimination contract.
    Object.defineProperty(this, 'name', {
      configurable: false,
      enumerable: false,
      value: 'WorkerCrashError',
      writable: false,
    })
    Object.defineProperties(this, {
      exitCode: {
        configurable: false,
        enumerable: true,
        value: options.exitCode ?? null,
        writable: false,
      },
      signal: {
        configurable: false,
        enumerable: true,
        value: options.signal ?? null,
        writable: false,
      },
      taskId: {
        configurable: false,
        enumerable: true,
        value: options.taskId,
        writable: false,
      },
      workerId: {
        configurable: false,
        enumerable: true,
        value: options.workerId,
        writable: false,
      },
    })
  }
}

/**
 * Raised when pool-initiated worker termination cannot preserve a task's
 * normal outcome. This includes an in-flight task that remains pending when
 * `tasksFinishedTimeout` expires and a queued task that cannot be redistributed.
 * Full-pool destruction does not redistribute queued tasks.
 */
export class WorkerTerminationError extends Error {
  /** Identifier of the task rejected by this error. */
  public readonly taskId?: TaskUUID
  /** Stable runtime identifier of the worker that owned the task. */
  public readonly workerId?: number
  public constructor (
    message: string,
    options: WorkerTerminationErrorOptions = {}
  ) {
    super(message, options.cause != null ? { cause: options.cause } : undefined)
    Object.setPrototypeOf(this, new.target.prototype)
    // Non-writable per the documented `error.name` discrimination contract.
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
