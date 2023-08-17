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
  public readonly worker: Worker
  public readonly info: WorkerInfo
  public usage: WorkerUsage
  private readonly tasksUsage: Map<string, WorkerUsage>
  private readonly tasksQueue: Queue<Task<Data>>

  /**
   * Constructs a new worker node.
   *
   * @param worker - The worker.
   * @param workerType - The worker type.
   */
  constructor (worker: Worker, workerType: WorkerType) {
    this.worker = worker
    this.info = this.initWorkerInfo(worker, workerType)
    this.usage = this.initWorkerUsage()
    this.tasksUsage = new Map<string, WorkerUsage>()
    this.tasksQueue = new Queue<Task<Data>>()
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
  public resetUsage (): void {
    this.usage = this.initWorkerUsage()
    this.tasksUsage.clear()
  }

  /** @inheritdoc */
  public closeChannel (): void {
    if (this.info.messageChannel != null) {
      this.info.messageChannel?.port1.unref()
      this.info.messageChannel?.port2.unref()
      this.info.messageChannel?.port1.close()
      this.info.messageChannel?.port2.close()
      delete this.info.messageChannel
    }
  }

  /** @inheritdoc */
  public getTaskWorkerUsage (name: string): WorkerUsage | undefined {
    if (!Array.isArray(this.info.taskFunctions)) {
      throw new Error(
        `Cannot get task worker usage for task function name '${name}' when task function names list is not yet defined`
      )
    }
    if (
      name === DEFAULT_TASK_NAME &&
      Array.isArray(this.info.taskFunctions) &&
      this.info.taskFunctions.length > 1
    ) {
      name = this.info.taskFunctions[1]
    }
    if (!this.tasksUsage.has(name)) {
      this.tasksUsage.set(name, this.initTaskWorkerUsage(name))
    }
    return this.tasksUsage.get(name)
  }

  private initWorkerInfo (worker: Worker, workerType: WorkerType): WorkerInfo {
    return {
      id: this.getWorkerId(worker, workerType),
      type: workerType,
      dynamic: false,
      ready: false,
      ...(workerType === WorkerTypes.thread && {
        messageChannel: new MessageChannel()
      })
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

  private initTaskWorkerUsage (name: string): WorkerUsage {
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
