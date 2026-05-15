/**
 * Pool error classes.
 *
 * Two flat classes extending `Error` directly. Discrimination at runtime is
 * via `error.name === 'WorkerCrashError'` / `error.name ===
 * 'WorkerTerminationError'` — robust across dual-package (CJS/ESM) bundle
 * boundaries. `instanceof` is supported only within a single bundle realm.
 *
 * `*Options` interfaces are `export`ed at file level for TS4063
 * declaration-emit compliance. They are deliberately NOT re-exported from
 * `src/index.ts` — consumers do not construct these errors; the pool does.
 * `package.json:exports` blocks deep imports outside the public barrel.
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
 *
 * Discriminate via `error.name === 'WorkerCrashError'`, which works across
 * dual-package (CJS/ESM) boundaries. `instanceof` is supported only within
 * a single bundle realm.
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
 *
 * Discriminate via `error.name === 'WorkerTerminationError'`.
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
