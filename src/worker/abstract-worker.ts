import { AsyncResource } from 'async_hooks'
import type { Worker } from 'cluster'
import type { MessagePort } from 'worker_threads'
import type { MessageValue, WorkerUsage } from '../utility-types'
import { EMPTY_FUNCTION } from '../utils'
import { CircularArray } from './circular-array'
import type { KillBehavior, WorkerOptions } from './worker-options'
import { KillBehaviors } from './worker-options'

const DEFAULT_MAX_INACTIVE_TIME = 1000 * 60
const DEFAULT_KILL_BEHAVIOR: KillBehavior = KillBehaviors.SOFT

/**
 * Base class containing some shared logic for all poolifier workers.
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
   * Id of the last task processed by this worker.
   */
  protected lastTaskId: number
  /**
   * Timestamp of the last task processed by this worker.
   */
  protected lastTaskTimestamp: number
  /**
   * Handler Id of the `aliveInterval` alive check.
   */
  protected readonly aliveInterval?: NodeJS.Timeout
  /**
   * Worker usage circular history.
   */
  public readonly usageHistory?: CircularArray<WorkerUsage>
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
    protected mainWorker?: MainWorker | null,
    public readonly opts: WorkerOptions = {
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
    this.checkWorkerOptions(this.opts)
    this.lastTaskId = 0
    this.lastTaskTimestamp = Date.now()
    if (this.opts.usage) {
      this.usageHistory = new CircularArray<WorkerUsage>()
    }
    this.checkFunctionInput(fn)
    // Keep the worker active
    if (!isMain) {
      this.aliveInterval = setInterval(
        this.checkAlive.bind(this),
        (this.opts.maxInactiveTime ?? DEFAULT_MAX_INACTIVE_TIME) / 2
      )
      this.checkAlive.bind(this)()
    }

    this.mainWorker?.on('message', (value: MessageValue<Data, MainWorker>) => {
      if (value?.data && value.id) {
        this.lastTaskId++
        // Here you will receive messages
        if (this.opts.async) {
          this.runInAsyncScope(this.runAsync.bind(this), this, fn, value)
        } else {
          this.runInAsyncScope(this.run.bind(this), this, fn, value)
        }
      } else if (value.parent) {
        // Save a reference of the main worker to communicate with it
        // This will be received once
        this.mainWorker = value.parent
      } else if (value.kill) {
        // Here is time to kill this worker, just clearing the interval
        if (this.aliveInterval) clearInterval(this.aliveInterval)
        this.emitDestroy()
      }
    })
  }

  private checkWorkerOptions (opts: WorkerOptions) {
    this.opts.killBehavior = opts.killBehavior ?? DEFAULT_KILL_BEHAVIOR
    this.opts.maxInactiveTime =
      opts.maxInactiveTime ?? DEFAULT_MAX_INACTIVE_TIME
    this.opts.async = !!opts.async
    this.opts.usage = !!opts.usage
  }

  /**
   * Check if the `fn` parameter is passed to the constructor.
   *
   * @param fn The function that should be defined.
   */
  private checkFunctionInput (fn: (data: Data) => Response): void {
    if (!fn) throw new Error('fn parameter is mandatory')
  }

  /**
   * Worker identifier.
   */
  protected abstract get id (): number

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
   * Send a message to the main worker.
   *
   * @param message The response message.
   */
  protected abstract sendToMainWorker (message: MessageValue<Response>): void

  /**
   * Check to see if the worker should be terminated, because its living too long.
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
   * Handle an error and convert it to a string so it can be sent back to the main worker.
   *
   * @param e The error raised by the worker.
   * @returns Message of the error.
   */
  protected handleError (e: Error | string): string {
    return (e as unknown) as string
  }

  /**
   * Run the given function synchronously.
   *
   * @param fn Function that will be executed.
   * @param value Input data for the given function.
   */
  protected run (
    fn: (data?: Data) => Response,
    value: MessageValue<Data>
  ): void {
    try {
      const startTaskTimestamp = this.beforeRunHook()
      const res = fn(value.data)
      this.afterRunHook(startTaskTimestamp)
      this.sendToMainWorker({ data: res, id: value.id })
    } catch (e) {
      const err = this.handleError(e)
      this.sendToMainWorker({ error: err, id: value.id })
    } finally {
      this.lastTaskTimestamp = Date.now()
    }
  }

  /**
   * Run the given function asynchronously.
   *
   * @param fn Function that will be executed.
   * @param value Input data for the given function.
   */
  protected runAsync (
    fn: (data?: Data) => Promise<Response>,
    value: MessageValue<Data>
  ): void {
    const startTaskTimestamp = this.beforeRunHook()
    fn(value.data)
      .then(res => {
        this.afterRunHook(startTaskTimestamp)
        this.sendToMainWorker({ data: res, id: value.id })
        return null
      })
      .catch(e => {
        const err = this.handleError(e)
        this.sendToMainWorker({ error: err, id: value.id })
      })
      .finally(() => {
        this.lastTaskTimestamp = Date.now()
      })
      .catch(EMPTY_FUNCTION)
  }

  private beforeRunHook (): number {
    if (this.opts.usage) {
      this.addUsageSample()
      return Date.now()
    }
    return 0
  }

  private afterRunHook (startTaskTimestamp: number): void {
    if (this.opts.usage) {
      const taskRunTime = Date.now() - startTaskTimestamp
      this.addUsageSample(taskRunTime)
    }
  }

  private addUsageSample (taskRunTime = 0): void {
    this.usageHistory?.push({
      taskId: this.lastTaskId,
      timestamp: Date.now(),
      taskRunTime: taskRunTime,
      cpu: process.cpuUsage(),
      memory: process.memoryUsage()
    })
  }
}
