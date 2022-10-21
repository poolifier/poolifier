import { AsyncResource } from 'async_hooks'
import type { Worker } from 'cluster'
import type { MessagePort } from 'worker_threads'
import type { MessageValue } from '../utility-types'
import { EMPTY_FUNCTION } from '../utils'
import { SharedUsage } from './shared-usage'
import type { KillBehavior, WorkerOptions } from './worker-options'
import { KillBehaviors } from './worker-options'

const DEFAULT_MAX_INACTIVE_TIME = 60000
const DEFAULT_KILL_BEHAVIOR: KillBehavior = KillBehaviors.SOFT

/**
 * Base class that implements some shared logic for all poolifier workers.
 *
 * @template MainWorker Type of main worker.
 * @template Data Type of data this worker receives from pool's execution. This can only be serializable data.
 * @template Response Type of response the worker sends back to the main worker. This can only be serializable data.
 */
export abstract class AbstractWorker<
  MainWorker extends Worker | MessagePort,
  Data = unknown,
  Response = unknown
> extends AsyncResource {
  /**
   * Tasks shared usage statistics.
   */
  protected tasksSharedUsage!: SharedUsage
  /**
   * Timestamp of the last task processed by this worker.
   * TODO: move into tasksSharedUsage.
   */
  protected lastTaskTimestamp: number
  /**
   * Handler Id of the `aliveInterval` worker alive check.
   */
  protected readonly aliveInterval?: NodeJS.Timeout
  /**
   * Options for the worker.
   */
  public readonly opts: WorkerOptions
  /**
   * Constructs a new poolifier worker.
   *
   * @param type The type of async event.
   * @param isMain Whether this is the main worker or not.
   * @param fn Function processed by the worker when the pool's `execution` function is invoked.
   * @param mainWorker Reference to main worker.
   * @param opts Options for the worker.
   */
  public constructor (
    type: string,
    isMain: boolean,
    fn: (data: Data) => Response,
    protected mainWorker: MainWorker | undefined | null,
    opts: WorkerOptions = {
      /**
       * The kill behavior option on this Worker or its default value.
       */
      killBehavior: DEFAULT_KILL_BEHAVIOR,
      /**
       * The maximum time to keep this worker alive while idle.
       * The pool automatically checks and terminates this worker when the time expires.
       */
      maxInactiveTime: DEFAULT_MAX_INACTIVE_TIME
    }
  ) {
    super(type)
    this.opts = opts
    this.checkFunctionInput(fn)
    this.checkWorkerOptions(this.opts)
    this.lastTaskTimestamp = Date.now()
    // Keep the worker active
    if (isMain === false) {
      this.aliveInterval = setInterval(
        this.checkAlive.bind(this),
        (this.opts.maxInactiveTime ?? DEFAULT_MAX_INACTIVE_TIME) / 2
      )
      this.checkAlive.bind(this)()
    }

    this.mainWorker?.on('message', (value: MessageValue<Data, MainWorker>) => {
      this.messageListener(value, fn)
    })
  }

  protected messageListener (
    value: MessageValue<Data, MainWorker>,
    fn: (data: Data) => Response
  ): void {
    if (
      value.numberOfWorkers !== undefined &&
      value.tasksSharedUsage !== undefined
    ) {
      if (!this.tasksSharedUsage) {
        this.tasksSharedUsage = new SharedUsage(
          value.numberOfWorkers,
          value.tasksSharedUsage
        )
      }
    } else if (
      value.data !== undefined &&
      value.id !== undefined &&
      value.workerId !== undefined
    ) {
      // Here you will receive messages
      if (this.opts.async === true) {
        this.runInAsyncScope(this.runAsync.bind(this), this, fn, value)
      } else {
        this.runInAsyncScope(this.run.bind(this), this, fn, value)
      }
    } else if (value.parent !== undefined) {
      // Save a reference of the main worker to communicate with it
      // This will be received once
      this.mainWorker = value.parent
    } else if (value.kill !== undefined) {
      // Here is time to kill this worker, just clearing the interval
      if (this.aliveInterval) clearInterval(this.aliveInterval)
      this.emitDestroy()
    }
  }

  private checkWorkerOptions (opts: WorkerOptions) {
    this.opts.killBehavior = opts.killBehavior ?? DEFAULT_KILL_BEHAVIOR
    this.opts.maxInactiveTime =
      opts.maxInactiveTime ?? DEFAULT_MAX_INACTIVE_TIME
    /**
     * Whether the worker is working asynchronously or not.
     */
    this.opts.async = !!opts.async
  }

  /**
   * Checks if the `fn` parameter is passed to the constructor.
   *
   * @param fn The function that should be defined.
   */
  private checkFunctionInput (fn: (data: Data) => Response): void {
    if (!fn) throw new Error('fn parameter is mandatory')
  }

  /**
   * Returns the main worker.
   *
   * @returns Reference to the main worker.
   */
  protected getMainWorker (): MainWorker {
    if (!this.mainWorker) {
      throw new Error('Main worker was not set')
    }
    return this.mainWorker
  }

  /**
   * Sends a message to the main worker.
   *
   * @param message The response message.
   */
  protected abstract sendToMainWorker (message: MessageValue<Response>): void

  /**
   * Checks if the worker should be terminated, because its living too long.
   */
  protected checkAlive (): void {
    if (
      Date.now() - this.lastTaskTimestamp >
      (this.opts.maxInactiveTime ?? DEFAULT_MAX_INACTIVE_TIME)
    ) {
      this.sendToMainWorker({ kill: this.opts.killBehavior })
    }
  }

  /**
   * Handles an error and convert it to a string so it can be sent back to the main worker.
   *
   * @param e The error raised by the worker.
   * @returns Message of the error.
   */
  protected handleError (e: Error | string): string {
    return e as string
  }

  /**
   * Runs the given function synchronously.
   *
   * @param fn Function that will be executed.
   * @param value Input data for the given function.
   */
  protected run (
    fn: (data?: Data) => Response,
    value: MessageValue<Data>
  ): void {
    try {
      this.beforeRunHook(value.workerId)
      const startTaskTimestamp = Date.now()
      const res = fn(value.data)
      const taskRunTime = Date.now() - startTaskTimestamp
      this.afterRunHook(value.workerId, taskRunTime)
      this.sendToMainWorker({ data: res, id: value.id, taskRunTime })
    } catch (e) {
      const err = this.handleError(e as Error)
      this.sendToMainWorker({ error: err, id: value.id })
    } finally {
      this.lastTaskTimestamp = Date.now()
    }
  }

  /**
   * Runs the given function asynchronously.
   *
   * @param fn Function that will be executed.
   * @param value Input data for the given function.
   */
  protected runAsync (
    fn: (data?: Data) => Promise<Response>,
    value: MessageValue<Data>
  ): void {
    this.beforeRunHook(value.workerId)
    const startTaskTimestamp = Date.now()
    fn(value.data)
      .then(res => {
        const taskRunTime = Date.now() - startTaskTimestamp
        this.afterRunHook(value.workerId, taskRunTime)
        this.sendToMainWorker({ data: res, id: value.id, taskRunTime })
        return null
      })
      .catch(e => {
        const err = this.handleError(e as Error)
        this.sendToMainWorker({ error: err, id: value.id })
      })
      .finally(() => {
        this.lastTaskTimestamp = Date.now()
      })
      .catch(EMPTY_FUNCTION)
  }

  /**
   * Hook executed before a task is run.
   * Can be overridden.
   *
   * @param workerId The worker index.
   */
  protected beforeRunHook (workerId: number | undefined): void {
    if (workerId === undefined) {
      throw new Error('Worker id not defined')
    }
    if (!this.tasksSharedUsage) {
      throw new Error('Tasks shared usage not initialized')
    }
    this.tasksSharedUsage[`worker${workerId}-running`]++
    // this.tasksSharedUsage.consoleDump()
  }

  /**
   * Hook executed after a task is run.
   * Can be overridden.
   *
   * @param workerId The worker index.
   * @param taskRunTime The task run time.
   */
  protected afterRunHook (
    workerId: number | undefined,
    taskRunTime: number
  ): void {
    if (workerId === undefined) {
      throw new Error('Worker id not defined')
    }
    if (!this.tasksSharedUsage) {
      throw new Error('Tasks shared usage not initialized')
    }
    this.tasksSharedUsage[`worker${workerId}-running`]--
    this.tasksSharedUsage[`worker${workerId}-run`]++
    this.updateWorkerTasksSharedUsageRunTime(workerId, taskRunTime)
    // this.tasksSharedUsage.consoleDump()
  }

  private updateWorkerTasksSharedUsageRunTime (
    workerId: number | undefined,
    taskRunTime: number
  ) {
    this.tasksSharedUsage[`worker${workerId as number}-runTime`] += taskRunTime
    if (this.tasksSharedUsage[`worker${workerId as number}-run`] !== 0) {
      this.tasksSharedUsage[`worker${workerId as number}-avgRunTime`] =
        this.tasksSharedUsage[`worker${workerId as number}-runTime`] /
        this.tasksSharedUsage[`worker${workerId as number}-run`]
    }
  }
}
