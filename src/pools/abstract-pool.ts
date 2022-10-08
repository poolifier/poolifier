import type {
  MessageValue,
  PromiseWorkerResponseWrapper
} from '../utility-types'
import { EMPTY_FUNCTION } from '../utils'
import { isKillBehavior, KillBehaviors } from '../worker/worker-options'
import type { AbstractPoolWorker } from './abstract-pool-worker'
import type { PoolOptions } from './pool'
import {
  IPoolInternal,
  PoolEmitter,
  PoolType,
  TasksUsage
} from './pool-internal'
import {
  WorkerChoiceStrategies,
  WorkerChoiceStrategy
} from './selection-strategies/selection-strategies-types'
import { WorkerChoiceStrategyContext } from './selection-strategies/worker-choice-strategy-context'

/**
 * Base class containing some shared logic for all poolifier pools.
 *
 * @template Worker Type of worker which manages this pool.
 * @template Data Type of data sent to the worker. This can only be serializable data.
 * @template Response Type of response of execution. This can only be serializable data.
 */
export abstract class AbstractPool<
  Worker extends AbstractPoolWorker,
  Data = unknown,
  Response = unknown
> implements IPoolInternal<Worker, Data, Response> {
  /** @inheritdoc */
  public readonly workers: Worker[] = []

  /**
   * The workers tasks usage map.
   *
   *  `key`: The `Worker`
   *  `value`: Worker tasks usage statistics.
   */
  protected workersTasksUsage: Map<Worker, TasksUsage> = new Map<
    Worker,
    TasksUsage
  >()

  /** @inheritdoc */
  public readonly emitter?: PoolEmitter

  /** @inheritdoc */
  public readonly max?: number

  /**
   * The promise map.
   *
   * - `key`: This is the message Id of each submitted task.
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
   * @param numberOfWorkers Number of workers that this pool should manage.
   * @param filePath Path to the worker-file.
   * @param opts Options for the pool.
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

    if (this.opts.enableEvents) {
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
            this.destroyWorker(workerCreated) as void
          }
        })
        return workerCreated
      },
      this.opts.workerChoiceStrategy
    )
  }

  private checkFilePath (filePath: string): void {
    if (!filePath) {
      throw new Error('Please specify a file with a worker implementation')
    }
  }

  private checkNumberOfWorkers (numberOfWorkers: number): void {
    if (numberOfWorkers == null) {
      throw new Error(
        'Cannot instantiate a pool without specifying the number of workers'
      )
    } else if (!Number.isSafeInteger(numberOfWorkers)) {
      throw new Error(
        'Cannot instantiate a pool with a non integer number of workers'
      )
    } else if (numberOfWorkers < 0) {
      throw new Error(
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

  /** @inheritdoc */
  public abstract get type (): PoolType

  /** @inheritdoc */
  public get numberOfRunningTasks (): number {
    // TODO: The number of running tasks calculation is not correct
    return this.promiseMap.size
  }

  /** @inheritdoc */
  public getWorkerIndex (worker: Worker): number {
    return this.workers.indexOf(worker)
  }

  /** @inheritdoc */
  public abstract getWorkerRunningTasks (worker: Worker): number | undefined

  /** @inheritdoc */
  public abstract getWorkerAverageTasksRunTime (worker: Worker): number

  /** @inheritdoc */
  public setWorkerChoiceStrategy (
    workerChoiceStrategy: WorkerChoiceStrategy
  ): void {
    this.opts.workerChoiceStrategy = workerChoiceStrategy
    this.workerChoiceStrategyContext.setWorkerChoiceStrategy(
      workerChoiceStrategy
    )
  }

  /** @inheritdoc */
  public abstract get busy (): boolean

  protected internalGetBusyStatus (): boolean {
    return (
      this.numberOfRunningTasks >= this.numberOfWorkers &&
      this.findFreeWorker() === false
    )
  }

  /** @inheritdoc */
  public findFreeWorker (): Worker | false {
    for (const worker of this.workers) {
      if (this.getWorkerRunningTasks(worker) === 0) {
        // A worker is free, return the matching worker
        return worker
      }
    }
    return false
  }

  /** @inheritdoc */
  public execute (data: Data): Promise<Response> {
    // Configure worker to handle message with the specified task
    const worker = this.chooseWorker()
    const messageId = ++this.nextMessageId
    const res = this.internalExecute(worker, messageId)
    this.checkAndEmitBusy()
    data = data ?? ({} as Data)
    this.sendToWorker(worker, {
      data,
      id: messageId,
      workerId: this.getWorkerIndex(worker)
    })
    return res
  }

  /** @inheritdoc */
  public async destroy (): Promise<void> {
    await Promise.all(this.workers.map(worker => this.destroyWorker(worker)))
  }

  /**
   * Shut down given worker.
   *
   * @param worker A worker within `workers`.
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
   * Hook executed before the worker task promise resolution.
   * Can be overridden.
   *
   * @param worker The worker.
   */
  protected beforePromiseWorkerResponseHook (worker: Worker): void {
    this.increaseWorkerRunningTasks(worker)
  }

  /**
   * Hook executed after the worker task promise resolution.
   * Can be overridden.
   *
   * @param message The received message.
   * @param promise The Promise response.
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
   * Should return whether the worker is the main worker or not.
   */
  protected abstract isMain (): boolean

  /**
   * Reset worker tasks usage statistics.
   *
   * @param worker The worker.
   */
  protected resetWorkerTasksUsage (worker: Worker): void {
    this.workersTasksUsage.delete(worker)
  }

  /**
   * Removes the given worker from the pool.
   *
   * @param worker Worker that will be removed.
   */
  protected removeWorker (worker: Worker): void {
    // Clean worker from data structure
    this.workers.splice(this.getWorkerIndex(worker), 1)
    this.resetWorkerTasksUsage(worker)
  }

  /**
   * Choose a worker for the next task.
   *
   * The default implementation uses a round robin algorithm to distribute the load.
   *
   * @returns Worker.
   */
  protected chooseWorker (): Worker {
    return this.workerChoiceStrategyContext.execute()
  }

  /**
   * Send a message to the given worker.
   *
   * @param worker The worker which should receive the message.
   * @param message The message.
   */
  protected abstract sendToWorker (
    worker: Worker,
    message: MessageValue<Data>
  ): void

  /**
   * Register a listener callback on a given worker.
   *
   * @param worker A worker.
   * @param listener A message listener callback.
   */
  protected abstract registerWorkerMessageListener<
    Message extends Data | Response
  > (worker: Worker, listener: (message: MessageValue<Message>) => void): void

  protected internalExecute (
    worker: Worker,
    messageId: number
  ): Promise<Response> {
    this.beforePromiseWorkerResponseHook(worker)
    return new Promise<Response>((resolve, reject) => {
      this.promiseMap.set(messageId, {
        resolve,
        reject,
        worker
      })
    })
  }

  /**
   * Returns a newly created worker.
   */
  protected abstract createWorker (): Worker

  /**
   * Function that can be hooked up when a worker has been newly created and moved to the workers registry.
   *
   * Can be used to update the `maxListeners` or binding the `main-worker`<->`worker` connection if not bind by default.
   *
   * @param worker The newly created worker.
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
    worker.once('exit', () => this.removeWorker(worker))

    this.workers.push(worker)

    // Init worker tasks usage map
    this.workersTasksUsage.set(worker, {
      run: 0,
      running: 0,
      runTime: 0,
      avgRunTime: 0
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
        const promise = this.promiseMap.get(message.id)
        if (promise !== undefined) {
          this.afterPromiseWorkerResponseHook(message, promise)
          if (message.error) promise.reject(message.error)
          else promise.resolve(message.data as Response)
          this.promiseMap.delete(message.id)
        }
      }
    }
  }

  private checkAndEmitBusy (): void {
    if (this.opts.enableEvents && this.busy) {
      this.emitter?.emit('busy')
    }
  }

  /**
   * Increase the number of tasks that the given worker has applied.
   *
   * @param worker Worker which running tasks is increased.
   */
  protected increaseWorkerRunningTasks (worker: Worker): void {
    this.stepWorkerRunningTasks(worker, 1)
  }

  /**
   * Decrease the number of tasks that the given worker has applied.
   *
   * @param worker Worker which running tasks is decreased.
   */
  protected decreaseWorkerRunningTasks (worker: Worker): void {
    this.stepWorkerRunningTasks(worker, 1)
  }

  /**
   * Step the number of tasks that the given worker has applied.
   *
   * @param worker Worker which running tasks are stepped.
   * @param step Number of running tasks step.
   */
  private stepWorkerRunningTasks (worker: Worker, step: number): void {
    const tasksUsage = this.workersTasksUsage.get(worker)
    if (tasksUsage !== undefined) {
      tasksUsage.running = tasksUsage.running + step
      this.workersTasksUsage.set(worker, tasksUsage)
    } else {
      throw Error('Worker could not be found in worker tasks usage map')
    }
  }

  /**
   * Step the number of tasks that the given worker has run.
   *
   * @param worker Worker which has run tasks.
   * @param step Number of run tasks step.
   */
  private stepWorkerRunTasks (worker: Worker, step: number) {
    const tasksUsage = this.workersTasksUsage.get(worker)
    if (tasksUsage !== undefined) {
      tasksUsage.run = tasksUsage.run + step
      this.workersTasksUsage.set(worker, tasksUsage)
    } else {
      throw Error('Worker could not be found in worker tasks usage map')
    }
  }

  /**
   * Update tasks run time for the given worker.
   *
   * @param worker Worker which run the task.
   * @param taskRunTime Worker task run time.
   */
  private updateWorkerTasksRunTime (
    worker: Worker,
    taskRunTime: number | undefined
  ) {
    const tasksUsage = this.workersTasksUsage.get(worker)
    if (
      tasksUsage !== undefined &&
      taskRunTime !== undefined &&
      tasksUsage.run !== 0
    ) {
      tasksUsage.runTime += taskRunTime
      tasksUsage.avgRunTime = tasksUsage.runTime / tasksUsage.run
      this.workersTasksUsage.set(worker, tasksUsage)
    } else {
      throw Error('Worker could not be found in worker tasks usage map')
    }
  }
}
