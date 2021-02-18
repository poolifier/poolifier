import EventEmitter from 'events'
import type { MessageValue } from '../utility-types'
import type { IPool } from './pool'

/**
 * An intentional empty function.
 */
function emptyFunction () {
  // intentionally left blank
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
}

/**
 * Internal poolifier pool emitter.
 */
class PoolEmitter extends EventEmitter {}

/**
 * Base class containing some shared logic for all poolifier pools.
 *
 * @template Worker Type of worker which manages this pool.
 * @template Data Type of data sent to the worker.
 * @template Response Type of response of execution.
 */
export abstract class AbstractPool<
  Worker extends IWorker,
  Data = unknown,
  Response = unknown
> implements IPool<Data, Response> {
  /**
   * List of currently available workers.
   */
  public readonly workers: Worker[] = []

  /**
   * Index for the next worker.
   */
  public nextWorkerIndex: number = 0

  /**
   * The tasks map.
   *
   * - `key`: The `Worker`
   * - `value`: Number of tasks currently in progress on the worker.
   */
  public readonly tasks: Map<Worker, number> = new Map<Worker, number>()

  /**
   * Emitter on which events can be listened to.
   *
   * Events that can currently be listened to:
   *
   * - `'FullPool'`
   */
  public readonly emitter: PoolEmitter

  /**
   * ID of the next message.
   */
  protected nextMessageId: number = 0

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
  }

  private checkFilePath (filePath: string) {
    if (!filePath) {
      throw new Error('Please specify a file with a worker implementation')
    }
  }

  /**
   * Perform the task specified in the constructor with the data parameter.
   *
   * @param data The input for the specified task.
   * @returns Promise that will be resolved when the task is successfully completed.
   */
  public execute (data: Data): Promise<Response> {
    // Configure worker to handle message with the specified task
    const worker = this.chooseWorker()
    this.increaseWorkersTask(worker)
    const messageId = ++this.nextMessageId
    const res = this.internalExecute(worker, messageId)
    this.sendToWorker(worker, { data: data || ({} as Data), id: messageId })
    return res
  }

  /**
   * Shut down every current worker in this pool.
   */
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
  private stepWorkerNumberOfTasks (worker: Worker, step: number) {
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
    const chosenWorker = this.workers[this.nextWorkerIndex]
    this.nextWorkerIndex =
      this.workers.length - 1 === this.nextWorkerIndex
        ? 0
        : this.nextWorkerIndex + 1
    return chosenWorker
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

  protected abstract registerWorkerMessageListener<
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

  /**
   * Creates a new worker for this pool and sets it up completely.
   *
   * @returns New, completely set up worker.
   */
  protected createAndSetupWorker (): Worker {
    const worker: Worker = this.createWorker()

    worker.on('error', this.opts.errorHandler ?? emptyFunction)
    worker.on('online', this.opts.onlineHandler ?? emptyFunction)
    worker.on('exit', this.opts.exitHandler ?? emptyFunction)
    worker.once('exit', () => this.removeWorker(worker))

    this.workers.push(worker)

    // Init tasks map
    this.tasks.set(worker, 0)

    this.afterWorkerSetup(worker)

    return worker
  }
}
