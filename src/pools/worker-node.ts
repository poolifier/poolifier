import { EventEmitter } from 'node:events'
import { MessageChannel } from 'node:worker_threads'

import { CircularBuffer } from '../circular-buffer.js'
import { PriorityQueue } from '../queues/priority-queue.js'
import type { Task } from '../utility-types.js'
import { DEFAULT_TASK_NAME } from '../utils.js'
import {
  checkWorkerNodeArguments,
  createWorker,
  getWorkerId,
  getWorkerType,
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
  public readonly worker: Worker
  /** @inheritdoc */
  public readonly info: WorkerInfo
  /** @inheritdoc */
  public usage: WorkerUsage
  /** @inheritdoc */
  public strategyData?: StrategyData
  /** @inheritdoc */
  public messageChannel?: MessageChannel
  /** @inheritdoc */
  public tasksQueueBackPressureSize: number
  private readonly tasksQueue: PriorityQueue<Task<Data>>
  private setBackPressureFlag: boolean
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
    this.info = this.initWorkerInfo(this.worker)
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
    this.setBackPressureFlag = false
    this.taskFunctionsUsage = new Map<string, WorkerUsage>()
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
  public enqueueTask (task: Task<Data>): number {
    const tasksQueueSize = this.tasksQueue.enqueue(task, task.priority)
    if (
      !this.setBackPressureFlag &&
      this.hasBackPressure() &&
      !this.info.backPressure
    ) {
      this.setBackPressureFlag = true
      this.info.backPressure = true
      this.emit('backPressure', { workerId: this.info.id })
      this.setBackPressureFlag = false
    }
    return tasksQueueSize
  }

  /** @inheritdoc */
  public dequeueTask (bucket?: number): Task<Data> | undefined {
    const task = this.tasksQueue.dequeue(bucket)
    if (
      !this.setBackPressureFlag &&
      !this.hasBackPressure() &&
      this.info.backPressure
    ) {
      this.setBackPressureFlag = true
      this.info.backPressure = false
      this.setBackPressureFlag = false
    }
    return task
  }

  /** @inheritdoc */
  public dequeueLastPrioritizedTask (): Task<Data> | undefined {
    // Start from the last empty or partially filled bucket
    return this.dequeueTask(this.tasksQueue.buckets + 1)
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
  public async terminate (): Promise<void> {
    const waitWorkerExit = new Promise<void>(resolve => {
      this.registerOnceWorkerEventHandler('exit', () => {
        resolve()
      })
    })
    this.closeMessageChannel()
    this.removeAllListeners()
    switch (this.info.type) {
      case WorkerTypes.thread:
        this.worker.unref?.()
        await this.worker.terminate?.()
        break
      case WorkerTypes.cluster:
        this.registerOnceWorkerEventHandler('disconnect', () => {
          this.worker.kill?.()
        })
        this.worker.disconnect?.()
        break
    }
    await waitWorkerExit
  }

  /** @inheritdoc */
  public registerWorkerEventHandler (
    event: string,
    handler: EventHandler<Worker>
  ): void {
    this.worker.on(event, handler)
  }

  /** @inheritdoc */
  public registerOnceWorkerEventHandler (
    event: string,
    handler: EventHandler<Worker>
  ): void {
    this.worker.once(event, handler)
  }

  /** @inheritdoc */
  public getTaskFunctionWorkerUsage (name: string): WorkerUsage | undefined {
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
  public deleteTaskFunctionWorkerUsage (name: string): boolean {
    return this.taskFunctionsUsage.delete(name)
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

  private initWorkerInfo (worker: Worker): WorkerInfo {
    return {
      id: getWorkerId(worker),
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      type: getWorkerType(worker)!,
      dynamic: false,
      ready: false,
      stealing: false,
      stolen: false,
      continuousStealing: false,
      backPressureStealing: false,
      backPressure: false,
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
      tasks: {
        executed: 0,
        executing: 0,
        get queued (): number {
          return getTasksQueueSize()
        },
        get maxQueued (): number {
          return getTasksQueueMaxSize()
        },
        sequentiallyStolen: 0,
        stolen: 0,
        failed: 0,
      },
      runTime: {
        history: new CircularBuffer(MeasurementHistorySize),
      },
      waitTime: {
        history: new CircularBuffer(MeasurementHistorySize),
      },
      elu: {
        idle: {
          history: new CircularBuffer(MeasurementHistorySize),
        },
        active: {
          history: new CircularBuffer(MeasurementHistorySize),
        },
      },
    }
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
      tasks: {
        executed: 0,
        executing: 0,
        get queued (): number {
          return getTaskFunctionQueueSize()
        },
        sequentiallyStolen: 0,
        stolen: 0,
        failed: 0,
      },
      runTime: {
        history: new CircularBuffer(MeasurementHistorySize),
      },
      waitTime: {
        history: new CircularBuffer(MeasurementHistorySize),
      },
      elu: {
        idle: {
          history: new CircularBuffer(MeasurementHistorySize),
        },
        active: {
          history: new CircularBuffer(MeasurementHistorySize),
        },
      },
    }
  }
}
