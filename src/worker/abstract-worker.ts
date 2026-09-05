import type { Worker } from 'node:cluster'
import type { MessagePort } from 'node:worker_threads'

import { performance } from 'node:perf_hooks'

import type {
  MessageValue,
  Task,
  TaskFunctionProperties,
  TaskPerformance,
  TaskUUID,
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

import {
  DEFAULT_TASK_NAME,
  EMPTY_FUNCTION,
  isAsyncFunction,
  isPlainObject,
} from '../utils.js'
import { AbortError } from './abort-error.js'
import { TaskFunctionLayers } from './task-function-layers.js'
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
 * @template MainWorker - Type of main worker.
 * @template Data - Type of data this worker receives from pool's execution. This can only be structured-cloneable data.
 * @template Response - Type of response the worker sends back to the main worker. This can only be structured-cloneable data.
 */
export abstract class AbstractWorker<
  MainWorker extends MessagePort | Worker,
  Data = unknown,
  Response = unknown
> {
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
  protected taskAbortFunctions: Map<TaskUUID, () => void>

  protected get taskFunctions (): Map<
    string,
    TaskFunctionObject<Data, Response>
  > {
    return this.taskFunctionLayers
  }

  /**
   * Task function object(s) processed by the worker when the pool's `execute` method is invoked.
   */
  private readonly taskFunctionLayers: TaskFunctionLayers<Data, Response>

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
    if (this.isMain == null) {
      throw new Error('isMain parameter is mandatory')
    }
    this.taskFunctionLayers = this.checkTaskFunctions(taskFunctions)
    this.taskAbortFunctions = new Map<TaskUUID, () => void>()
    this.checkWorkerOptions(this.opts)
    if (!this.isMain) {
      this.getMainWorker().once('message', this.handleReadyMessage.bind(this))
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
      this.taskFunctionLayers.addOverlay(name, fn)
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
    return { status: this.taskFunctionLayers.has(name) }
  }

  /**
   * Lists the properties of the worker's task functions.
   * @returns The properties of the worker's task functions.
   */
  public listTaskFunctionsProperties (): TaskFunctionProperties[] {
    return this.taskFunctionLayers.listEffectiveProperties()
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
      const deleteStatus = this.taskFunctionLayers.removePermanently(name)
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
      if (!this.taskFunctionLayers.setDefault(name)) {
        throw new Error(
          'Cannot set the default task function to a non-existing task function'
        )
      }
      this.sendTaskFunctionsPropertiesToMainWorker()
      return { status: true }
    } catch (error) {
      return { error: error as Error, status: false }
    }
  }

  /**
   * Returns the main worker.
   * @returns Reference to the main worker.
   * @throws {Error} If the main worker is not set.
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
    try {
      const result = this.opts.killHandler?.()
      if (result instanceof Promise) {
        result
          .then(() => {
            this.sendToMainWorker({ kill: 'success' })
            return undefined
          })
          .catch(() => {
            this.sendToMainWorker({ kill: 'failure' })
          })
      } else {
        this.sendToMainWorker({ kill: 'success' })
      }
    } catch {
      this.sendToMainWorker({ kill: 'failure' })
    }
  }

  /**
   * Handles the ready message sent by the main worker.
   * @param message - The ready message.
   */
  protected abstract handleReadyMessage (message: MessageValue<Data>): void

  protected handleTaskFunctionOperationMessage (
    message: MessageValue<Data>
  ): void {
    const {
      taskFunction,
      taskFunctionOperation,
      taskFunctionOperationId,
      taskFunctionProperties,
    } = message
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
            `return (${taskFunction})`
          )() as TaskFunction<Data, Response>,
          ...(taskFunctionProperties.priority != null && {
            priority: taskFunctionProperties.priority,
          }),
          ...(taskFunctionProperties.strategy != null && {
            strategy: taskFunctionProperties.strategy,
          }),
          ...(taskFunctionProperties.workerNodeKeys != null && {
            workerNodeKeys: taskFunctionProperties.workerNodeKeys,
          }),
        })
        break
      case 'default':
        response = this.setDefaultTaskFunction(taskFunctionProperties.name)
        break
      case 'remove':
        response = {
          status: this.taskFunctionLayers.removeOverlay(
            taskFunctionProperties.name
          ),
        }
        this.sendTaskFunctionsPropertiesToMainWorker()
        break
      default:
        response = {
          error: new Error(
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            `Unknown task function operation: ${taskFunctionOperation!}`
          ),
          status: false,
        }
        break
    }
    const { error, status } = response
    this.sendToMainWorker({
      taskFunctionOperation,
      ...(taskFunctionOperationId != null && { taskFunctionOperationId }),
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

  protected listStaticTaskFunctionsProperties (): TaskFunctionProperties[] {
    return this.taskFunctionLayers.listStaticProperties()
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
      if (this.taskAbortFunctions.has(taskId)) {
        this.taskAbortFunctions.get(taskId)?.()
      }
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
    const taskFunctionObject = this.taskFunctionLayers.get(taskFunctionName)
    if (taskFunctionObject == null) {
      this.sendToMainWorker({
        taskId,
        workerError: {
          data,
          name,
          ...this.handleError(
            new Error(`Task function '${taskFunctionName}' not found`)
          ),
        },
      })
      return
    }
    let fn: TaskFunction<Data, Response>
    if (abortable === true && taskId != null) {
      fn = this.getAbortableTaskFunction(
        taskFunctionName,
        taskId,
        taskFunctionObject.taskFunction
      )
    } else {
      fn = taskFunctionObject.taskFunction
    }
    let settlesAsynchronously = false
    try {
      let taskPerformance = this.beginTaskPerformance(name)
      const result = fn(data)
      if (this.isThenable(result)) {
        settlesAsynchronously = true
        this.settleTaskPromise(result, task, taskPerformance)
        return
      }
      taskPerformance = this.endTaskPerformance(taskPerformance)
      this.sendToMainWorker({
        data: result,
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
      if (!settlesAsynchronously) {
        this.finalizeTask(abortable, taskId)
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
   * @throws {Error} If the message worker id is not set or does not match the worker id.
   */
  private checkMessageWorkerId (message: MessageValue<Data>): void {
    if (message.workerId == null) {
      throw new Error(
        `Message worker id is not set: ${JSON.stringify(message)}`
      )
    }
    if (message.workerId !== this.id) {
      throw new Error(
        `Message worker id ${message.workerId.toString()} does not match the worker id ${this.id.toString()}: ${JSON.stringify(message)}`
      )
    }
  }

  /**
   * Checks if the `taskFunctions` parameter is passed to the constructor and valid.
   * @param taskFunctions - The task function(s) parameter that should be checked.
   * @returns The worker task function layers.
   */
  private checkTaskFunctions (
    taskFunctions:
      | TaskFunction<Data, Response>
      | TaskFunctions<Data, Response>
      | undefined
  ): TaskFunctionLayers<Data, Response> {
    if (taskFunctions == null) {
      throw new Error('taskFunctions parameter is mandatory')
    }
    const staticTaskFunctions = new Map<
      string,
      TaskFunctionObject<Data, Response>
    >()
    let defaultTaskFunctionName: string | undefined
    if (typeof taskFunctions === 'function') {
      const fnObj = { taskFunction: taskFunctions.bind(this) }
      defaultTaskFunctionName =
        typeof taskFunctions.name === 'string' &&
        taskFunctions.name.trim().length > 0
          ? taskFunctions.name
          : 'fn1'
      staticTaskFunctions.set(defaultTaskFunctionName, fnObj)
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
          defaultTaskFunctionName = name
          firstEntry = false
        }
        staticTaskFunctions.set(name, fnObj)
      }
      if (firstEntry) {
        throw new Error('taskFunctions parameter object is empty')
      }
    } else {
      throw new TypeError(
        'taskFunctions parameter is not a function or a plain object'
      )
    }
    if (defaultTaskFunctionName == null) {
      throw new Error('Task function default name is not defined')
    }
    return new TaskFunctionLayers(staticTaskFunctions, defaultTaskFunctionName)
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

  private finalizeTask (
    abortable: boolean | undefined,
    taskId: TaskUUID | undefined
  ): void {
    this.updateLastTaskTimestamp()
    if (abortable === true && taskId != null) {
      this.taskAbortFunctions.delete(taskId)
    }
  }

  /**
   * Gets abortable task function.
   * An abortable promise is built to permit the task to be aborted.
   * @param name - The name of the task.
   * @param taskId - The task id.
   * @param taskFunction - The task function to run.
   * @returns The abortable task function.
   */
  private getAbortableTaskFunction (
    name: string,
    taskId: TaskUUID,
    taskFunction: TaskFunction<Data, Response>
  ): TaskAsyncFunction<Data, Response> {
    return async (data?: Data): Promise<Response> =>
      await new Promise<Response>(
        (resolve, reject: (reason?: unknown) => void) => {
          this.taskAbortFunctions.set(taskId, () => {
            reject(new AbortError(`Task '${name}' id '${taskId}' aborted`))
          })
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

  private isThenable (value: unknown): value is PromiseLike<Response> {
    return (
      ((typeof value === 'object' && value !== null) ||
        typeof value === 'function') &&
      'then' in value &&
      typeof value.then === 'function'
    )
  }

  /**
   * Settles the given task function promise.
   * @param result - Task function promise or thenable.
   * @param task - The task being executed.
   * @param taskPerformance - Task performance measurement started before invocation.
   */
  private readonly settleTaskPromise = (
    result: PromiseLike<Response>,
    task: Task<Data>,
    taskPerformance: TaskPerformance
  ): void => {
    const { abortable, data, name, taskId } = task
    Promise.resolve(result)
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
        this.finalizeTask(abortable, taskId)
      })
      .catch(EMPTY_FUNCTION)
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
    this.activeInterval.unref()
  }

  /**
   * Stops the worker check active interval.
   */
  private stopCheckActive (): void {
    if (this.activeInterval != null) {
      clearInterval(this.activeInterval)
      this.activeInterval = undefined
    }
  }

  private updateLastTaskTimestamp (): void {
    if (this.activeInterval != null) {
      this.lastTaskTimestamp = performance.now()
    }
  }
}
