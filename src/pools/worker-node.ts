import { EventEmitter } from 'node:events'
import { MessageChannel } from 'node:worker_threads'

import type { Task } from '../utility-types.js'

import { CircularBuffer } from '../circular-buffer.js'
import { PriorityQueue } from '../queues/priority-queue.js'
import { DEFAULT_TASK_NAME } from '../utils.js'
import {
  checkWorkerNodeArguments,
  createWorker,
  initWorkerInfo,
} from './utils.js'
import {
  type EventHandler,
  type IWorker,
  type IWorkerNode,
  MeasurementHistorySize,
  type StrategyData,
  type WorkerInfo,
  type WorkerNodeOptions,
  type WorkerType,
  WorkerTypes,
  type WorkerUsage,
} from './worker.js'

/**
 * Worker node.
 * @typeParam Worker - Type of worker.
 * @typeParam Data - Type of data sent to the worker. This can only be structured-cloneable data.
 */
export class WorkerNode<Worker extends IWorker, Data = unknown>
  extends EventEmitter
  implements IWorkerNode<Worker, Data> {
  /** @inheritdoc */
  public readonly info: WorkerInfo
  /** @inheritdoc */
  public messageChannel?: MessageChannel
  /** @inheritdoc */
  public strategyData?: StrategyData
  /** @inheritdoc */
  public readonly tasksQueue: PriorityQueue<Task<Data>>
  /** @inheritdoc */
  public tasksQueueBackPressureSize: number
  /** @inheritdoc */
  public usage: WorkerUsage
  /** @inheritdoc */
  public readonly worker: Worker
  private readonly taskFunctionsUsage: Map<string, WorkerUsage>

  /**
   * Constructs a new worker node.
   * @param type - The worker type.
   * @param filePath - Path to the worker file.
   * @param opts - The worker node options.
   */
  constructor (type: WorkerType, filePath: string, opts: WorkerNodeOptions) {
    super()
    checkWorkerNodeArguments(type, filePath, opts)
    this.worker = createWorker<Worker>(type, filePath, {
      env: opts.env,
      workerOptions: opts.workerOptions,
    })
    this.info = initWorkerInfo(this.worker)
    this.usage = this.initWorkerUsage()
    if (this.info.type === WorkerTypes.thread) {
      this.messageChannel = new MessageChannel()
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.tasksQueueBackPressureSize = opts.tasksQueueBackPressureSize!
    this.tasksQueue = new PriorityQueue<Task<Data>>(
      opts.tasksQueueBucketSize,
      opts.tasksQueuePriority
    )
    this.taskFunctionsUsage = new Map<string, WorkerUsage>()
  }

  /** @inheritdoc */
  public clearTasksQueue (): void {
    this.tasksQueue.clear()
  }

  /** @inheritdoc */
  public deleteTask (task: Task<Data>): boolean {
    return this.tasksQueue.delete(task)
  }

  /** @inheritdoc */
  public deleteTaskFunctionWorkerUsage (name: string): boolean {
    return this.taskFunctionsUsage.delete(name)
  }

  /** @inheritdoc */
  public dequeueLastPrioritizedTask (): Task<Data> | undefined {
    // Start from the last empty or partially filled bucket
    return this.dequeueTask(this.tasksQueue.buckets + 1)
  }

  /** @inheritdoc */
  public dequeueTask (bucket?: number): Task<Data> | undefined {
    const task = this.tasksQueue.dequeue(bucket)
    if (!this.hasBackPressure() && this.info.backPressure) {
      this.info.backPressure = false
    }
    return task
  }

  /** @inheritdoc */
  public enqueueTask (task: Task<Data>): number {
    const tasksQueueSize = this.tasksQueue.enqueue(task, task.priority)
    if (this.hasBackPressure() && !this.info.backPressure) {
      this.info.backPressure = true
      this.emit('backPressure', { workerId: this.info.id })
    }
    return tasksQueueSize
  }

  /** @inheritdoc */
  public getTaskFunctionWorkerUsage (name: string): undefined | WorkerUsage {
    if (!Array.isArray(this.info.taskFunctionsProperties)) {
      throw new Error(
        `Cannot get task function worker usage for task function name '${name}' when task function properties list is not yet defined`
      )
    }
    if (
      Array.isArray(this.info.taskFunctionsProperties) &&
      this.info.taskFunctionsProperties.length < 3
    ) {
      throw new Error(
        `Cannot get task function worker usage for task function name '${name}' when task function properties list has less than 3 elements`
      )
    }
    if (name === DEFAULT_TASK_NAME) {
      name = this.info.taskFunctionsProperties[1].name
    }
    if (!this.taskFunctionsUsage.has(name)) {
      this.taskFunctionsUsage.set(name, this.initTaskFunctionWorkerUsage(name))
    }
    return this.taskFunctionsUsage.get(name)
  }

  /** @inheritdoc */
  public registerOnceWorkerEventHandler (
    event: string,
    handler: EventHandler<Worker>
  ): void {
    this.worker.once(event, handler)
  }

  /** @inheritdoc */
  public registerWorkerEventHandler (
    event: string,
    handler: EventHandler<Worker>
  ): void {
    this.worker.on(event, handler)
  }

  /** @inheritdoc */
  public setTasksQueuePriority (enablePriority: boolean): void {
    this.tasksQueue.enablePriority = enablePriority
  }

  /** @inheritdoc */
  public tasksQueueSize (): number {
    return this.tasksQueue.size
  }

  /** @inheritdoc */
  public async terminate (): Promise<void> {
    const waitWorkerExit = new Promise<void>(resolve => {
      this.registerOnceWorkerEventHandler('exit', () => {
        resolve()
      })
    })
    this.closeMessageChannel()
    this.removeAllListeners()
    switch (this.info.type) {
      case WorkerTypes.cluster:
        this.registerOnceWorkerEventHandler('disconnect', () => {
          this.worker.kill?.()
        })
        this.worker.disconnect?.()
        break
      case WorkerTypes.thread:
        this.worker.unref?.()
        await this.worker.terminate?.()
        break
    }
    await waitWorkerExit
    this.worker.removeAllListeners()
  }

  private closeMessageChannel (): void {
    if (this.messageChannel != null) {
      this.messageChannel.port1.unref()
      this.messageChannel.port2.unref()
      this.messageChannel.port1.close()
      this.messageChannel.port2.close()
      delete this.messageChannel
    }
  }

  /**
   * Whether the worker node is back pressured or not.
   * @returns `true` if the worker node is back pressured, `false` otherwise.
   */
  private hasBackPressure (): boolean {
    return this.tasksQueue.size >= this.tasksQueueBackPressureSize
  }

  private initTaskFunctionWorkerUsage (name: string): WorkerUsage {
    const getTaskFunctionQueueSize = (): number => {
      let taskFunctionQueueSize = 0
      for (const task of this.tasksQueue) {
        if (
          (task.name === DEFAULT_TASK_NAME &&
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            name === this.info.taskFunctionsProperties![1].name) ||
          (task.name !== DEFAULT_TASK_NAME && name === task.name)
        ) {
          ++taskFunctionQueueSize
        }
      }
      return taskFunctionQueueSize
    }
    return {
      elu: {
        active: {
          history: new CircularBuffer(MeasurementHistorySize),
        },
        idle: {
          history: new CircularBuffer(MeasurementHistorySize),
        },
      },
      runTime: {
        history: new CircularBuffer(MeasurementHistorySize),
      },
      tasks: {
        executed: 0,
        executing: 0,
        failed: 0,
        get queued (): number {
          return getTaskFunctionQueueSize()
        },
        sequentiallyStolen: 0,
        stolen: 0,
      },
      waitTime: {
        history: new CircularBuffer(MeasurementHistorySize),
      },
    }
  }

  private initWorkerUsage (): WorkerUsage {
    const getTasksQueueSize = (): number => {
      return this.tasksQueue.size
    }
    const getTasksQueueMaxSize = (): number => {
      return this.tasksQueue.maxSize
    }
    return {
      elu: {
        active: {
          history: new CircularBuffer(MeasurementHistorySize),
        },
        idle: {
          history: new CircularBuffer(MeasurementHistorySize),
        },
      },
      runTime: {
        history: new CircularBuffer(MeasurementHistorySize),
      },
      tasks: {
        executed: 0,
        executing: 0,
        failed: 0,
        get maxQueued (): number {
          return getTasksQueueMaxSize()
        },
        get queued (): number {
          return getTasksQueueSize()
        },
        sequentiallyStolen: 0,
        stolen: 0,
      },
      waitTime: {
        history: new CircularBuffer(MeasurementHistorySize),
      },
    }
  }
}
