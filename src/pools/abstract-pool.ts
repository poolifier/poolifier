import crypto from 'node:crypto'
import type { MessageValue, PromiseResponseWrapper } from '../utility-types'
import { EMPTY_FUNCTION } from '../utils'
import { KillBehaviors, isKillBehavior } from '../worker/worker-options'
import type { PoolOptions } from './pool'
import { PoolEmitter } from './pool'
import type { IPoolInternal, TasksUsage, WorkerType } from './pool-internal'
import { PoolType } from './pool-internal'
import type { IPoolWorker } from './pool-worker'
import {
  WorkerChoiceStrategies,
  type WorkerChoiceStrategy
} from './selection-strategies/selection-strategies-types'
import { WorkerChoiceStrategyContext } from './selection-strategies/worker-choice-strategy-context'

/**
 * Base class that implements some shared logic for all poolifier pools.
 *
 * @typeParam Worker - Type of worker which manages this pool.
 * @typeParam Data - Type of data sent to the worker. This can only be serializable data.
 * @typeParam Response - Type of response of execution. This can only be serializable data.
 */
export abstract class AbstractPool<
  Worker extends IPoolWorker,
  Data = unknown,
  Response = unknown
> implements IPoolInternal<Worker, Data, Response> {
  /** {@inheritDoc} */
  public readonly workers: Array<WorkerType<Worker>> = []

  /** {@inheritDoc} */
  public readonly emitter?: PoolEmitter

  /**
   * The promise response map.
   *
   * - `key`: The message id of each submitted task.
   * - `value`: An object that contains the worker, the promise resolve and reject callbacks.
   *
   * When we receive a message from the worker we get a map entry with the promise resolve/reject bound to the message.
   */
  protected promiseResponseMap: Map<
  string,
  PromiseResponseWrapper<Worker, Response>
  > = new Map<string, PromiseResponseWrapper<Worker, Response>>()

  /**
   * Worker choice strategy instance implementing the worker choice algorithm.
   *
   * Default to a strategy implementing a round robin algorithm.
   */
  protected workerChoiceStrategyContext: WorkerChoiceStrategyContext<
  Worker,
  Data,
  Response
  >

  /**
   * Constructs a new poolifier pool.
   *
   * @param numberOfWorkers - Number of workers that this pool should manage.
   * @param filePath - Path to the worker-file.
   * @param opts - Options for the pool.
   */
  public constructor (
    public readonly numberOfWorkers: number,
    public readonly filePath: string,
    public readonly opts: PoolOptions<Worker>
  ) {
    if (!this.isMain()) {
      throw new Error('Cannot start a pool from a worker!')
    }
    this.checkNumberOfWorkers(this.numberOfWorkers)
    this.checkFilePath(this.filePath)
    this.checkPoolOptions(this.opts)

    this.chooseWorker.bind(this)
    this.internalExecute.bind(this)
    this.checkAndEmitFull.bind(this)
    this.checkAndEmitBusy.bind(this)
    this.sendToWorker.bind(this)

    this.setupHook()

    for (let i = 1; i <= this.numberOfWorkers; i++) {
      this.createAndSetupWorker()
    }

    if (this.opts.enableEvents === true) {
      this.emitter = new PoolEmitter()
    }
    this.workerChoiceStrategyContext = new WorkerChoiceStrategyContext<
    Worker,
    Data,
    Response
    >(
      this,
      () => {
        const createdWorker = this.createAndSetupWorker()
        this.registerWorkerMessageListener(createdWorker, message => {
          if (
            isKillBehavior(KillBehaviors.HARD, message.kill) ||
            this.getWorkerTasksUsage(createdWorker)?.running === 0
          ) {
            // Kill received from the worker, means that no new tasks are submitted to that worker for a while ( > maxInactiveTime)
            void this.destroyWorker(createdWorker)
          }
        })
        return this.getWorkerKey(createdWorker)
      },
      this.opts.workerChoiceStrategy
    )
  }

  private checkFilePath (filePath: string): void {
    if (
      filePath == null ||
      (typeof filePath === 'string' && filePath.trim().length === 0)
    ) {
      throw new Error('Please specify a file with a worker implementation')
    }
  }

  private checkNumberOfWorkers (numberOfWorkers: number): void {
    if (numberOfWorkers == null) {
      throw new Error(
        'Cannot instantiate a pool without specifying the number of workers'
      )
    } else if (!Number.isSafeInteger(numberOfWorkers)) {
      throw new TypeError(
        'Cannot instantiate a pool with a non integer number of workers'
      )
    } else if (numberOfWorkers < 0) {
      throw new RangeError(
        'Cannot instantiate a pool with a negative number of workers'
      )
    } else if (this.type === PoolType.FIXED && numberOfWorkers === 0) {
      throw new Error('Cannot instantiate a fixed pool with no worker')
    }
  }

  private checkPoolOptions (opts: PoolOptions<Worker>): void {
    this.opts.workerChoiceStrategy =
      opts.workerChoiceStrategy ?? WorkerChoiceStrategies.ROUND_ROBIN
    this.opts.enableEvents = opts.enableEvents ?? true
  }

  /** {@inheritDoc} */
  public abstract get type (): PoolType

  /**
   * Number of tasks concurrently running.
   */
  private get numberOfRunningTasks (): number {
    return this.promiseResponseMap.size
  }

  /**
   * Gets the given worker key.
   *
   * @param worker - The worker.
   * @returns The worker key if the worker is found in the pool, `-1` otherwise.
   */
  private getWorkerKey (worker: Worker): number {
    return this.workers.findIndex(workerItem => workerItem.worker === worker)
  }

  /** {@inheritDoc} */
  public setWorkerChoiceStrategy (
    workerChoiceStrategy: WorkerChoiceStrategy
  ): void {
    this.opts.workerChoiceStrategy = workerChoiceStrategy
    for (const [index, workerItem] of this.workers.entries()) {
      this.setWorker(index, workerItem.worker, {
        run: 0,
        running: 0,
        runTime: 0,
        avgRunTime: 0,
        error: 0
      })
    }
    this.workerChoiceStrategyContext.setWorkerChoiceStrategy(
      this,
      workerChoiceStrategy
    )
  }

  /** {@inheritDoc} */
  public abstract get full (): boolean

  /** {@inheritDoc} */
  public abstract get busy (): boolean

  protected internalBusy (): boolean {
    return (
      this.numberOfRunningTasks >= this.numberOfWorkers &&
      this.findFreeWorkerKey() === -1
    )
  }

  /** {@inheritDoc} */
  public findFreeWorkerKey (): number {
    return this.workers.findIndex(workerItem => {
      return workerItem.tasksUsage.running === 0
    })
  }

  /** {@inheritDoc} */
  public async execute (data: Data): Promise<Response> {
    const [workerKey, worker] = this.chooseWorker()
    const messageId = crypto.randomUUID()
    const res = this.internalExecute(workerKey, worker, messageId)
    this.checkAndEmitFull()
    this.checkAndEmitBusy()
    this.sendToWorker(worker, {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      data: data ?? ({} as Data),
      id: messageId
    })
    // eslint-disable-next-line @typescript-eslint/return-await
    return res
  }

  /** {@inheritDoc} */
  public async destroy (): Promise<void> {
    await Promise.all(
      this.workers.map(async workerItem => {
        await this.destroyWorker(workerItem.worker)
      })
    )
  }

  /**
   * Shutdowns given worker.
   *
   * @param worker - A worker within `workers`.
   */
  protected abstract destroyWorker (worker: Worker): void | Promise<void>

  /**
   * Setup hook that can be overridden by a Poolifier pool implementation
   * to run code before workers are created in the abstract constructor.
   */
  protected setupHook (): void {
    // Can be overridden
  }

  /**
   * Should return whether the worker is the main worker or not.
   */
  protected abstract isMain (): boolean

  /**
   * Hook executed before the worker task promise resolution.
   * Can be overridden.
   *
   * @param workerKey - The worker key.
   */
  protected beforePromiseResponseHook (workerKey: number): void {
    ++this.workers[workerKey].tasksUsage.running
  }

  /**
   * Hook executed after the worker task promise resolution.
   * Can be overridden.
   *
   * @param worker - The worker.
   * @param message - The received message.
   */
  protected afterPromiseResponseHook (
    worker: Worker,
    message: MessageValue<Response>
  ): void {
    const workerTasksUsage = this.getWorkerTasksUsage(worker) as TasksUsage
    --workerTasksUsage.running
    ++workerTasksUsage.run
    if (message.error != null) {
      ++workerTasksUsage.error
    }
    if (this.workerChoiceStrategyContext.getRequiredStatistics().runTime) {
      workerTasksUsage.runTime += message.taskRunTime ?? 0
      if (
        this.workerChoiceStrategyContext.getRequiredStatistics().avgRunTime &&
        workerTasksUsage.run !== 0
      ) {
        workerTasksUsage.avgRunTime =
          workerTasksUsage.runTime / workerTasksUsage.run
      }
    }
  }

  /**
   * Removes the given worker from the pool.
   *
   * @param worker - The worker that will be removed.
   */
  protected removeWorker (worker: Worker): void {
    const workerKey = this.getWorkerKey(worker)
    this.workers.splice(workerKey, 1)
    this.workerChoiceStrategyContext.remove(workerKey)
  }

  /**
   * Chooses a worker for the next task.
   *
   * The default implementation uses a round robin algorithm to distribute the load.
   *
   * @returns [worker key, worker].
   */
  protected chooseWorker (): [number, Worker] {
    const workerKey = this.workerChoiceStrategyContext.execute()
    return [workerKey, this.workers[workerKey].worker]
  }

  /**
   * Sends a message to the given worker.
   *
   * @param worker - The worker which should receive the message.
   * @param message - The message.
   */
  protected abstract sendToWorker (
    worker: Worker,
    message: MessageValue<Data>
  ): void

  /**
   * Registers a listener callback on a given worker.
   *
   * @param worker - The worker which should register a listener.
   * @param listener - The message listener callback.
   */
  protected abstract registerWorkerMessageListener<
    Message extends Data | Response
  >(worker: Worker, listener: (message: MessageValue<Message>) => void): void

  /**
   * Returns a newly created worker.
   */
  protected abstract createWorker (): Worker

  /**
   * Function that can be hooked up when a worker has been newly created and moved to the workers registry.
   *
   * Can be used to update the `maxListeners` or binding the `main-worker`\<-\>`worker` connection if not bind by default.
   *
   * @param worker - The newly created worker.
   */
  protected abstract afterWorkerSetup (worker: Worker): void

  /**
   * Creates a new worker for this pool and sets it up completely.
   *
   * @returns New, completely set up worker.
   */
  protected createAndSetupWorker (): Worker {
    const worker = this.createWorker()

    worker.on('message', this.opts.messageHandler ?? EMPTY_FUNCTION)
    worker.on('error', this.opts.errorHandler ?? EMPTY_FUNCTION)
    worker.on('online', this.opts.onlineHandler ?? EMPTY_FUNCTION)
    worker.on('exit', this.opts.exitHandler ?? EMPTY_FUNCTION)
    worker.once('exit', () => {
      this.removeWorker(worker)
    })

    this.pushWorker(worker, {
      run: 0,
      running: 0,
      runTime: 0,
      avgRunTime: 0,
      error: 0
    })

    this.afterWorkerSetup(worker)

    return worker
  }

  /**
   * This function is the listener registered for each worker.
   *
   * @returns The listener function to execute when a message is received from a worker.
   */
  protected workerListener (): (message: MessageValue<Response>) => void {
    return message => {
      if (message.id !== undefined) {
        const promiseResponse = this.promiseResponseMap.get(message.id)
        if (promiseResponse !== undefined) {
          if (message.error != null) {
            promiseResponse.reject(message.error)
          } else {
            promiseResponse.resolve(message.data as Response)
          }
          this.afterPromiseResponseHook(promiseResponse.worker, message)
          this.promiseResponseMap.delete(message.id)
        }
      }
    }
  }

  private async internalExecute (
    workerKey: number,
    worker: Worker,
    messageId: string
  ): Promise<Response> {
    this.beforePromiseResponseHook(workerKey)
    return await new Promise<Response>((resolve, reject) => {
      this.promiseResponseMap.set(messageId, { resolve, reject, worker })
    })
  }

  private checkAndEmitBusy (): void {
    if (this.opts.enableEvents === true && this.busy) {
      this.emitter?.emit('busy')
    }
  }

  private checkAndEmitFull (): void {
    if (
      this.type === PoolType.DYNAMIC &&
      this.opts.enableEvents === true &&
      this.full
    ) {
      this.emitter?.emit('full')
    }
  }

  /**
   * Gets worker tasks usage.
   *
   * @param worker - The worker.
   * @returns The worker tasks usage.
   */
  private getWorkerTasksUsage (worker: Worker): TasksUsage | undefined {
    const workerKey = this.getWorkerKey(worker)
    if (workerKey !== -1) {
      return this.workers[workerKey].tasksUsage
    }
    throw new Error('Worker could not be found in the pool')
  }

  /**
   * Pushes the given worker.
   *
   * @param worker - The worker.
   * @param tasksUsage - The worker tasks usage.
   */
  private pushWorker (worker: Worker, tasksUsage: TasksUsage): void {
    this.workers.push({
      worker,
      tasksUsage
    })
  }

  /**
   * Sets the given worker.
   *
   * @param workerKey - The worker key.
   * @param worker - The worker.
   * @param tasksUsage - The worker tasks usage.
   */
  private setWorker (
    workerKey: number,
    worker: Worker,
    tasksUsage: TasksUsage
  ): void {
    this.workers[workerKey] = {
      worker,
      tasksUsage
    }
  }
}
