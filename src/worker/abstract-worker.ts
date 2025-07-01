import type { Worker } from 'node:cluster'
import type { MessagePort } from 'node:worker_threads'

import { EventEmitter } from 'node:events'
import { performance } from 'node:perf_hooks'

import type {
  MessageValue,
  Task,
  TaskFunctionProperties,
  TaskPerformance,
  WorkerStatistics,
} from '../utility-types.js'
import type {
  TaskAsyncFunction,
  TaskFunction,
  TaskFunctionObject,
  TaskFunctionOperationResult,
  TaskFunctions,
  TaskSyncFunction,
} from './task-functions.js'
import type { AbortTaskEventDetail } from './worker-types.js'

import {
  buildTaskFunctionProperties,
  DEFAULT_TASK_NAME,
  EMPTY_FUNCTION,
  isAsyncFunction,
  isPlainObject,
} from '../utils.js'
import { AbortError } from './abort-error.js'
import {
  checkTaskFunctionName,
  checkValidTaskFunctionObjectEntry,
  checkValidWorkerOptions,
} from './utils.js'
import { KillBehaviors, type WorkerOptions } from './worker-options.js'

const DEFAULT_MAX_INACTIVE_TIME = 60000
const DEFAULT_WORKER_OPTIONS: Readonly<WorkerOptions> = Object.freeze({
  /**
   * The kill behavior option on this worker or its default value.
   */
  killBehavior: KillBehaviors.SOFT,
  /**
   * The function to call when the worker is killed.
   */
  killHandler: EMPTY_FUNCTION,
  /**
   * The maximum time to keep this worker active while idle.
   * The pool automatically checks and terminates this worker when the time expires.
   */
  maxInactiveTime: DEFAULT_MAX_INACTIVE_TIME,
})

/**
 * Base class that implements some shared logic for all poolifier workers.
 * @typeParam MainWorker - Type of main worker.
 * @typeParam Data - Type of data this worker receives from pool's execution. This can only be structured-cloneable data.
 * @typeParam Response - Type of response the worker sends back to the main worker. This can only be structured-cloneable data.
 */
export abstract class AbstractWorker<
  MainWorker extends MessagePort | Worker,
  Data = unknown,
  Response = unknown
> extends EventEmitter {
  /**
   * Handler id of the `activeInterval` worker activity check.
   */
  protected activeInterval?: NodeJS.Timeout
  /**
   * Worker id.
   */
  protected abstract readonly id: number
  /**
   * Timestamp of the last task processed by this worker.
   */
  protected lastTaskTimestamp!: number

  /**
   * Performance statistics computation requirements.
   */
  protected statistics?: WorkerStatistics

  /**
   * Task abort functions processed by the worker when task operation 'abort' is received.
   */
  protected taskAbortFunctions: Map<
    `${string}-${string}-${string}-${string}-${string}`,
    () => void
  >

  /**
   * Task function object(s) processed by the worker when the pool's `execute` method is invoked.
   */
  protected taskFunctions!: Map<string, TaskFunctionObject<Data, Response>>

  /**
   * Constructs a new poolifier worker.
   * @param isMain - Whether this is the main worker or not.
   * @param mainWorker - Reference to main worker.
   * @param taskFunctions - Task function(s) processed by the worker when the pool's `execute` method is invoked. The first function is the default function.
   * @param opts - Options for the worker.
   */
  public constructor (
    protected readonly isMain: boolean | undefined,
    private readonly mainWorker: MainWorker | null | undefined,
    taskFunctions: TaskFunction<Data, Response> | TaskFunctions<Data, Response>,
    protected opts: WorkerOptions = DEFAULT_WORKER_OPTIONS
  ) {
    super()
    if (this.isMain == null) {
      throw new Error('isMain parameter is mandatory')
    }
    this.checkTaskFunctions(taskFunctions)
    this.taskAbortFunctions = new Map<
      `${string}-${string}-${string}-${string}-${string}`,
      () => void
    >()
    this.on('abortTask', (eventDetail: AbortTaskEventDetail) => {
      const { taskId } = eventDetail
      if (this.taskAbortFunctions.has(taskId)) {
        this.taskAbortFunctions.get(taskId)?.()
      }
    })
    this.checkWorkerOptions(this.opts)
    if (!this.isMain) {
      // Should be once() but Node.js on windows has a bug that prevents it from working
      this.getMainWorker().on('message', this.handleReadyMessage.bind(this))
    }
  }

  /**
   * Adds a task function to the worker.
   * If a task function with the same name already exists, it is replaced.
   * @param name - The name of the task function to add.
   * @param fn - The task function to add.
   * @returns Whether the task function was added or not.
   */
  public addTaskFunction (
    name: string,
    fn: TaskFunction<Data, Response> | TaskFunctionObject<Data, Response>
  ): TaskFunctionOperationResult {
    try {
      checkTaskFunctionName(name)
      if (name === DEFAULT_TASK_NAME) {
        throw new Error(
          'Cannot add a task function with the default reserved name'
        )
      }
      if (typeof fn === 'function') {
        fn = { taskFunction: fn } satisfies TaskFunctionObject<Data, Response>
      }
      checkValidTaskFunctionObjectEntry<Data, Response>(name, fn)
      fn.taskFunction = fn.taskFunction.bind(this)
      if (
        this.taskFunctions.get(name) ===
        this.taskFunctions.get(DEFAULT_TASK_NAME)
      ) {
        this.taskFunctions.set(DEFAULT_TASK_NAME, fn)
      }
      this.taskFunctions.set(name, fn)
      this.sendTaskFunctionsPropertiesToMainWorker()
      return { status: true }
    } catch (error) {
      return { error: error as Error, status: false }
    }
  }

  /**
   * Checks if the worker has a task function with the given name.
   * @param name - The name of the task function to check.
   * @returns Whether the worker has a task function with the given name or not.
   */
  public hasTaskFunction (name: string): TaskFunctionOperationResult {
    try {
      checkTaskFunctionName(name)
    } catch (error) {
      return { error: error as Error, status: false }
    }
    return { status: this.taskFunctions.has(name) }
  }

  /**
   * Lists the properties of the worker's task functions.
   * @returns The properties of the worker's task functions.
   */
  public listTaskFunctionsProperties (): TaskFunctionProperties[] {
    let defaultTaskFunctionName = DEFAULT_TASK_NAME
    for (const [name, fnObj] of this.taskFunctions) {
      if (
        name !== DEFAULT_TASK_NAME &&
        fnObj === this.taskFunctions.get(DEFAULT_TASK_NAME)
      ) {
        defaultTaskFunctionName = name
        break
      }
    }
    const taskFunctionsProperties: TaskFunctionProperties[] = []
    for (const [name, fnObj] of this.taskFunctions) {
      if (name === DEFAULT_TASK_NAME || name === defaultTaskFunctionName) {
        continue
      }
      taskFunctionsProperties.push(buildTaskFunctionProperties(name, fnObj))
    }
    return [
      buildTaskFunctionProperties(
        DEFAULT_TASK_NAME,
        this.taskFunctions.get(DEFAULT_TASK_NAME)
      ),
      buildTaskFunctionProperties(
        defaultTaskFunctionName,
        this.taskFunctions.get(defaultTaskFunctionName)
      ),
      ...taskFunctionsProperties,
    ]
  }

  /**
   * Removes a task function from the worker.
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
      this.sendTaskFunctionsPropertiesToMainWorker()
      return { status: deleteStatus }
    } catch (error) {
      return { error: error as Error, status: false }
    }
  }

  /**
   * Sets the default task function to use in the worker.
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
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.taskFunctions.set(DEFAULT_TASK_NAME, this.taskFunctions.get(name)!)
      this.sendTaskFunctionsPropertiesToMainWorker()
      return { status: true }
    } catch (error) {
      return { error: error as Error, status: false }
    }
  }

  /**
   * Returns the main worker.
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
   * Handles a worker error.
   * @param error - The error raised by the worker.
   * @returns The worker error object.
   */
  protected abstract handleError (error: Error): {
    aborted: boolean
    error?: Error
    message: string
    stack?: string
  }

  /**
   * Handles a kill message sent by the main worker.
   * @param message - The kill message.
   */
  protected handleKillMessage (message: MessageValue<Data>): void {
    this.stopCheckActive()
    if (isAsyncFunction(this.opts.killHandler)) {
      ;(this.opts.killHandler as () => Promise<void>)()
        .then(() => {
          this.sendToMainWorker({ kill: 'success' })
          return undefined
        })
        .catch(() => {
          this.sendToMainWorker({ kill: 'failure' })
        })
    } else {
      try {
        ;(this.opts.killHandler as (() => void) | undefined)?.()
        this.sendToMainWorker({ kill: 'success' })
      } catch {
        this.sendToMainWorker({ kill: 'failure' })
      }
    }
    this.removeAllListeners()
  }

  /**
   * Handles the ready message sent by the main worker.
   * @param message - The ready message.
   */
  protected abstract handleReadyMessage (message: MessageValue<Data>): void

  protected handleTaskFunctionOperationMessage (
    message: MessageValue<Data>
  ): void {
    const { taskFunction, taskFunctionOperation, taskFunctionProperties } =
      message
    if (taskFunctionProperties == null) {
      throw new Error(
        'Cannot handle task function operation message without task function properties'
      )
    }
    let response: TaskFunctionOperationResult
    switch (taskFunctionOperation) {
      case 'add':
        if (typeof taskFunction !== 'string') {
          throw new Error(
            `Cannot handle task function operation ${taskFunctionOperation} message without task function`
          )
        }
        response = this.addTaskFunction(taskFunctionProperties.name, {
          // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func, @typescript-eslint/no-unsafe-call
          taskFunction: new Function(
            `return ${taskFunction}`
          )() as TaskFunction<Data, Response>,
          ...(taskFunctionProperties.priority != null && {
            priority: taskFunctionProperties.priority,
          }),
          ...(taskFunctionProperties.strategy != null && {
            strategy: taskFunctionProperties.strategy,
          }),
          ...(taskFunctionProperties.workerNodes != null && {
            workerNodes: taskFunctionProperties.workerNodes,
          }),
        })
        break
      case 'default':
        response = this.setDefaultTaskFunction(taskFunctionProperties.name)
        break
      case 'remove':
        response = this.removeTaskFunction(taskFunctionProperties.name)
        break
      default:
        response = {
          error: new Error('Unknown task operation'),
          status: false,
        }
        break
    }
    const { error, status } = response
    this.sendToMainWorker({
      taskFunctionOperation,
      taskFunctionOperationStatus: status,
      taskFunctionProperties,
      ...(!status &&
        error != null && {
        workerError: {
          name: taskFunctionProperties.name,
          ...this.handleError(error),
        },
      }),
    })
  }

  /**
   * Worker message listener.
   * @param message - The received message.
   */
  protected messageListener (message: MessageValue<Data>): void {
    this.checkMessageWorkerId(message)
    const {
      checkActive,
      data,
      kill,
      statistics,
      taskFunctionOperation,
      taskId,
      taskOperation,
    } = message
    if (statistics != null) {
      // Statistics message received
      this.statistics = statistics
    } else if (checkActive != null) {
      // Check active message received
      checkActive ? this.startCheckActive() : this.stopCheckActive()
    } else if (taskFunctionOperation != null) {
      // Task function operation message received
      this.handleTaskFunctionOperationMessage(message)
    } else if (taskId != null && data != null) {
      // Task message received
      this.run(message)
    } else if (taskOperation === 'abort' && taskId != null) {
      // Abort task operation message received
      this.emit('abortTask', { taskId })
    } else if (kill === true) {
      // Kill message received
      this.handleKillMessage(message)
    }
  }

  /**
   * Runs the given task.
   * @param task - The task to execute.
   */
  protected readonly run = (task: Task<Data>): void => {
    const { abortable, data, name, taskId } = task
    const taskFunctionName = name ?? DEFAULT_TASK_NAME
    if (!this.taskFunctions.has(taskFunctionName)) {
      this.sendToMainWorker({
        taskId,
        workerError: {
          data,
          name,
          ...this.handleError(
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            new Error(`Task function '${name!}' not found`)
          ),
        },
      })
      return
    }
    let fn: TaskFunction<Data, Response>
    if (abortable === true) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      fn = this.getAbortableTaskFunction(taskFunctionName, taskId!)
    } else {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      fn = this.taskFunctions.get(taskFunctionName)!.taskFunction
    }
    if (isAsyncFunction(fn)) {
      this.runAsync(fn as TaskAsyncFunction<Data, Response>, task)
    } else {
      this.runSync(fn as TaskSyncFunction<Data, Response>, task)
    }
  }

  /**
   * Runs the given task function asynchronously.
   * @param fn - Task function that will be executed.
   * @param task - Input data for the task function.
   */
  protected readonly runAsync = (
    fn: TaskAsyncFunction<Data, Response>,
    task: Task<Data>
  ): void => {
    const { abortable, data, name, taskId } = task
    let taskPerformance = this.beginTaskPerformance(name)
    fn(data)
      .then(res => {
        taskPerformance = this.endTaskPerformance(taskPerformance)
        this.sendToMainWorker({
          data: res,
          taskId,
          taskPerformance,
        })
        return undefined
      })
      .catch((error: unknown) => {
        this.sendToMainWorker({
          taskId,
          workerError: {
            data,
            name,
            ...this.handleError(error as Error),
          },
        })
      })
      .finally(() => {
        this.updateLastTaskTimestamp()
        if (abortable === true) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          this.taskAbortFunctions.delete(taskId!)
        }
      })
      .catch(EMPTY_FUNCTION)
  }

  /**
   * Runs the given task function synchronously.
   * @param fn - Task function that will be executed.
   * @param task - Input data for the task function.
   */
  protected readonly runSync = (
    fn: TaskSyncFunction<Data, Response>,
    task: Task<Data>
  ): void => {
    const { abortable, data, name, taskId } = task
    try {
      let taskPerformance = this.beginTaskPerformance(name)
      const res = fn(data)
      taskPerformance = this.endTaskPerformance(taskPerformance)
      this.sendToMainWorker({
        data: res,
        taskId,
        taskPerformance,
      })
    } catch (error) {
      this.sendToMainWorker({
        taskId,
        workerError: {
          data,
          name,
          ...this.handleError(error as Error),
        },
      })
    } finally {
      this.updateLastTaskTimestamp()
      if (abortable === true) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.taskAbortFunctions.delete(taskId!)
      }
    }
  }

  /**
   * Sends task functions properties to the main worker.
   */
  protected sendTaskFunctionsPropertiesToMainWorker (): void {
    this.sendToMainWorker({
      taskFunctionsProperties: this.listTaskFunctionsProperties(),
    })
  }

  /**
   * Sends a message to main worker.
   * @param message - The response message.
   */
  protected abstract sendToMainWorker (
    message: MessageValue<Response, Data>
  ): void

  private beginTaskPerformance (name?: string): TaskPerformance {
    if (this.statistics == null) {
      throw new Error('Performance statistics computation requirements not set')
    }
    return {
      name: name ?? DEFAULT_TASK_NAME,
      timestamp: performance.now(),
      ...(this.statistics.elu && {
        elu: performance.eventLoopUtilization(),
      }),
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
   * Check if the message worker id is set and matches the worker id.
   * @param message - The message to check.
   * @throws {@link https://nodejs.org/api/errors.html#class-error} If the message worker id is not set or does not match the worker id.
   */
  private checkMessageWorkerId (message: MessageValue<Data>): void {
    if (message.workerId == null) {
      throw new Error('Message worker id is not set')
    } else if (message.workerId !== this.id) {
      throw new Error(
        `Message worker id ${message.workerId.toString()} does not match the worker id ${this.id.toString()}`
      )
    }
  }

  /**
   * Checks if the `taskFunctions` parameter is passed to the constructor and valid.
   * @param taskFunctions - The task function(s) parameter that should be checked.
   */
  private checkTaskFunctions (
    taskFunctions:
      | TaskFunction<Data, Response>
      | TaskFunctions<Data, Response>
      | undefined
  ): void {
    if (taskFunctions == null) {
      throw new Error('taskFunctions parameter is mandatory')
    }
    this.taskFunctions = new Map<string, TaskFunctionObject<Data, Response>>()
    if (typeof taskFunctions === 'function') {
      const fnObj = { taskFunction: taskFunctions.bind(this) }
      this.taskFunctions.set(DEFAULT_TASK_NAME, fnObj)
      this.taskFunctions.set(
        typeof taskFunctions.name === 'string' &&
          taskFunctions.name.trim().length > 0
          ? taskFunctions.name
          : 'fn1',
        fnObj
      )
    } else if (isPlainObject(taskFunctions)) {
      let firstEntry = true
      for (let [name, fnObj] of Object.entries(taskFunctions)) {
        if (typeof fnObj === 'function') {
          fnObj = { taskFunction: fnObj } satisfies TaskFunctionObject<
            Data,
            Response
          >
        }
        checkValidTaskFunctionObjectEntry<Data, Response>(name, fnObj)
        fnObj.taskFunction = fnObj.taskFunction.bind(this)
        if (firstEntry) {
          this.taskFunctions.set(DEFAULT_TASK_NAME, fnObj)
          firstEntry = false
        }
        this.taskFunctions.set(name, fnObj)
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

  private checkWorkerOptions (opts: WorkerOptions): void {
    checkValidWorkerOptions(opts)
    this.opts = { ...DEFAULT_WORKER_OPTIONS, ...opts }
  }

  private endTaskPerformance (
    taskPerformance: TaskPerformance
  ): TaskPerformance {
    if (this.statistics == null) {
      throw new Error('Performance statistics computation requirements not set')
    }
    return {
      ...taskPerformance,
      ...(this.statistics.runTime && {
        runTime: performance.now() - taskPerformance.timestamp,
      }),
      ...(this.statistics.elu && {
        elu: performance.eventLoopUtilization(taskPerformance.elu),
      }),
    }
  }

  /**
   * Gets abortable task function.
   * An abortable promise is built to permit the task to be aborted.
   * @param name - The name of the task.
   * @param taskId - The task id.
   * @returns The abortable task function.
   */
  private getAbortableTaskFunction (
    name: string,
    taskId: `${string}-${string}-${string}-${string}-${string}`
  ): TaskAsyncFunction<Data, Response> {
    return async (data?: Data): Promise<Response> =>
      await new Promise<Response>(
        (resolve, reject: (reason?: unknown) => void) => {
          this.taskAbortFunctions.set(taskId, () => {
            reject(new AbortError(`Task '${name}' id '${taskId}' aborted`))
          })
          const taskFunction = this.taskFunctions.get(name)?.taskFunction
          if (isAsyncFunction(taskFunction)) {
            ;(taskFunction as TaskAsyncFunction<Data, Response>)(data)
              .then(resolve)
              .catch(reject)
          } else {
            resolve((taskFunction as TaskSyncFunction<Data, Response>)(data))
          }
        }
      )
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

  private updateLastTaskTimestamp (): void {
    if (this.activeInterval != null) {
      this.lastTaskTimestamp = performance.now()
    }
  }
}
