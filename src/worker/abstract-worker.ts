import { AsyncResource } from 'node:async_hooks'
import type { Worker } from 'node:cluster'
import type { MessagePort } from 'node:worker_threads'
import { performance } from 'node:perf_hooks'
import type {
  MessageValue,
  Task,
  TaskPerformance,
  WorkerStatistics
} from '../utility-types'
import {
  DEFAULT_TASK_NAME,
  EMPTY_FUNCTION,
  isAsyncFunction,
  isPlainObject
} from '../utils'
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

const DEFAULT_MAX_INACTIVE_TIME = 60000
const DEFAULT_KILL_BEHAVIOR: KillBehavior = KillBehaviors.SOFT

/**
 * Base class that implements some shared logic for all poolifier workers.
 *
 * @typeParam MainWorker - Type of main worker.
 * @typeParam Data - Type of data this worker receives from pool's execution. This can only be structured-cloneable data.
 * @typeParam Response - Type of response the worker sends back to the main worker. This can only be structured-cloneable data.
 */
export abstract class AbstractWorker<
  MainWorker extends Worker | MessagePort,
  Data = unknown,
  Response = unknown
> extends AsyncResource {
  /**
   * Worker id.
   */
  protected abstract id: number
  /**
   * Task function(s) processed by the worker when the pool's `execution` function is invoked.
   */
  protected taskFunctions!: Map<string, WorkerFunction<Data, Response>>
  /**
   * Timestamp of the last task processed by this worker.
   */
  protected lastTaskTimestamp!: number
  /**
   * Performance statistics computation requirements.
   */
  protected statistics!: WorkerStatistics
  /**
   * Handler id of the `activeInterval` worker activity check.
   */
  protected activeInterval?: NodeJS.Timeout
  /**
   * Constructs a new poolifier worker.
   *
   * @param type - The type of async event.
   * @param isMain - Whether this is the main worker or not.
   * @param mainWorker - Reference to main worker.
   * @param taskFunctions - Task function(s) processed by the worker when the pool's `execution` function is invoked. The first function is the default function.
   * @param opts - Options for the worker.
   */
  public constructor (
    type: string,
    protected readonly isMain: boolean,
    private readonly mainWorker: MainWorker,
    taskFunctions:
    | WorkerFunction<Data, Response>
    | TaskFunctions<Data, Response>,
    protected readonly opts: WorkerOptions = {
      /**
       * The kill behavior option on this worker or its default value.
       */
      killBehavior: DEFAULT_KILL_BEHAVIOR,
      /**
       * The maximum time to keep this worker active while idle.
       * The pool automatically checks and terminates this worker when the time expires.
       */
      maxInactiveTime: DEFAULT_MAX_INACTIVE_TIME
    }
  ) {
    super(type)
    this.checkWorkerOptions(this.opts)
    this.checkTaskFunctions(taskFunctions)
    if (!this.isMain) {
      this.getMainWorker()?.on('message', this.handleReadyMessage.bind(this))
    }
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
      const boundFn = taskFunctions.bind(this)
      this.taskFunctions.set(DEFAULT_TASK_NAME, boundFn)
      this.taskFunctions.set(
        typeof taskFunctions.name === 'string' &&
          taskFunctions.name.trim().length > 0
          ? taskFunctions.name
          : 'fn1',
        boundFn
      )
    } else if (isPlainObject(taskFunctions)) {
      let firstEntry = true
      for (const [name, fn] of Object.entries(taskFunctions)) {
        if (typeof name !== 'string') {
          throw new TypeError(
            'A taskFunctions parameter object key is not a string'
          )
        }
        if (typeof fn !== 'function') {
          throw new TypeError(
            'A taskFunctions parameter object value is not a function'
          )
        }
        const boundFn = fn.bind(this)
        if (firstEntry) {
          this.taskFunctions.set(DEFAULT_TASK_NAME, boundFn)
          firstEntry = false
        }
        this.taskFunctions.set(name, boundFn)
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
   * Checks if the worker has a task function with the given name.
   *
   * @param name - The name of the task function to check.
   * @returns Whether the worker has a task function with the given name or not.
   * @throws {@link https://nodejs.org/api/errors.html#class-typeerror} If the `name` parameter is not a string.
   */
  public hasTaskFunction (name: string): boolean {
    if (typeof name !== 'string') {
      throw new TypeError('name parameter is not a string')
    }
    return this.taskFunctions.has(name)
  }

  /**
   * Adds a task function to the worker.
   * If a task function with the same name already exists, it is replaced.
   *
   * @param name - The name of the task function to add.
   * @param fn - The task function to add.
   * @returns Whether the task function was added or not.
   * @throws {@link https://nodejs.org/api/errors.html#class-typeerror} If the `name` parameter is not a string.
   * @throws {@link https://nodejs.org/api/errors.html#class-error} If the `name` parameter is the default task function reserved name.
   * @throws {@link https://nodejs.org/api/errors.html#class-typeerror} If the `fn` parameter is not a function.
   */
  public addTaskFunction (
    name: string,
    fn: WorkerFunction<Data, Response>
  ): boolean {
    if (typeof name !== 'string') {
      throw new TypeError('name parameter is not a string')
    }
    if (name === DEFAULT_TASK_NAME) {
      throw new Error(
        'Cannot add a task function with the default reserved name'
      )
    }
    if (typeof fn !== 'function') {
      throw new TypeError('fn parameter is not a function')
    }
    try {
      const boundFn = fn.bind(this)
      if (
        this.taskFunctions.get(name) ===
        this.taskFunctions.get(DEFAULT_TASK_NAME)
      ) {
        this.taskFunctions.set(DEFAULT_TASK_NAME, boundFn)
      }
      this.taskFunctions.set(name, boundFn)
      return true
    } catch {
      return false
    }
  }

  /**
   * Removes a task function from the worker.
   *
   * @param name - The name of the task function to remove.
   * @returns Whether the task function existed and was removed or not.
   * @throws {@link https://nodejs.org/api/errors.html#class-typeerror} If the `name` parameter is not a string.
   * @throws {@link https://nodejs.org/api/errors.html#class-error} If the `name` parameter is the default task function reserved name.
   * @throws {@link https://nodejs.org/api/errors.html#class-error} If the `name` parameter is the task function used as default task function.
   */
  public removeTaskFunction (name: string): boolean {
    if (typeof name !== 'string') {
      throw new TypeError('name parameter is not a string')
    }
    if (name === DEFAULT_TASK_NAME) {
      throw new Error(
        'Cannot remove the task function with the default reserved name'
      )
    }
    if (
      this.taskFunctions.get(name) === this.taskFunctions.get(DEFAULT_TASK_NAME)
    ) {
      throw new Error(
        'Cannot remove the task function used as the default task function'
      )
    }
    return this.taskFunctions.delete(name)
  }

  /**
   * Lists the names of the worker's task functions.
   *
   * @returns The names of the worker's task functions.
   */
  public listTaskFunctions (): string[] {
    return Array.from(this.taskFunctions.keys())
  }

  /**
   * Sets the default task function to use in the worker.
   *
   * @param name - The name of the task function to use as default task function.
   * @returns Whether the default task function was set or not.
   * @throws {@link https://nodejs.org/api/errors.html#class-typeerror} If the `name` parameter is not a string.
   * @throws {@link https://nodejs.org/api/errors.html#class-error} If the `name` parameter is the default task function reserved name.
   * @throws {@link https://nodejs.org/api/errors.html#class-error} If the `name` parameter is a non-existing task function.
   */
  public setDefaultTaskFunction (name: string): boolean {
    if (typeof name !== 'string') {
      throw new TypeError('name parameter is not a string')
    }
    if (name === DEFAULT_TASK_NAME) {
      throw new Error(
        'Cannot set the default task function reserved name as the default task function'
      )
    }
    if (!this.taskFunctions.has(name)) {
      throw new Error(
        'Cannot set the default task function to a non-existing task function'
      )
    }
    try {
      this.taskFunctions.set(
        DEFAULT_TASK_NAME,
        this.taskFunctions.get(name) as WorkerFunction<Data, Response>
      )
      return true
    } catch {
      return false
    }
  }

  /**
   * Worker message listener.
   *
   * @param message - The received message.
   */
  protected messageListener (message: MessageValue<Data>): void {
    if (message.workerId === this.id) {
      if (message.statistics != null) {
        // Statistics message received
        this.statistics = message.statistics
      } else if (message.checkActive != null) {
        // Check active message received
        !this.isMain && message.checkActive
          ? this.startCheckActive()
          : this.stopCheckActive()
      } else if (message.id != null && message.data != null) {
        // Task message received
        this.run(message)
      } else if (message.kill === true) {
        // Kill message received
        !this.isMain && this.stopCheckActive()
        this.emitDestroy()
      }
    }
  }

  /**
   * Handles the ready message sent by the main worker.
   *
   * @param message - The ready message.
   */
  protected abstract handleReadyMessage (message: MessageValue<Data>): void

  /**
   * Starts the worker check active interval.
   */
  private startCheckActive (): void {
    this.lastTaskTimestamp = performance.now()
    this.activeInterval = setInterval(
      this.checkActive.bind(this),
      (this.opts.maxInactiveTime ?? DEFAULT_MAX_INACTIVE_TIME) / 2
    ).unref()
  }

  /**
   * Stops the worker check active interval.
   */
  private stopCheckActive (): void {
    if (this.activeInterval != null) {
      clearInterval(this.activeInterval)
      delete this.activeInterval
    }
  }

  /**
   * Checks if the worker should be terminated, because its living too long.
   */
  private checkActive (): void {
    if (
      performance.now() - this.lastTaskTimestamp >
      (this.opts.maxInactiveTime ?? DEFAULT_MAX_INACTIVE_TIME)
    ) {
      this.sendToMainWorker({ kill: this.opts.killBehavior, workerId: this.id })
    }
  }

  /**
   * Returns the main worker.
   *
   * @returns Reference to the main worker.
   */
  protected getMainWorker (): MainWorker {
    if (this.mainWorker == null) {
      throw new Error('Main worker not set')
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
   * Handles an error and convert it to a string so it can be sent back to the main worker.
   *
   * @param e - The error raised by the worker.
   * @returns The error message.
   */
  protected handleError (e: Error | string): string {
    return e instanceof Error ? e.message : e
  }

  /**
   * Runs the given task.
   *
   * @param task - The task to execute.
   * @throws {@link https://nodejs.org/api/errors.html#class-error} If the task function is not found.
   */
  protected run (task: Task<Data>): void {
    if (this.isMain) {
      throw new Error('Cannot run a task in the main worker')
    }
    const fn = this.getTaskFunction(task.name)
    if (isAsyncFunction(fn)) {
      this.runInAsyncScope(this.runAsync.bind(this), this, fn, task)
    } else {
      this.runInAsyncScope(this.runSync.bind(this), this, fn, task)
    }
  }

  /**
   * Runs the given task function synchronously.
   *
   * @param fn - Task function that will be executed.
   * @param task - Input data for the task function.
   */
  protected runSync (
    fn: WorkerSyncFunction<Data, Response>,
    task: Task<Data>
  ): void {
    try {
      let taskPerformance = this.beginTaskPerformance(task.name)
      const res = fn(task.data)
      taskPerformance = this.endTaskPerformance(taskPerformance)
      this.sendToMainWorker({
        data: res,
        taskPerformance,
        workerId: this.id,
        id: task.id
      })
    } catch (e) {
      const errorMessage = this.handleError(e as Error | string)
      this.sendToMainWorker({
        taskError: {
          name: task.name ?? DEFAULT_TASK_NAME,
          message: errorMessage,
          data: task.data
        },
        workerId: this.id,
        id: task.id
      })
    } finally {
      this.updateLastTaskTimestamp()
    }
  }

  /**
   * Runs the given task function asynchronously.
   *
   * @param fn - Task function that will be executed.
   * @param task - Input data for the task function.
   */
  protected runAsync (
    fn: WorkerAsyncFunction<Data, Response>,
    task: Task<Data>
  ): void {
    let taskPerformance = this.beginTaskPerformance(task.name)
    fn(task.data)
      .then(res => {
        taskPerformance = this.endTaskPerformance(taskPerformance)
        this.sendToMainWorker({
          data: res,
          taskPerformance,
          workerId: this.id,
          id: task.id
        })
        return null
      })
      .catch(e => {
        const errorMessage = this.handleError(e as Error | string)
        this.sendToMainWorker({
          taskError: {
            name: task.name ?? DEFAULT_TASK_NAME,
            message: errorMessage,
            data: task.data
          },
          workerId: this.id,
          id: task.id
        })
      })
      .finally(() => {
        this.updateLastTaskTimestamp()
      })
      .catch(EMPTY_FUNCTION)
  }

  /**
   * Gets the task function with the given name.
   *
   * @param name - Name of the task function that will be returned.
   * @returns The task function.
   * @throws {@link https://nodejs.org/api/errors.html#class-error} If the task function is not found.
   */
  private getTaskFunction (name?: string): WorkerFunction<Data, Response> {
    name = name ?? DEFAULT_TASK_NAME
    const fn = this.taskFunctions.get(name)
    if (fn == null) {
      throw new Error(`Task function '${name}' not found`)
    }
    return fn
  }

  private beginTaskPerformance (name?: string): TaskPerformance {
    this.checkStatistics()
    return {
      name: name ?? DEFAULT_TASK_NAME,
      timestamp: performance.now(),
      ...(this.statistics.elu && { elu: performance.eventLoopUtilization() })
    }
  }

  private endTaskPerformance (
    taskPerformance: TaskPerformance
  ): TaskPerformance {
    this.checkStatistics()
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

  private checkStatistics (): void {
    if (this.statistics == null) {
      throw new Error('Performance statistics computation requirements not set')
    }
  }

  private updateLastTaskTimestamp (): void {
    if (!this.isMain && this.activeInterval != null) {
      this.lastTaskTimestamp = performance.now()
    }
  }
}
