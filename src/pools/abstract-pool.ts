import type {
  MessageValue,
  PromiseWorkerResponseWrapper
} from '../utility-types'
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
  public readonly workers: Map<number, WorkerType<Worker>> = new Map<
  number,
  WorkerType<Worker>
  >()

  /** {@inheritDoc} */
  public readonly emitter?: PoolEmitter

  /**
   * Id of the next worker.
   */
  protected nextWorkerId: number = 0

  /**
   * The promise map.
   *
   * - `key`: This is the message id of each submitted task.
   * - `value`: An object that contains the worker, the resolve function and the reject function.
   *
   * When we receive a message from the worker we get a map entry and resolve/reject the promise based on the message.
   */
  protected promiseMap: Map<
  number,
  PromiseWorkerResponseWrapper<Worker, Response>
  > = new Map<number, PromiseWorkerResponseWrapper<Worker, Response>>()

  /**
   * Id of the next message.
   */
  protected nextMessageId: number = 0

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
    this.setupHook()

    for (let i = 1; i <= this.numberOfWorkers; i++) {
      this.createAndSetupWorker()
    }

    if (this.opts.enableEvents === true) {
      this.emitter = new PoolEmitter()
    }
    this.workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
      this,
      () => {
        const workerCreated = this.createAndSetupWorker()
        this.registerWorkerMessageListener(workerCreated, message => {
          if (
            isKillBehavior(KillBehaviors.HARD, message.kill) ||
            this.getWorkerRunningTasks(workerCreated) === 0
          ) {
            // Kill received from the worker, means that no new tasks are submitted to that worker for a while ( > maxInactiveTime)
            void this.destroyWorker(workerCreated)
          }
        })
        return workerCreated
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

  /** {@inheritDoc} */
  public get numberOfRunningTasks (): number {
    return this.promiseMap.size
  }

  /**
   * Gets worker key.
   *
   * @param worker - The worker.
   * @returns The worker key.
   */
  private getWorkerKey (worker: Worker): number | undefined {
    return [...this.workers].find(([, value]) => value.worker === worker)?.[0]
  }

  /** {@inheritDoc} */
  public getWorkerRunningTasks (worker: Worker): number | undefined {
    return this.workers.get(this.getWorkerKey(worker) as number)?.tasksUsage
      ?.running
  }

  /** {@inheritDoc} */
  public getWorkerAverageTasksRunTime (worker: Worker): number | undefined {
    return this.workers.get(this.getWorkerKey(worker) as number)?.tasksUsage
      ?.avgRunTime
  }

  /** {@inheritDoc} */
  public setWorkerChoiceStrategy (
    workerChoiceStrategy: WorkerChoiceStrategy
  ): void {
    this.opts.workerChoiceStrategy = workerChoiceStrategy
    for (const [key, value] of this.workers) {
      this.setWorker(key, value.worker, {
        run: 0,
        running: 0,
        runTime: 0,
        avgRunTime: 0
      })
    }
    this.workerChoiceStrategyContext.setWorkerChoiceStrategy(
      workerChoiceStrategy
    )
  }

  /** {@inheritDoc} */
  public abstract get busy (): boolean

  protected internalGetBusyStatus (): boolean {
    return (
      this.numberOfRunningTasks >= this.numberOfWorkers &&
      this.findFreeWorker() === false
    )
  }

  /** {@inheritDoc} */
  public findFreeWorker (): Worker | false {
    for (const value of this.workers.values()) {
      if (value.tasksUsage.running === 0) {
        // A worker is free, return the matching worker
        return value.worker
      }
    }
    return false
  }

  /** {@inheritDoc} */
  public async execute (data: Data): Promise<Response> {
    // Configure worker to handle message with the specified task
    const worker = this.chooseWorker()
    const res = this.internalExecute(worker, this.nextMessageId)
    this.checkAndEmitBusy()
    this.sendToWorker(worker, {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      data: data ?? ({} as Data),
      id: this.nextMessageId
    })
    ++this.nextMessageId
    // eslint-disable-next-line @typescript-eslint/return-await
    return res
  }

  /** {@inheritDoc} */
  public async destroy (): Promise<void> {
    await Promise.all(
      [...this.workers].map(async ([, value]) => {
        await this.destroyWorker(value.worker)
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
   * @param worker - The worker.
   */
  protected beforePromiseWorkerResponseHook (worker: Worker): void {
    this.increaseWorkerRunningTasks(worker)
  }

  /**
   * Hook executed after the worker task promise resolution.
   * Can be overridden.
   *
   * @param message - The received message.
   * @param promise - The Promise response.
   */
  protected afterPromiseWorkerResponseHook (
    message: MessageValue<Response>,
    promise: PromiseWorkerResponseWrapper<Worker, Response>
  ): void {
    this.decreaseWorkerRunningTasks(promise.worker)
    this.stepWorkerRunTasks(promise.worker, 1)
    this.updateWorkerTasksRunTime(promise.worker, message.taskRunTime)
  }

  /**
   * Removes the given worker from the pool.
   *
   * @param worker - The worker that will be removed.
   */
  protected removeWorker (worker: Worker): void {
    this.workers.delete(this.getWorkerKey(worker) as number)
    --this.nextWorkerId
  }

  /**
   * Chooses a worker for the next task.
   *
   * The default implementation uses a round robin algorithm to distribute the load.
   *
   * @returns Worker.
   */
  protected chooseWorker (): Worker {
    return this.workerChoiceStrategyContext.execute()
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

    this.setWorker(this.nextWorkerId, worker, {
      run: 0,
      running: 0,
      runTime: 0,
      avgRunTime: 0
    })
    ++this.nextWorkerId

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
        const promise = this.promiseMap.get(message.id)
        if (promise !== undefined) {
          if (message.error != null) {
            promise.reject(message.error)
          } else {
            promise.resolve(message.data as Response)
          }
          this.afterPromiseWorkerResponseHook(message, promise)
          this.promiseMap.delete(message.id)
        }
      }
    }
  }

  private async internalExecute (
    worker: Worker,
    messageId: number
  ): Promise<Response> {
    this.beforePromiseWorkerResponseHook(worker)
    return await new Promise<Response>((resolve, reject) => {
      this.promiseMap.set(messageId, { resolve, reject, worker })
    })
  }

  private checkAndEmitBusy (): void {
    if (this.opts.enableEvents === true && this.busy) {
      this.emitter?.emit('busy')
    }
  }

  /**
   * Increases the number of tasks that the given worker has applied.
   *
   * @param worker - Worker which running tasks is increased.
   */
  private increaseWorkerRunningTasks (worker: Worker): void {
    this.stepWorkerRunningTasks(worker, 1)
  }

  /**
   * Decreases the number of tasks that the given worker has applied.
   *
   * @param worker - Worker which running tasks is decreased.
   */
  private decreaseWorkerRunningTasks (worker: Worker): void {
    this.stepWorkerRunningTasks(worker, -1)
  }

  /**
   * Get tasks usage of the given worker.
   *
   * @param worker - Worker which tasks usage is returned.
   */
  private getWorkerTasksUsage (worker: Worker): TasksUsage | undefined {
    if (this.checkWorker(worker)) {
      const workerKey = this.getWorkerKey(worker) as number
      const workerEntry = this.workers.get(workerKey) as WorkerType<Worker>
      return workerEntry.tasksUsage
    }
  }

  /**
   * Steps the number of tasks that the given worker has applied.
   *
   * @param worker - Worker which running tasks are stepped.
   * @param step - Number of running tasks step.
   */
  private stepWorkerRunningTasks (worker: Worker, step: number): void {
    // prettier-ignore
    (this.getWorkerTasksUsage(worker) as TasksUsage).running += step
  }

  /**
   * Steps the number of tasks that the given worker has run.
   *
   * @param worker - Worker which has run tasks.
   * @param step - Number of run tasks step.
   */
  private stepWorkerRunTasks (worker: Worker, step: number): void {
    // prettier-ignore
    (this.getWorkerTasksUsage(worker) as TasksUsage).run += step
  }

  /**
   * Updates tasks runtime for the given worker.
   *
   * @param worker - Worker which run the task.
   * @param taskRunTime - Worker task runtime.
   */
  private updateWorkerTasksRunTime (
    worker: Worker,
    taskRunTime: number | undefined
  ): void {
    if (
      this.workerChoiceStrategyContext.getWorkerChoiceStrategy()
        .requiredStatistics.runTime
    ) {
      const workerTasksUsage = this.getWorkerTasksUsage(worker) as TasksUsage
      workerTasksUsage.runTime += taskRunTime ?? 0
      if (workerTasksUsage.run !== 0) {
        workerTasksUsage.avgRunTime =
          workerTasksUsage.runTime / workerTasksUsage.run
      }
    }
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
    this.workers.set(workerKey, {
      worker,
      tasksUsage
    })
  }

  /**
   * Checks if the given worker is registered in the pool.
   *
   * @param worker - Worker to check.
   * @returns `true` if the worker is registered in the pool.
   */
  private checkWorker (worker: Worker): boolean {
    if (this.getWorkerKey(worker) == null) {
      throw new Error('Worker could not be found in the pool')
    }
    return true
  }
}
