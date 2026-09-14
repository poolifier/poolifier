import { EventEmitter } from 'node:events'
import { MessageChannel } from 'node:worker_threads'

import type { Task } from '../utility-types.js'

import { PriorityQueue } from '../queues/priority-queue.js'
import {
  checkWorkerNodeArguments,
  createWorker,
  initWorkerInfo,
} from './utils.js'
import { terminateWorker } from './worker-termination.js'
import {
  type WorkerTransportDrain,
  WorkerTransportDrainBarrier,
} from './worker-transport-drain.js'
import { WorkerUsageStore } from './worker-usage-store.js'
import {
  type EventHandler,
  type IWorker,
  type IWorkerNode,
  type StrategyData,
  type WorkerInfo,
  type WorkerNodeOptions,
  type WorkerType,
  WorkerTypes,
  type WorkerUsage,
} from './worker.js'

/**
 * Worker node.
 * @template Worker - Type of worker.
 * @template Data - Type of data sent to the worker. This can only be structured-cloneable data.
 */
export class WorkerNode<Worker extends IWorker, Data = unknown>
  extends EventEmitter
  implements IWorkerNode<Worker, Data>, WorkerTransportDrain {
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
  public readonly worker: Worker

  /** @inheritdoc */
  public get usage (): WorkerUsage {
    return this.usageStore.usage
  }

  private exited = false
  private terminationPromise?: Promise<void>
  private readonly transportDrainBarrier: WorkerTransportDrainBarrier
  private readonly usageStore: WorkerUsageStore<Data>

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
      clusterSettings: opts.clusterSettings,
      env: opts.env,
      workerOptions: opts.workerOptions,
    })
    this.worker.once('exit', () => {
      this.exited = true
    })
    this.info = initWorkerInfo(this.worker)
    if (this.info.type === WorkerTypes.thread) {
      this.messageChannel = new MessageChannel()
    }
    const messageChannel = this.messageChannel
    this.transportDrainBarrier =
      messageChannel != null
        ? new WorkerTransportDrainBarrier(messageChannel.port1, 'close')
        : new WorkerTransportDrainBarrier(this.worker, 'disconnect')
    this.tasksQueueBackPressureSize = opts.tasksQueueBackPressureSize
    this.tasksQueue = new PriorityQueue<Task<Data>>(
      opts.tasksQueueBucketSize,
      opts.tasksQueuePriority,
      opts.tasksQueueAgingFactor,
      opts.tasksQueueLoadExponent
    )
    this.usageStore = new WorkerUsageStore(this.info, this.tasksQueue)
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
    return this.usageStore.deleteTaskFunctionWorkerUsage(name)
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
    }
    return tasksQueueSize
  }

  /** @inheritdoc */
  public getTaskFunctionWorkerUsage (name: string): undefined | WorkerUsage {
    return this.usageStore.getTaskFunctionWorkerUsage(name)
  }

  /** @inheritdoc */
  public prependOnceWorkerEventHandler (
    event: string,
    handler: EventHandler<Worker>
  ): void {
    this.worker.prependOnceListener(event, handler)
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
    if (this.terminationPromise != null) {
      return this.terminationPromise
    }
    this.terminationPromise = this.doTerminate()
    return this.terminationPromise
  }

  /** @inheritdoc */
  public async waitForTransportDrain (): Promise<void> {
    await this.transportDrainBarrier.wait()
  }

  private closeMessageChannel (): void {
    const messageChannel = this.messageChannel
    if (messageChannel == null) return
    let cleanupFailure: undefined | { readonly error: unknown }
    for (const cleanup of [
      () => {
        messageChannel.port1.unref()
      },
      () => {
        messageChannel.port2.unref()
      },
      () => {
        messageChannel.port1.close()
      },
      () => {
        messageChannel.port2.close()
      },
    ]) {
      try {
        cleanup()
      } catch (error) {
        cleanupFailure ??= { error }
      }
    }
    delete this.messageChannel
    if (cleanupFailure != null) {
      throw cleanupFailure.error
    }
  }

  private async doTerminate (): Promise<void> {
    let terminationFailure: undefined | { readonly error: unknown }
    try {
      this.closeMessageChannel()
    } catch (error) {
      terminationFailure = { error }
    }
    try {
      await terminateWorker(this.worker, this.info.type, this.exited)
    } catch (error) {
      terminationFailure ??= { error }
    }
    try {
      this.closeMessageChannel()
    } catch (error) {
      terminationFailure ??= { error }
    }
    try {
      this.worker.removeAllListeners()
    } catch (error) {
      terminationFailure ??= { error }
    }
    try {
      this.emit('terminated')
    } catch (error) {
      terminationFailure ??= { error }
    }
    try {
      this.removeAllListeners()
    } catch (error) {
      terminationFailure ??= { error }
    }
    if (terminationFailure != null) {
      throw terminationFailure.error
    }
  }

  /**
   * Whether the worker node is back pressured or not.
   * @returns `true` if the worker node is back pressured, `false` otherwise.
   */
  private hasBackPressure (): boolean {
    return this.tasksQueue.size >= this.tasksQueueBackPressureSize
  }
}
