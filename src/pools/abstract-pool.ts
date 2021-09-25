import type {
  MessageValue,
  PromiseWorkerResponseWrapper
} from '../utility-types'
import { EMPTY_FUNCTION } from '../utils'
import { isKillBehavior, KillBehaviors } from '../worker/worker-options'
import type { IPoolInternal, TasksUsage } from './pool-internal'
import { PoolEmitter, PoolType } from './pool-internal'
import type { WorkerChoiceStrategy } from './selection-strategies/selection-strategies-types'
import { WorkerChoiceStrategies } from './selection-strategies/selection-strategies-types'
import { WorkerChoiceStrategyContext } from './selection-strategies/worker-choice-strategy-context'

/**
 * Callback invoked if the worker has received a message.
 */
export type MessageHandler<Worker> = (this: Worker, m: unknown) => void

/**
 * Callback invoked if the worker raised an error.
 */
export type ErrorHandler<Worker> = (this: Worker, e: Error) => void

/**
 * Callback invoked when the worker has started successfully.
 */
export type OnlineHandler<Worker> = (this: Worker) => void

/**
 * Callback invoked when the worker exits successfully.
 */
export type ExitHandler<Worker> = (this: Worker, code: number) => void

/**
 * Basic interface that describes the minimum required implementation of listener events for a pool-worker.
 */
export interface IWorker {
  /**
   * Register a listener to the message event.
   *
   * @param event `'message'`.
   * @param handler The message handler.
   */
  on(event: 'message', handler: MessageHandler<this>): void
  /**
   * Register a listener to the error event.
   *
   * @param event `'error'`.
   * @param handler The error handler.
   */
  on(event: 'error', handler: ErrorHandler<this>): void
  /**
   * Register a listener to the online event.
   *
   * @param event `'online'`.
   * @param handler The online handler.
   */
  on(event: 'online', handler: OnlineHandler<this>): void
  /**
   * Register a listener to the exit event.
   *
   * @param event `'exit'`.
   * @param handler The exit handler.
   */
  on(event: 'exit', handler: ExitHandler<this>): void
  /**
   * Register a listener to the exit event that will only performed once.
   *
   * @param event `'exit'`.
   * @param handler The exit handler.
   */
  once(event: 'exit', handler: ExitHandler<this>): void
}

/**
 * Options for a poolifier pool.
 */
export interface PoolOptions<Worker> {
  /**
   * A function that will listen for message event on each worker.
   */
  messageHandler?: MessageHandler<Worker>
  /**
   * A function that will listen for error event on each worker.
   */
  errorHandler?: ErrorHandler<Worker>
  /**
   * A function that will listen for online event on each worker.
   */
  onlineHandler?: OnlineHandler<Worker>
  /**
   * A function that will listen for exit event on each worker.
   */
  exitHandler?: ExitHandler<Worker>
  /**
   * The work choice strategy to use in this pool.
   */
  workerChoiceStrategy?: WorkerChoiceStrategy
  /**
   * Pool events emission.
   *
   * @default true
   */
  enableEvents?: boolean
}

/**
 * Base class containing some shared logic for all poolifier pools.
 *
 * @template Worker Type of worker which manages this pool.
 * @template Data Type of data sent to the worker. This can only be serializable data.
 * @template Response Type of response of execution. This can only be serializable data.
 */
export abstract class AbstractPool<
  Worker extends IWorker,
  Data = unknown,
  Response = unknown
> implements IPoolInternal<Worker, Data, Response> {
  /** @inheritdoc */
  public readonly workers: Worker[] = []

  /** @inheritdoc */
  public readonly workerTasksUsage: Map<Worker, TasksUsage> = new Map<
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
        this.registerWorkerMessageListener(workerCreated, async message => {
          const tasksUsage = this.workerTasksUsage.get(workerCreated)
          if (
            isKillBehavior(KillBehaviors.HARD, message.kill) ||
            tasksUsage?.running === 0
          ) {
            // Kill received from the worker, means that no new tasks are submitted to that worker for a while ( > maxInactiveTime)
            await this.destroyWorker(workerCreated)
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
    return this.promiseMap.size
  }

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
      this.findFreeWorkerTasksUsageMapEntry() === false
    )
  }

  /** @inheritdoc */
  public findFreeWorkerTasksUsageMapEntry (): [Worker, TasksUsage] | false {
    for (const [worker, tasksUsage] of this.workerTasksUsage) {
      if (tasksUsage.running === 0) {
        // A worker is free, return the matching worker tasks usage map entry
        return [worker, tasksUsage]
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
    this.sendToWorker(worker, { data: data || ({} as Data), id: messageId })
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
   * Should return whether the worker is the main worker or not.
   */
  protected abstract isMain (): boolean

  /**
   * Increase the number of tasks that the given worker has applied.
   *
   * @param worker Worker whose tasks are increased.
   */
  protected increaseWorkerRunningTasks (worker: Worker): void {
    this.stepWorkerRunningTasks(worker, 1)
  }

  /**
   * Decrease the number of tasks that the given worker has applied.
   *
   * @param worker Worker whose tasks are decreased.
   */
  protected decreaseWorkerRunningTasks (worker: Worker): void {
    this.stepWorkerRunningTasks(worker, -1)
  }

  /**
   * Step the number of tasks that the given worker has applied.
   *
   * @param worker Worker whose tasks are set.
   * @param step Worker number of tasks step.
   */
  private stepWorkerRunningTasks (worker: Worker, step: number): void {
    const tasksUsage = this.workerTasksUsage.get(worker)
    if (tasksUsage !== undefined) {
      tasksUsage.running = tasksUsage.running + step
      this.workerTasksUsage.set(worker, tasksUsage)
    } else {
      throw Error('Worker could not be found in worker tasks usage map')
    }
  }

  /**
   * Removes the given worker from the pool.
   *
   * @param worker Worker that will be removed.
   */
  protected removeWorker (worker: Worker): void {
    // Clean worker from data structure
    const workerIndex = this.workers.indexOf(worker)
    this.workers.splice(workerIndex, 1)
    this.workerTasksUsage.delete(worker)
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
    this.increaseWorkerRunningTasks(worker)
    return new Promise<Response>((resolve, reject) => {
      this.promiseMap.set(messageId, {
        timestamp: Date.now(),
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
    const worker: Worker = this.createWorker()

    worker.on('message', this.opts.messageHandler ?? EMPTY_FUNCTION)
    worker.on('error', this.opts.errorHandler ?? EMPTY_FUNCTION)
    worker.on('online', this.opts.onlineHandler ?? EMPTY_FUNCTION)
    worker.on('exit', this.opts.exitHandler ?? EMPTY_FUNCTION)
    worker.once('exit', () => this.removeWorker(worker))

    this.workers.push(worker)

    // Init worker tasks usage map
    this.workerTasksUsage.set(worker, {
      run: 0,
      running: 0,
      runTime: 0,
      avgRunTime: 0
    })

    this.afterWorkerSetup(worker)

    return worker
  }

  /**
   * Step the number of tasks that the given worker has run.
   *
   * @param worker Worker whose run tasks has run.
   * @param step Worker number of run tasks step.
   */
  private stepWorkerRunTasks (worker: Worker, step: number) {
    const tasksUsage = this.workerTasksUsage.get(worker)
    if (tasksUsage !== undefined) {
      tasksUsage.run = tasksUsage.run + step
      this.workerTasksUsage.set(worker, tasksUsage)
    } else {
      throw Error('Worker could not be found in worker tasks usage map')
    }
  }

  /**
   * Compute tasks run time that the given worker has run.
   *
   * @param worker Worker which run task.
   * @param taskRunTime Worker task run time.
   */
  private computeWorkerTasksRunTime (worker: Worker, taskRunTime: number) {
    const tasksUsage = this.workerTasksUsage.get(worker)
    if (tasksUsage !== undefined && tasksUsage.run !== 0) {
      tasksUsage.runTime += taskRunTime
      tasksUsage.avgRunTime =
        (tasksUsage.avgRunTime + tasksUsage.runTime) / tasksUsage.run
      this.workerTasksUsage.set(worker, tasksUsage)
    } else {
      throw Error('Worker could not be found in worker tasks usage map')
    }
  }

  /**
   * This function is the listener registered for each worker.
   *
   * @returns The listener function to execute when a message is sent from a worker.
   */
  protected workerListener (): (message: MessageValue<Response>) => void {
    return message => {
      if (message.id) {
        const value = this.promiseMap.get(message.id)
        if (value) {
          this.decreaseWorkerRunningTasks(value.worker)
          this.stepWorkerRunTasks(value.worker, 1)
          const taskRunTime = Date.now() - value.timestamp
          this.computeWorkerTasksRunTime(value.worker, taskRunTime)
          if (message.error) value.reject(message.error)
          else value.resolve(message.data as Response)
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
}
