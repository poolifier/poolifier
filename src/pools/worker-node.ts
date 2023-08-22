import { MessageChannel } from 'node:worker_threads'
import { CircularArray } from '../circular-array'
import type { Task } from '../utility-types'
import { DEFAULT_TASK_NAME } from '../utils'
import { Deque } from '../deque'
import {
  type IWorker,
  type IWorkerNode,
  type WorkerInfo,
  type WorkerType,
  WorkerTypes,
  type WorkerUsage
} from './worker'

/**
 * Worker node.
 *
 * @typeParam Worker - Type of worker.
 * @typeParam Data - Type of data sent to the worker. This can only be structured-cloneable data.
 */
export class WorkerNode<Worker extends IWorker, Data = unknown>
implements IWorkerNode<Worker, Data> {
  /** @inheritdoc */
  public readonly worker: Worker
  /** @inheritdoc */
  public readonly info: WorkerInfo
  /** @inheritdoc */
  public messageChannel?: MessageChannel
  /** @inheritdoc */
  public usage: WorkerUsage
  /** @inheritdoc */
  public tasksQueueBackPressureSize: number
  /** @inheritdoc */
  public onBackPressure?: (workerId: number) => void
  private readonly taskFunctionsUsage: Map<string, WorkerUsage>
  private readonly tasksQueue: Deque<Task<Data>>

  /**
   * Constructs a new worker node.
   *
   * @param worker - The worker.
   * @param workerType - The worker type.
   * @param tasksQueueBackPressureSize - The tasks queue back pressure size.
   */
  constructor (
    worker: Worker,
    workerType: WorkerType,
    tasksQueueBackPressureSize: number
  ) {
    if (worker == null) {
      throw new TypeError('Cannot construct a worker node without a worker')
    }
    if (workerType == null) {
      throw new TypeError(
        'Cannot construct a worker node without a worker type'
      )
    }
    if (tasksQueueBackPressureSize == null) {
      throw new TypeError(
        'Cannot construct a worker node without a tasks queue back pressure size'
      )
    }
    if (!Number.isSafeInteger(tasksQueueBackPressureSize)) {
      throw new TypeError(
        'Cannot construct a worker node with a tasks queue back pressure size that is not an integer'
      )
    }
    this.worker = worker
    this.info = this.initWorkerInfo(worker, workerType)
    if (workerType === WorkerTypes.thread) {
      this.messageChannel = new MessageChannel()
    }
    this.usage = this.initWorkerUsage()
    this.taskFunctionsUsage = new Map<string, WorkerUsage>()
    this.tasksQueue = new Deque<Task<Data>>()
    this.tasksQueueBackPressureSize = tasksQueueBackPressureSize
  }

  /** @inheritdoc */
  public tasksQueueSize (): number {
    return this.tasksQueue.size
  }

  /**
   * Tasks queue maximum size.
   *
   * @returns The tasks queue maximum size.
   */
  private tasksQueueMaxSize (): number {
    return this.tasksQueue.maxSize
  }

  /** @inheritdoc */
  public enqueueTask (task: Task<Data>): number {
    const tasksQueueSize = this.tasksQueue.push(task)
    if (this.onBackPressure != null && this.hasBackPressure()) {
      this.once(this.onBackPressure)(this.info.id as number)
    }
    return tasksQueueSize
  }

  /** @inheritdoc */
  public unshiftTask (task: Task<Data>): number {
    const tasksQueueSize = this.tasksQueue.unshift(task)
    if (this.onBackPressure != null && this.hasBackPressure()) {
      this.once(this.onBackPressure)(this.info.id as number)
    }
    return tasksQueueSize
  }

  /** @inheritdoc */
  public dequeueTask (): Task<Data> | undefined {
    return this.tasksQueue.shift()
  }

  /** @inheritdoc */
  public popTask (): Task<Data> | undefined {
    return this.tasksQueue.pop()
  }

  /** @inheritdoc */
  public clearTasksQueue (): void {
    this.tasksQueue.clear()
  }

  /** @inheritdoc */
  public hasBackPressure (): boolean {
    return this.tasksQueue.size >= this.tasksQueueBackPressureSize
  }

  /** @inheritdoc */
  public resetUsage (): void {
    this.usage = this.initWorkerUsage()
    this.taskFunctionsUsage.clear()
  }

  /** @inheritdoc */
  public closeChannel (): void {
    if (this.messageChannel != null) {
      this.messageChannel?.port1.unref()
      this.messageChannel?.port2.unref()
      this.messageChannel?.port1.close()
      this.messageChannel?.port2.close()
      delete this.messageChannel
    }
  }

  /** @inheritdoc */
  public getTaskFunctionWorkerUsage (name: string): WorkerUsage | undefined {
    if (!Array.isArray(this.info.taskFunctions)) {
      throw new Error(
        `Cannot get task function worker usage for task function name '${name}' when task function names list is not yet defined`
      )
    }
    if (
      Array.isArray(this.info.taskFunctions) &&
      this.info.taskFunctions.length < 3
    ) {
      throw new Error(
        `Cannot get task function worker usage for task function name '${name}' when task function names list has less than 3 elements`
      )
    }
    if (name === DEFAULT_TASK_NAME) {
      name = this.info.taskFunctions[1]
    }
    if (!this.taskFunctionsUsage.has(name)) {
      this.taskFunctionsUsage.set(name, this.initTaskFunctionWorkerUsage(name))
    }
    return this.taskFunctionsUsage.get(name)
  }

  private initWorkerInfo (worker: Worker, workerType: WorkerType): WorkerInfo {
    return {
      id: this.getWorkerId(worker, workerType),
      type: workerType,
      dynamic: false,
      ready: false
    }
  }

  private initWorkerUsage (): WorkerUsage {
    const getTasksQueueSize = (): number => {
      return this.tasksQueueSize()
    }
    const getTasksQueueMaxSize = (): number => {
      return this.tasksQueueMaxSize()
    }
    return {
      tasks: {
        executed: 0,
        executing: 0,
        get queued (): number {
          return getTasksQueueSize()
        },
        get maxQueued (): number {
          return getTasksQueueMaxSize()
        },
        failed: 0
      },
      runTime: {
        history: new CircularArray()
      },
      waitTime: {
        history: new CircularArray()
      },
      elu: {
        idle: {
          history: new CircularArray()
        },
        active: {
          history: new CircularArray()
        }
      }
    }
  }

  private initTaskFunctionWorkerUsage (name: string): WorkerUsage {
    const getTaskFunctionQueueSize = (): number => {
      let taskFunctionQueueSize = 0
      for (const task of this.tasksQueue) {
        if (
          (task.name === DEFAULT_TASK_NAME &&
            name === (this.info.taskFunctions as string[])[1]) ||
          (task.name !== DEFAULT_TASK_NAME && name === task.name)
        ) {
          ++taskFunctionQueueSize
        }
      }
      return taskFunctionQueueSize
    }
    return {
      tasks: {
        executed: 0,
        executing: 0,
        get queued (): number {
          return getTaskFunctionQueueSize()
        },
        failed: 0
      },
      runTime: {
        history: new CircularArray()
      },
      waitTime: {
        history: new CircularArray()
      },
      elu: {
        idle: {
          history: new CircularArray()
        },
        active: {
          history: new CircularArray()
        }
      }
    }
  }

  /**
   * Gets the worker id.
   *
   * @param worker - The worker.
   * @param workerType - The worker type.
   * @returns The worker id.
   */
  private getWorkerId (
    worker: Worker,
    workerType: WorkerType
  ): number | undefined {
    if (workerType === WorkerTypes.thread) {
      return worker.threadId
    } else if (workerType === WorkerTypes.cluster) {
      return worker.id
    }
  }

  /**
   * Executes a function once at a time.
   */

  private once (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fn: (...args: any[]) => void,
    context = this
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): (...args: any[]) => void {
    let called = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return function (...args: any[]): void {
      if (!called) {
        called = true
        fn.apply(context, args)
        called = false
      }
    }
  }
}
