import type { Worker } from 'node:cluster'
import type { MessagePort } from 'node:worker_threads'
import { performance } from 'node:perf_hooks'
import { EventEmitter } from 'node:events'
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
import { KillBehaviors, type WorkerOptions } from './worker-options'
import type {
  TaskAsyncFunction,
  TaskFunction,
  TaskFunctionOperationResult,
  TaskFunctions,
  TaskSyncFunction
} from './task-functions'
import {
  checkTaskFunctionName,
  checkValidTaskFunctionEntry,
  checkValidWorkerOptions
} from './utils'

interface AbortTaskEventDetail {
  taskId: string
}

const DEFAULT_MAX_INACTIVE_TIME = 60000
const DEFAULT_WORKER_OPTIONS: WorkerOptions = {
  /**
   * The kill behavior option on this worker or its default value.
   */
  killBehavior: KillBehaviors.SOFT,
  /**
   * The maximum time to keep this worker active while idle.
   * The pool automatically checks and terminates this worker when the time expires.
   */
  maxInactiveTime: DEFAULT_MAX_INACTIVE_TIME,
  /**
   * The function to call when the worker is killed.
   */
  killHandler: EMPTY_FUNCTION
}

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
> extends EventEmitter {
  /**
   * Worker id.
   */
  protected abstract id: number
  /**
   * Task function(s) processed by the worker when the pool's `execution` function is invoked.
   */
  protected taskFunctions!: Map<string, TaskFunction<Data, Response>>
  /**
   * Task abort functions processed by the worker when task operation 'abort' is received.
   */
  protected taskAbortFunctions: Map<string, () => void>
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
   * @param isMain - Whether this is the main worker or not.
   * @param mainWorker - Reference to main worker.
   * @param taskFunctions - Task function(s) processed by the worker when the pool's `execution` function is invoked. The first function is the default function.
   * @param opts - Options for the worker.
   */
  public constructor (
    protected readonly isMain: boolean,
    private readonly mainWorker: MainWorker,
    taskFunctions: TaskFunction<Data, Response> | TaskFunctions<Data, Response>,
    protected opts: WorkerOptions = DEFAULT_WORKER_OPTIONS
  ) {
    super()
    if (this.isMain == null) {
      throw new Error('isMain parameter is mandatory')
    }
    this.checkTaskFunctions(taskFunctions)
    this.taskAbortFunctions = new Map<string, () => void>()
    this.on('abortTask', (eventDetail: AbortTaskEventDetail) => {
      const { taskId } = eventDetail
      if (this.taskAbortFunctions.has(taskId)) {
        this.taskAbortFunctions.get(taskId)?.()
        this.taskAbortFunctions.delete(taskId)
      }
    })
    this.checkWorkerOptions(this.opts)
    if (!this.isMain) {
      // Should be once() but Node.js on windows has a bug that prevents it from working
      this.getMainWorker().on('message', this.handleReadyMessage.bind(this))
    }
  }

  private checkWorkerOptions (opts: WorkerOptions): void {
    checkValidWorkerOptions(opts)
    this.opts = { ...DEFAULT_WORKER_OPTIONS, ...opts }
  }

  /**
   * Checks if the `taskFunctions` parameter is passed to the constructor and valid.
   *
   * @param taskFunctions - The task function(s) parameter that should be checked.
   */
  private checkTaskFunctions (
    taskFunctions: TaskFunction<Data, Response> | TaskFunctions<Data, Response>
  ): void {
    if (taskFunctions == null) {
      throw new Error('taskFunctions parameter is mandatory')
    }
    this.taskFunctions = new Map<string, TaskFunction<Data, Response>>()
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
        checkValidTaskFunctionEntry<Data, Response>(name, fn)
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
   */
  public hasTaskFunction (name: string): TaskFunctionOperationResult {
    try {
      checkTaskFunctionName(name)
    } catch (error) {
      return { status: false, error: error as Error }
    }
    return { status: this.taskFunctions.has(name) }
  }

  /**
   * Adds a task function to the worker.
   * If a task function with the same name already exists, it is replaced.
   *
   * @param name - The name of the task function to add.
   * @param fn - The task function to add.
   * @returns Whether the task function was added or not.
   */
  public addTaskFunction (
    name: string,
    fn: TaskFunction<Data, Response>
  ): TaskFunctionOperationResult {
    try {
      checkTaskFunctionName(name)
      if (name === DEFAULT_TASK_NAME) {
        throw new Error(
          'Cannot add a task function with the default reserved name'
        )
      }
      if (typeof fn !== 'function') {
        throw new TypeError('fn parameter is not a function')
      }
      const boundFn = fn.bind(this)
      if (
        this.taskFunctions.get(name) ===
        this.taskFunctions.get(DEFAULT_TASK_NAME)
      ) {
        this.taskFunctions.set(DEFAULT_TASK_NAME, boundFn)
      }
      this.taskFunctions.set(name, boundFn)
      this.sendTaskFunctionNamesToMainWorker()
      return { status: true }
    } catch (error) {
      return { status: false, error: error as Error }
    }
  }

  /**
   * Removes a task function from the worker.
   *
   * @param name - The name of the task function to remove.
   * @returns Whether the task function existed and was removed or not.
   */
  public removeTaskFunction (name: string): TaskFunctionOperationResult {
    try {
      checkTaskFunctionName(name)
      if (name === DEFAULT_TASK_NAME) {
        throw new Error(
          'Cannot remove the task function with the default reserved name'
        )
      }
      if (
        this.taskFunctions.get(name) ===
        this.taskFunctions.get(DEFAULT_TASK_NAME)
      ) {
        throw new Error(
          'Cannot remove the task function used as the default task function'
        )
      }
      const deleteStatus = this.taskFunctions.delete(name)
      this.sendTaskFunctionNamesToMainWorker()
      return { status: deleteStatus }
    } catch (error) {
      return { status: false, error: error as Error }
    }
  }

  /**
   * Lists the names of the worker's task functions.
   *
   * @returns The names of the worker's task functions.
   */
  public listTaskFunctionNames (): string[] {
    const names: string[] = [...this.taskFunctions.keys()]
    let defaultTaskFunctionName: string = DEFAULT_TASK_NAME
    for (const [name, fn] of this.taskFunctions) {
      if (
        name !== DEFAULT_TASK_NAME &&
        fn === this.taskFunctions.get(DEFAULT_TASK_NAME)
      ) {
        defaultTaskFunctionName = name
        break
      }
    }
    return [
      names[names.indexOf(DEFAULT_TASK_NAME)],
      defaultTaskFunctionName,
      ...names.filter(
        name => name !== DEFAULT_TASK_NAME && name !== defaultTaskFunctionName
      )
    ]
  }

  /**
   * Sets the default task function to use in the worker.
   *
   * @param name - The name of the task function to use as default task function.
   * @returns Whether the default task function was set or not.
   */
  public setDefaultTaskFunction (name: string): TaskFunctionOperationResult {
    try {
      checkTaskFunctionName(name)
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
      this.taskFunctions.set(
        DEFAULT_TASK_NAME,
        this.taskFunctions.get(name) as TaskFunction<Data, Response>
      )
      this.sendTaskFunctionNamesToMainWorker()
      return { status: true }
    } catch (error) {
      return { status: false, error: error as Error }
    }
  }

  /**
   * Handles the ready message sent by the main worker.
   *
   * @param message - The ready message.
   */
  protected abstract handleReadyMessage (message: MessageValue<Data>): void

  /**
   * Worker message listener.
   *
   * @param message - The received message.
   */
  protected messageListener (message: MessageValue<Data>): void {
    this.checkMessageWorkerId(message)
    if (message.statistics != null) {
      // Statistics message received
      this.statistics = message.statistics
    } else if (message.checkActive != null) {
      // Check active message received
      message.checkActive ? this.startCheckActive() : this.stopCheckActive()
    } else if (message.taskFunctionOperation != null) {
      // Task function operation message received
      this.handleTaskFunctionOperationMessage(message)
    } else if (message.taskId != null && message.data != null) {
      // Task message received
      this.run(message)
    } else if (message.taskOperation === 'abort' && message.taskId != null) {
      // Abort task operation message received
      this.emit('abortTask', { taskId: message.taskId })
    } else if (message.kill === true) {
      // Kill message received
      this.handleKillMessage(message)
    }
  }

  protected handleTaskFunctionOperationMessage (
    message: MessageValue<Data>
  ): void {
    const { taskFunctionOperation, taskFunctionName, taskFunction } = message
    let response!: TaskFunctionOperationResult
    switch (taskFunctionOperation) {
      case 'add':
        response = this.addTaskFunction(
          taskFunctionName as string,
          // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
          new Function(`return ${taskFunction as string}`)() as TaskFunction<
          Data,
          Response
          >
        )
        break
      case 'remove':
        response = this.removeTaskFunction(taskFunctionName as string)
        break
      case 'default':
        response = this.setDefaultTaskFunction(taskFunctionName as string)
        break
      default:
        response = { status: false, error: new Error('Unknown task operation') }
        break
    }
    this.sendToMainWorker({
      taskFunctionOperation,
      taskFunctionOperationStatus: response.status,
      taskFunctionName,
      ...(!response.status &&
        response?.error != null && {
        workerError: {
          name: taskFunctionName as string,
          message: this.handleError(response.error as Error | string)
        }
      })
    })
  }

  /**
   * Handles a kill message sent by the main worker.
   *
   * @param message - The kill message.
   */
  protected handleKillMessage (_message: MessageValue<Data>): void {
    this.stopCheckActive()
    if (isAsyncFunction(this.opts.killHandler)) {
      (this.opts.killHandler?.() as Promise<void>)
        .then(() => {
          this.sendToMainWorker({ kill: 'success' })
          return undefined
        })
        .catch(() => {
          this.sendToMainWorker({ kill: 'failure' })
        })
    } else {
      try {
        // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
        this.opts.killHandler?.() as void
        this.sendToMainWorker({ kill: 'success' })
      } catch {
        this.sendToMainWorker({ kill: 'failure' })
      }
    }
    this.removeAllListeners()
  }

  /**
   * Check if the message worker id is set and matches the worker id.
   *
   * @param message - The message to check.
   * @throws {@link https://nodejs.org/api/errors.html#class-error} If the message worker id is not set or does not match the worker id.
   */
  private checkMessageWorkerId (message: MessageValue<Data>): void {
    if (message.workerId == null) {
      throw new Error('Message worker id is not set')
    } else if (message.workerId !== this.id) {
      throw new Error(
        `Message worker id ${message.workerId} does not match the worker id ${this.id}`
      )
    }
  }

  /**
   * Starts the worker check active interval.
   */
  private startCheckActive (): void {
    this.lastTaskTimestamp = performance.now()
    this.activeInterval = setInterval(
      this.checkActive.bind(this),
      (this.opts.maxInactiveTime ?? DEFAULT_MAX_INACTIVE_TIME) / 2
    )
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
      this.sendToMainWorker({ kill: this.opts.killBehavior })
    }
  }

  /**
   * Returns the main worker.
   *
   * @returns Reference to the main worker.
   * @throws {@link https://nodejs.org/api/errors.html#class-error} If the main worker is not set.
   */
  protected getMainWorker (): MainWorker {
    if (this.mainWorker == null) {
      throw new Error('Main worker not set')
    }
    return this.mainWorker
  }

  /**
   * Sends a message to main worker.
   *
   * @param message - The response message.
   */
  protected abstract sendToMainWorker (
    message: MessageValue<Response, Data>
  ): void

  /**
   * Sends task function names to the main worker.
   */
  protected sendTaskFunctionNamesToMainWorker (): void {
    this.sendToMainWorker({
      taskFunctionNames: this.listTaskFunctionNames()
    })
  }

  /**
   * Handles an error and convert it to a string so it can be sent back to the main worker.
   *
   * @param error - The error raised by the worker.
   * @returns The error message.
   */
  protected handleError (error: Error | string): string {
    return error instanceof Error ? error.message : error
  }

  private getAbortableTaskFunction (
    name: string,
    taskId: string
  ): TaskAsyncFunction<Data, Response> {
    return async (data?: Data): Promise<Response> =>
      await new Promise<Response>((resolve, reject) => {
        this.taskAbortFunctions.set(taskId, () => {
          reject(new Error(`Task ${name} id ${taskId} aborted`))
        })
        const taskFunction = this.taskFunctions.get(name)
        if (isAsyncFunction(taskFunction)) {
          (taskFunction as TaskAsyncFunction<Data, Response>)?.(data)
            .then(resolve)
            .catch(reject)
        } else {
          resolve((taskFunction as TaskSyncFunction<Data, Response>)?.(data))
        }
      })
  }

  /**
   * Runs the given task.
   *
   * @param task - The task to execute.
   */
  protected readonly run = (task: Task<Data>): void => {
    const { name, data, abortable, taskId } = task
    const taskFunctionName = name ?? DEFAULT_TASK_NAME
    if (!this.taskFunctions.has(taskFunctionName)) {
      this.sendToMainWorker({
        workerError: {
          name: name as string,
          message: `Task function '${name as string}' not found`,
          data
        },
        taskId
      })
      return
    }
    let fn: TaskFunction<Data, Response>
    if (abortable === true) {
      fn = this.getAbortableTaskFunction(taskFunctionName, taskId as string)
    } else {
      fn = this.taskFunctions.get(taskFunctionName) as TaskFunction<
      Data,
      Response
      >
    }
    if (isAsyncFunction(fn)) {
      this.runAsync(fn as TaskAsyncFunction<Data, Response>, task)
    } else {
      this.runSync(fn as TaskSyncFunction<Data, Response>, task)
    }
  }

  /**
   * Runs the given task function synchronously.
   *
   * @param fn - Task function that will be executed.
   * @param task - Input data for the task function.
   */
  protected readonly runSync = (
    fn: TaskSyncFunction<Data, Response>,
    task: Task<Data>
  ): void => {
    const { name, data, abortable, taskId } = task
    try {
      let taskPerformance = this.beginTaskPerformance(name)
      const res = fn(data)
      taskPerformance = this.endTaskPerformance(taskPerformance)
      this.sendToMainWorker({
        data: res,
        taskPerformance,
        taskId
      })
    } catch (error) {
      this.sendToMainWorker({
        workerError: {
          name: name as string,
          message: this.handleError(error as Error | string),
          data
        },
        taskId
      })
    } finally {
      this.updateLastTaskTimestamp()
      if (abortable === true) {
        this.taskAbortFunctions.delete(taskId as string)
      }
    }
  }

  /**
   * Runs the given task function asynchronously.
   *
   * @param fn - Task function that will be executed.
   * @param task - Input data for the task function.
   */
  protected readonly runAsync = (
    fn: TaskAsyncFunction<Data, Response>,
    task: Task<Data>
  ): void => {
    const { name, data, abortable, taskId } = task
    let taskPerformance = this.beginTaskPerformance(name)
    fn(data)
      .then(res => {
        taskPerformance = this.endTaskPerformance(taskPerformance)
        this.sendToMainWorker({
          data: res,
          taskPerformance,
          taskId
        })
        return undefined
      })
      .catch(error => {
        this.sendToMainWorker({
          workerError: {
            name: name as string,
            message: this.handleError(error as Error | string),
            data
          },
          taskId
        })
      })
      .finally(() => {
        this.updateLastTaskTimestamp()
        if (abortable === true) {
          this.taskAbortFunctions.delete(taskId as string)
        }
      })
      .catch(EMPTY_FUNCTION)
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
    if (this.activeInterval != null) {
      this.lastTaskTimestamp = performance.now()
    }
  }
}
