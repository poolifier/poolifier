import { isMainThread, MessageChannel, SHARE_ENV, Worker } from 'worker_threads'
import type { Draft, MessageValue } from '../../utility-types'
import { SharedUsage } from '../../worker/shared-usage'
import { AbstractPool } from '../abstract-pool'
import type { PoolOptions } from '../pool'
import { PoolType } from '../pool-internal'

/**
 * A thread worker with message channels for communication between main thread and thread worker.
 */
export type ThreadWorkerWithMessageChannel = Worker & Draft<MessageChannel>

/**
 * A thread pool with a fixed number of threads.
 *
 * It is possible to perform tasks in sync or asynchronous mode as you prefer.
 *
 * This pool selects the threads in a round robin fashion.
 *
 * @template DataType of data sent to the worker. This can only be serializable data.
 * @template ResponseType of response of execution. This can only be serializable data.
 * @author [Alessandro Pio Ardizio](https://github.com/pioardi)
 * @since 0.0.1
 */
export class FixedThreadPool<
  Data = unknown,
  Response = unknown
> extends AbstractPool<ThreadWorkerWithMessageChannel, Data, Response> {
  /**
   * Shared object to store workers tasks usage statistics.
   */
  private workersTasksSharedUsage!: SharedUsage

  /**
   * Constructs a new poolifier fixed thread pool.
   *
   * @param numberOfThreads Number of threads for this pool.
   * @param filePath Path to an implementation of a `ThreadWorker` file, which can be relative or absolute.
   * @param [opts={}] Options for this fixed thread pool.
   */
  public constructor (
    numberOfThreads: number,
    filePath: string,
    opts: PoolOptions<ThreadWorkerWithMessageChannel> = {}
  ) {
    super(numberOfThreads, filePath, opts)
    this.initWorkersTasksSharedUsage(numberOfThreads)
  }

  protected initWorkersTasksSharedUsage (numberOfWorkers: number): void {
    const sharedUsageArrayBuffer = new SharedArrayBuffer(
      (Int32Array.BYTES_PER_ELEMENT * 3 + Float64Array.BYTES_PER_ELEMENT) *
        numberOfWorkers
    )
    this.workersTasksSharedUsage = new SharedUsage(
      numberOfWorkers,
      sharedUsageArrayBuffer
    )
    for (const worker of this.workers) {
      // Send to worker shared array for workers tasks usage
      this.sendWorkersTasksSharedUsage(worker, sharedUsageArrayBuffer)
    }
  }

  /** @inheritDoc */
  protected isMain (): boolean {
    return isMainThread
  }

  /** @inheritDoc */
  public getWorkerRunningTasks (worker: Worker): number | undefined {
    return this.workersTasksUsage.get(worker)?.running ?? 0
    // return this.workersTasksSharedUsage[
    //   `worker${this.getWorkerIndex(worker)}-running`
    // ] as number
  }

  /** @inheritDoc */
  public getWorkerAverageTasksRunTime (worker: Worker): number {
    return this.workersTasksSharedUsage[
      `worker${this.getWorkerIndex(worker)}-avgRunTime`
    ] as number
  }

  /** @inheritDoc */
  public async destroyWorker (
    worker: ThreadWorkerWithMessageChannel
  ): Promise<void> {
    this.sendToWorker(worker, { kill: 1 })
    await worker.terminate()
  }

  /** @inheritDoc */
  protected sendToWorker (
    worker: ThreadWorkerWithMessageChannel,
    message: MessageValue<Data>
  ): void {
    worker.postMessage(message)
  }

  /** @inheritDoc */
  public registerWorkerMessageListener<Message extends Data | Response> (
    messageChannel: ThreadWorkerWithMessageChannel,
    listener: (message: MessageValue<Message>) => void
  ): void {
    messageChannel.port2?.on('message', listener)
  }

  /** @inheritDoc */
  protected createWorker (): ThreadWorkerWithMessageChannel {
    return new Worker(this.filePath, {
      env: SHARE_ENV
    })
  }

  /** @inheritDoc */
  protected afterWorkerSetup (worker: ThreadWorkerWithMessageChannel): void {
    const { port1, port2 } = new MessageChannel()
    worker.postMessage({ parent: port1 }, [port1])
    worker.port1 = port1
    worker.port2 = port2
    // Listen worker messages.
    this.registerWorkerMessageListener(worker, super.workerListener())
  }

  /** @inheritDoc */
  public get type (): PoolType {
    return PoolType.FIXED
  }

  /** @inheritDoc */
  public get busy (): boolean {
    return this.internalGetBusyStatus()
  }

  /** @inheritDoc */
  protected resetWorkerTasksUsage (worker: Worker): void {
    super.resetWorkerTasksUsage(worker)
    const workerId = this.getWorkerIndex(worker)
    this.workersTasksSharedUsage[`worker${workerId}-run`] = 0
    this.workersTasksSharedUsage[`worker${workerId}-running`] = 0
    this.workersTasksSharedUsage[`worker${workerId}-runTime`] = 0
    this.workersTasksSharedUsage[`worker${workerId}-avgRunTime`] = 0
  }

  private sendWorkersTasksSharedUsage (
    worker: Worker,
    sharedUsageArrayBuffer: SharedArrayBuffer
  ) {
    this.sendToWorker(worker, {
      numberOfWorkers: this.numberOfWorkers,
      tasksSharedUsage: sharedUsageArrayBuffer
    })
  }
}
