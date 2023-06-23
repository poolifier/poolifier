import { AsyncResource } from 'node:async_hooks'
import type { Worker } from 'node:cluster'
import type { MessagePort } from 'node:worker_threads'
import { performance } from 'node:perf_hooks'
import type {
  MessageValue,
  TaskPerformance,
  WorkerStatistics
} from '../utility-types'
import { EMPTY_FUNCTION, isPlainObject } from '../utils'
import {
  type KillBehavior,
  KillBehaviors,
  type WorkerOptions
} from './worker-options'
import type {
  TaskFunctions,
  WorkerAsyncFunction,
  WorkerFunction,
  WorkerSyncFunction
} from './worker-functions'

const DEFAULT_FUNCTION_NAME = 'default'
const DEFAULT_MAX_INACTIVE_TIME = 60000
const DEFAULT_KILL_BEHAVIOR: KillBehavior = KillBehaviors.SOFT

/**
 * Base class that implements some shared logic for all poolifier workers.
 *
 * @typeParam MainWorker - Type of main worker.
 * @typeParam Data - Type of data this worker receives from pool's execution. This can only be serializable data.
 * @typeParam Response - Type of response the worker sends back to the main worker. This can only be serializable data.
 */
export abstract class AbstractWorker<
  MainWorker extends Worker | MessagePort,
  Data = unknown,
  Response = unknown
> extends AsyncResource {
  /**
   * Task function(s) processed by the worker when the pool's `execution` function is invoked.
   */
  protected taskFunctions!: Map<string, WorkerFunction<Data, Response>>
  /**
   * Timestamp of the last task processed by this worker.
   */
  protected lastTaskTimestamp!: number
  /**
   * Performance statistics computation.
   */
  protected statistics!: WorkerStatistics
  /**
   * Handler id of the `aliveInterval` worker alive check.
   */
  protected readonly aliveInterval?: NodeJS.Timeout
  /**
   * Constructs a new poolifier worker.
   *
   * @param type - The type of async event.
   * @param isMain - Whether this is the main worker or not.
   * @param taskFunctions - Task function(s) processed by the worker when the pool's `execution` function is invoked. The first function is the default function.
   * @param mainWorker - Reference to main worker.
   * @param opts - Options for the worker.
   */
  public constructor (
    type: string,
    protected readonly isMain: boolean,
    taskFunctions:
    | WorkerFunction<Data, Response>
    | TaskFunctions<Data, Response>,
    protected mainWorker: MainWorker | undefined | null,
    protected readonly opts: WorkerOptions = {
      /**
       * The kill behavior option on this worker or its default value.
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
    this.checkTaskFunctions(taskFunctions)
    if (!this.isMain) {
      this.lastTaskTimestamp = performance.now()
      this.aliveInterval = setInterval(
        this.checkAlive.bind(this),
        (this.opts.maxInactiveTime ?? DEFAULT_MAX_INACTIVE_TIME) / 2
      )
      this.checkAlive.bind(this)()
    }
    this.mainWorker?.on('message', this.messageListener.bind(this))
  }

  private checkWorkerOptions (opts: WorkerOptions): void {
    this.opts.killBehavior = opts.killBehavior ?? DEFAULT_KILL_BEHAVIOR
    this.opts.maxInactiveTime =
      opts.maxInactiveTime ?? DEFAULT_MAX_INACTIVE_TIME
    delete this.opts.async
  }

  /**
   * Checks if the `taskFunctions` parameter is passed to the constructor.
   *
   * @param taskFunctions - The task function(s) parameter that should be checked.
   */
  private checkTaskFunctions (
    taskFunctions:
    | WorkerFunction<Data, Response>
    | TaskFunctions<Data, Response>
  ): void {
    if (taskFunctions == null) {
      throw new Error('taskFunctions parameter is mandatory')
    }
    this.taskFunctions = new Map<string, WorkerFunction<Data, Response>>()
    if (typeof taskFunctions === 'function') {
      this.taskFunctions.set(DEFAULT_FUNCTION_NAME, taskFunctions.bind(this))
    } else if (isPlainObject(taskFunctions)) {
      let firstEntry = true
      for (const [name, fn] of Object.entries(taskFunctions)) {
        if (typeof fn !== 'function') {
          throw new TypeError(
            'A taskFunctions parameter object value is not a function'
          )
        }
        this.taskFunctions.set(name, fn.bind(this))
        if (firstEntry) {
          this.taskFunctions.set(DEFAULT_FUNCTION_NAME, fn.bind(this))
          firstEntry = false
        }
      }
      if (firstEntry) {
        throw new Error('taskFunctions parameter object is empty')
      }
    } else {
      throw new TypeError(
        'taskFunctions parameter is not a function or a plain object'
      )
    }
  }

  /**
   * Worker message listener.
   *
   * @param message - Message received.
   */
  protected messageListener (
    message: MessageValue<Data, Data, MainWorker>
  ): void {
    if (message.id != null && message.data != null) {
      // Task message received
      const fn = this.getTaskFunction(message.name)
      if (fn?.constructor.name === 'AsyncFunction') {
        this.runInAsyncScope(this.runAsync.bind(this), this, fn, message)
      } else {
        this.runInAsyncScope(this.runSync.bind(this), this, fn, message)
      }
    } else if (message.parent != null) {
      // Main worker reference message received
      this.mainWorker = message.parent
    } else if (message.statistics != null) {
      // Statistics message received
      this.statistics = message.statistics
    } else if (message.kill != null) {
      // Kill message received
      this.aliveInterval != null && clearInterval(this.aliveInterval)
      this.emitDestroy()
    }
  }

  /**
   * Returns the main worker.
   *
   * @returns Reference to the main worker.
   */
  protected getMainWorker (): MainWorker {
    if (this.mainWorker == null) {
      throw new Error('Main worker was not set')
    }
    return this.mainWorker
  }

  /**
   * Sends a message to the main worker.
   *
   * @param message - The response message.
   */
  protected abstract sendToMainWorker (
    message: MessageValue<Response, Data>
  ): void

  /**
   * Checks if the worker should be terminated, because its living too long.
   */
  protected checkAlive (): void {
    if (
      performance.now() - this.lastTaskTimestamp >
      (this.opts.maxInactiveTime ?? DEFAULT_MAX_INACTIVE_TIME)
    ) {
      this.sendToMainWorker({ kill: this.opts.killBehavior })
    }
  }

  /**
   * Handles an error and convert it to a string so it can be sent back to the main worker.
   *
   * @param e - The error raised by the worker.
   * @returns Message of the error.
   */
  protected handleError (e: Error | string): string {
    return e as string
  }

  /**
   * Runs the given function synchronously.
   *
   * @param fn - Function that will be executed.
   * @param message - Input data for the given function.
   */
  protected runSync (
    fn: WorkerSyncFunction<Data, Response>,
    message: MessageValue<Data>
  ): void {
    try {
      let taskPerformance = this.beginTaskPerformance()
      const res = fn(message.data)
      taskPerformance = this.endTaskPerformance(taskPerformance)
      this.sendToMainWorker({
        data: res,
        taskPerformance,
        id: message.id
      })
    } catch (e) {
      const err = this.handleError(e as Error)
      this.sendToMainWorker({
        taskError: {
          message: err,
          data: message.data
        },
        id: message.id
      })
    } finally {
      !this.isMain && (this.lastTaskTimestamp = performance.now())
    }
  }

  /**
   * Runs the given function asynchronously.
   *
   * @param fn - Function that will be executed.
   * @param message - Input data for the given function.
   */
  protected runAsync (
    fn: WorkerAsyncFunction<Data, Response>,
    message: MessageValue<Data>
  ): void {
    let taskPerformance = this.beginTaskPerformance()
    fn(message.data)
      .then(res => {
        taskPerformance = this.endTaskPerformance(taskPerformance)
        this.sendToMainWorker({
          data: res,
          taskPerformance,
          id: message.id
        })
        return null
      })
      .catch(e => {
        const err = this.handleError(e as Error)
        this.sendToMainWorker({
          taskError: {
            message: err,
            data: message.data
          },
          id: message.id
        })
      })
      .finally(() => {
        !this.isMain && (this.lastTaskTimestamp = performance.now())
      })
      .catch(EMPTY_FUNCTION)
  }

  /**
   * Gets the task function in the given scope.
   *
   * @param name - Name of the function that will be returned.
   */
  private getTaskFunction (name?: string): WorkerFunction<Data, Response> {
    name = name ?? DEFAULT_FUNCTION_NAME
    const fn = this.taskFunctions.get(name)
    if (fn == null) {
      throw new Error(`Task function '${name}' not found`)
    }
    return fn
  }

  private beginTaskPerformance (): TaskPerformance {
    return {
      timestamp: performance.now(),
      ...(this.statistics.elu && { elu: performance.eventLoopUtilization() })
    }
  }

  private endTaskPerformance (
    taskPerformance: TaskPerformance
  ): TaskPerformance {
    return {
      ...taskPerformance,
      ...(this.statistics.runTime && {
        runTime: performance.now() - taskPerformance.timestamp
      }),
      ...(this.statistics.elu && {
        elu: performance.eventLoopUtilization(taskPerformance.elu)
      })
    }
  }
}
