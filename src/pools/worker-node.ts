import { CircularArray } from '../circular-array'
import { Queue } from '../queue'
import {
  type IWorker,
  type IWorkerNode,
  type Task,
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
   * Worker node tasks queue maximum size.
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
  public getTasksWorkerUsage (name: string): WorkerUsage | undefined {
    if (!this.tasksUsage.has(name)) {
      this.tasksUsage.set(name, this.initWorkerUsage())
    }
    return this.tasksUsage.get(name)
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
