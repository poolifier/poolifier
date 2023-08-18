import { MessageChannel } from 'node:worker_threads'
import { CircularArray } from '../circular-array'
import { Queue } from '../queue'
import type { Task } from '../utility-types'
import { DEFAULT_TASK_NAME } from '../utils'
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
  private readonly taskFunctionsUsage: Map<string, WorkerUsage>
  private readonly tasksQueue: Queue<Task<Data>>
  private readonly tasksQueueBackPressureSize: number

  /**
   * Constructs a new worker node.
   *
   * @param worker - The worker.
   * @param workerType - The worker type.
   * @param poolMaxSize - The pool maximum size.
   */
  constructor (worker: Worker, workerType: WorkerType, poolMaxSize: number) {
    this.worker = worker
    this.info = this.initWorkerInfo(worker, workerType)
    if (workerType === WorkerTypes.thread) {
      this.messageChannel = new MessageChannel()
    }
    this.usage = this.initWorkerUsage()
    this.taskFunctionsUsage = new Map<string, WorkerUsage>()
    this.tasksQueue = new Queue<Task<Data>>()
    this.tasksQueueBackPressureSize = Math.pow(poolMaxSize, 2)
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
    return this.tasksQueue.enqueue(task)
  }

  /** @inheritdoc */
  public dequeueTask (): Task<Data> | undefined {
    return this.tasksQueue.dequeue()
  }

  /** @inheritdoc */
  public clearTasksQueue (): void {
    this.tasksQueue.clear()
  }

  /** @inheritdoc */
  public hasBackPressure (): boolean {
    return this.tasksQueueSize() >= this.tasksQueueBackPressureSize
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
    const getTaskQueueSize = (): number => {
      let taskQueueSize = 0
      for (const task of this.tasksQueue) {
        if (task.name === name) {
          ++taskQueueSize
        }
      }
      return taskQueueSize
    }
    return {
      tasks: {
        executed: 0,
        executing: 0,
        get queued (): number {
          return getTaskQueueSize()
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
}
