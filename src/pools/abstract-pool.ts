import type { MessageValue } from '../utility-types'
import type { IPoolInternal } from './pool-internal'
import { PoolEmitter } from './pool-internal'
import type { WorkerChoiceStrategy } from './selection-strategies'
import {
  WorkerChoiceStrategies,
  WorkerChoiceStrategyContext
} from './selection-strategies'

/**
 * An intentional empty function.
 */
const EMPTY_FUNCTION: () => void = () => {
  /* Intentionally empty */
}

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
   * This is just to avoid non-useful warning messages.
   *
   * Will be used to set `maxListeners` on event emitters (workers are event emitters).
   *
   * @default 1000
   * @see [Node events emitter.setMaxListeners(n)](https://nodejs.org/api/events.html#events_emitter_setmaxlisteners_n)
   */
  maxTasks?: number
  /**
   * The work choice strategy to use in this pool.
   */
  workerChoiceStrategy?: WorkerChoiceStrategy
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
  public readonly tasks: Map<Worker, number> = new Map<Worker, number>()

  /** @inheritdoc */
  public readonly emitter: PoolEmitter

  /**
   * ID of the next message.
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
   * @param opts Options for the pool. Default: `{ maxTasks: 1000 }`
   */
  public constructor (
    public readonly numberOfWorkers: number,
    public readonly filePath: string,
    public readonly opts: PoolOptions<Worker> = { maxTasks: 1000 }
  ) {
    if (!this.isMain()) {
      throw new Error('Cannot start a pool from a worker!')
    }
    this.checkFilePath(this.filePath)
    this.setupHook()

    for (let i = 1; i <= this.numberOfWorkers; i++) {
      this.createAndSetupWorker()
    }

    this.emitter = new PoolEmitter()
    this.workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
      this,
      opts.workerChoiceStrategy ?? WorkerChoiceStrategies.ROUND_ROBIN
    )
  }

  private checkFilePath (filePath: string): void {
    if (!filePath) {
      throw new Error('Please specify a file with a worker implementation')
    }
  }

  /** @inheritdoc */
  public isDynamic (): boolean {
    return false
  }

  /** @inheritdoc */
  public setWorkerChoiceStrategy (
    workerChoiceStrategy: WorkerChoiceStrategy
  ): void {
    this.workerChoiceStrategyContext.setWorkerChoiceStrategy(
      workerChoiceStrategy
    )
  }

  /** @inheritdoc */
  public execute (data: Data): Promise<Response> {
    // Configure worker to handle message with the specified task
    const worker = this.chooseWorker()
    this.increaseWorkersTask(worker)
    const messageId = ++this.nextMessageId
    const res = this.internalExecute(worker, messageId)
    this.sendToWorker(worker, { data: data || ({} as Data), id: messageId })
    return res
  }

  /** @inheritdoc */
  public async destroy (): Promise<void> {
    await Promise.all(this.workers.map(worker => this.destroyWorker(worker)))
  }

  /** @inheritdoc */
  public abstract destroyWorker (worker: Worker): void | Promise<void>

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
   * Increase the number of tasks that the given workers has done.
   *
   * @param worker Worker whose tasks are increased.
   */
  protected increaseWorkersTask (worker: Worker): void {
    this.stepWorkerNumberOfTasks(worker, 1)
  }

  /**
   * Decrease the number of tasks that the given workers has done.
   *
   * @param worker Worker whose tasks are decreased.
   */
  protected decreaseWorkersTasks (worker: Worker): void {
    this.stepWorkerNumberOfTasks(worker, -1)
  }

  /**
   * Step the number of tasks that the given workers has done.
   *
   * @param worker Worker whose tasks are set.
   * @param step Worker number of tasks step.
   */
  private stepWorkerNumberOfTasks (worker: Worker, step: number): void {
    const numberOfTasksInProgress = this.tasks.get(worker)
    if (numberOfTasksInProgress !== undefined) {
      this.tasks.set(worker, numberOfTasksInProgress + step)
    } else {
      throw Error('Worker could not be found in tasks map')
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
    this.tasks.delete(worker)
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

  /** @inheritdoc */
  public abstract registerWorkerMessageListener<
    Message extends Data | Response
  > (worker: Worker, listener: (message: MessageValue<Message>) => void): void

  protected abstract unregisterWorkerMessageListener<
    Message extends Data | Response
  > (worker: Worker, listener: (message: MessageValue<Message>) => void): void

  protected internalExecute (
    worker: Worker,
    messageId: number
  ): Promise<Response> {
    return new Promise((resolve, reject) => {
      const listener: (message: MessageValue<Response>) => void = message => {
        if (message.id === messageId) {
          this.unregisterWorkerMessageListener(worker, listener)
          this.decreaseWorkersTasks(worker)
          if (message.error) reject(message.error)
          else resolve(message.data as Response)
        }
      }
      this.registerWorkerMessageListener(worker, listener)
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

  /** @inheritdoc */
  public createAndSetupWorker (): Worker {
    const worker: Worker = this.createWorker()

    worker.on('error', this.opts.errorHandler ?? EMPTY_FUNCTION)
    worker.on('online', this.opts.onlineHandler ?? EMPTY_FUNCTION)
    worker.on('exit', this.opts.exitHandler ?? EMPTY_FUNCTION)
    worker.once('exit', () => this.removeWorker(worker))

    this.workers.push(worker)

    // Init tasks map
    this.tasks.set(worker, 0)

    this.afterWorkerSetup(worker)

    return worker
  }
}
