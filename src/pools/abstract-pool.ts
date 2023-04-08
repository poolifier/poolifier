import crypto from 'node:crypto'
import type { MessageValue, PromiseResponseWrapper } from '../utility-types'
import { EMPTY_FUNCTION, median } from '../utils'
import { KillBehaviors, isKillBehavior } from '../worker/worker-options'
import { PoolEvents, type PoolOptions } from './pool'
import { PoolEmitter } from './pool'
import type { IPoolInternal } from './pool-internal'
import { PoolType } from './pool-internal'
import type { IWorker, Task, TasksUsage, WorkerNode } from './worker'
import {
  WorkerChoiceStrategies,
  type WorkerChoiceStrategy
} from './selection-strategies/selection-strategies-types'
import { WorkerChoiceStrategyContext } from './selection-strategies/worker-choice-strategy-context'
import { CircularArray } from '../circular-array'

/**
 * Base class that implements some shared logic for all poolifier pools.
 *
 * @typeParam Worker - Type of worker which manages this pool.
 * @typeParam Data - Type of data sent to the worker. This can only be serializable data.
 * @typeParam Response - Type of response of execution. This can only be serializable data.
 */
export abstract class AbstractPool<
  Worker extends IWorker,
  Data = unknown,
  Response = unknown
> implements IPoolInternal<Worker, Data, Response> {
  /** @inheritDoc */
  public readonly workerNodes: Array<WorkerNode<Worker, Data>> = []

  /** @inheritDoc */
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
   * Worker choice strategy context referencing a worker choice algorithm implementation.
   *
   * Default to a round robin algorithm.
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
    >(this, this.opts.workerChoiceStrategy)
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
    this.checkValidWorkerChoiceStrategy(this.opts.workerChoiceStrategy)
    this.opts.enableEvents = opts.enableEvents ?? true
  }

  private checkValidWorkerChoiceStrategy (
    workerChoiceStrategy: WorkerChoiceStrategy
  ): void {
    if (!Object.values(WorkerChoiceStrategies).includes(workerChoiceStrategy)) {
      throw new Error(
        `Invalid worker choice strategy '${workerChoiceStrategy}'`
      )
    }
  }

  /** @inheritDoc */
  public abstract get type (): PoolType

  /**
   * Number of tasks concurrently running in the pool.
   */
  private get numberOfRunningTasks (): number {
    return this.promiseResponseMap.size
  }

  /**
   * Gets the given worker its worker node key.
   *
   * @param worker - The worker.
   * @returns The worker node key if the worker is found in the pool worker nodes, `-1` otherwise.
   */
  private getWorkerNodeKey (worker: Worker): number {
    return this.workerNodes.findIndex(
      workerNode => workerNode.worker === worker
    )
  }

  /** @inheritDoc */
  public setWorkerChoiceStrategy (
    workerChoiceStrategy: WorkerChoiceStrategy
  ): void {
    this.checkValidWorkerChoiceStrategy(workerChoiceStrategy)
    this.opts.workerChoiceStrategy = workerChoiceStrategy
    for (const [index, workerNode] of this.workerNodes.entries()) {
      this.setWorkerNode(
        index,
        workerNode.worker,
        {
          run: 0,
          running: 0,
          runTime: 0,
          runTimeHistory: new CircularArray(),
          avgRunTime: 0,
          medRunTime: 0,
          error: 0
        },
        workerNode.tasksQueue
      )
    }
    this.workerChoiceStrategyContext.setWorkerChoiceStrategy(
      workerChoiceStrategy
    )
  }

  /** @inheritDoc */
  public abstract get full (): boolean

  /** @inheritDoc */
  public abstract get busy (): boolean

  protected internalBusy (): boolean {
    return (
      this.numberOfRunningTasks >= this.numberOfWorkers &&
      this.findFreeWorkerNodeKey() === -1
    )
  }

  /** @inheritDoc */
  public findFreeWorkerNodeKey (): number {
    return this.workerNodes.findIndex(workerNode => {
      return workerNode.tasksUsage?.running === 0
    })
  }

  /** @inheritDoc */
  public async execute (data: Data): Promise<Response> {
    const [workerNodeKey, worker] = this.chooseWorker()
    const messageId = crypto.randomUUID()
    const res = this.internalExecute(workerNodeKey, worker, messageId)
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

  /** @inheritDoc */
  public async destroy (): Promise<void> {
    await Promise.all(
      this.workerNodes.map(async workerNode => {
        await this.destroyWorker(workerNode.worker)
      })
    )
  }

  /**
   * Shutdowns the given worker.
   *
   * @param worker - A worker within `workerNodes`.
   */
  protected abstract destroyWorker (worker: Worker): void | Promise<void>

  /**
   * Setup hook to run code before worker node are created in the abstract constructor.
   * Can be overridden
   *
   * @virtual
   */
  protected setupHook (): void {
    // Intentionally empty
  }

  /**
   * Should return whether the worker is the main worker or not.
   */
  protected abstract isMain (): boolean

  /**
   * Hook executed before the worker task promise resolution.
   * Can be overridden.
   *
   * @param workerNodeKey - The worker node key.
   */
  protected beforePromiseResponseHook (workerNodeKey: number): void {
    ++this.workerNodes[workerNodeKey].tasksUsage.running
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
      workerTasksUsage.runTime += message.runTime ?? 0
      if (
        this.workerChoiceStrategyContext.getRequiredStatistics().avgRunTime &&
        workerTasksUsage.run !== 0
      ) {
        workerTasksUsage.avgRunTime =
          workerTasksUsage.runTime / workerTasksUsage.run
      }
      if (this.workerChoiceStrategyContext.getRequiredStatistics().medRunTime) {
        workerTasksUsage.runTimeHistory.push(message.runTime ?? 0)
        workerTasksUsage.medRunTime = median(workerTasksUsage.runTimeHistory)
      }
    }
  }

  /**
   * Chooses a worker node for the next task.
   *
   * The default uses a round robin algorithm to distribute the load.
   *
   * @returns [worker node key, worker].
   */
  protected chooseWorker (): [number, Worker] {
    let workerNodeKey: number
    if (
      this.type === PoolType.DYNAMIC &&
      !this.full &&
      this.findFreeWorkerNodeKey() === -1
    ) {
      const createdWorker = this.createAndSetupWorker()
      this.registerWorkerMessageListener(createdWorker, message => {
        if (
          isKillBehavior(KillBehaviors.HARD, message.kill) ||
          (message.kill != null &&
            this.getWorkerTasksUsage(createdWorker)?.running === 0)
        ) {
          // Kill message received from the worker, means that no new tasks are submitted to that worker for a while ( > maxInactiveTime)
          void this.destroyWorker(createdWorker)
        }
      })
      workerNodeKey = this.getWorkerNodeKey(createdWorker)
    } else {
      workerNodeKey = this.workerChoiceStrategyContext.execute()
    }
    return [workerNodeKey, this.workerNodes[workerNodeKey].worker]
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
   * Registers a listener callback on the given worker.
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
   * Function that can be hooked up when a worker has been newly created and moved to the pool worker nodes.
   *
   * Can be used to update the `maxListeners` or binding the `main-worker`\<-\>`worker` connection if not bind by default.
   *
   * @param worker - The newly created worker.
   */
  protected abstract afterWorkerSetup (worker: Worker): void

  /**
   * Creates a new worker and sets it up completely in the pool worker nodes.
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
      this.removeWorkerNode(worker)
    })

    this.pushWorkerNode(worker)

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
      if (message.id != null) {
        // Task response received
        const promiseResponse = this.promiseResponseMap.get(message.id)
        if (promiseResponse != null) {
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
    workerNodeKey: number,
    worker: Worker,
    messageId: string
  ): Promise<Response> {
    this.beforePromiseResponseHook(workerNodeKey)
    return await new Promise<Response>((resolve, reject) => {
      this.promiseResponseMap.set(messageId, { resolve, reject, worker })
    })
  }

  private checkAndEmitBusy (): void {
    if (this.opts.enableEvents === true && this.busy) {
      this.emitter?.emit(PoolEvents.busy)
    }
  }

  private checkAndEmitFull (): void {
    if (
      this.type === PoolType.DYNAMIC &&
      this.opts.enableEvents === true &&
      this.full
    ) {
      this.emitter?.emit(PoolEvents.full)
    }
  }

  /**
   * Gets the given worker its tasks usage in the pool.
   *
   * @param worker - The worker.
   * @returns The worker tasks usage.
   */
  private getWorkerTasksUsage (worker: Worker): TasksUsage | undefined {
    const workerNodeKey = this.getWorkerNodeKey(worker)
    if (workerNodeKey !== -1) {
      return this.workerNodes[workerNodeKey].tasksUsage
    }
    throw new Error('Worker could not be found in the pool worker nodes')
  }

  /**
   * Pushes the given worker in the pool worker nodes.
   *
   * @param worker - The worker.
   * @returns The worker nodes length.
   */
  private pushWorkerNode (worker: Worker): number {
    return this.workerNodes.push({
      worker,
      tasksUsage: {
        run: 0,
        running: 0,
        runTime: 0,
        runTimeHistory: new CircularArray(),
        avgRunTime: 0,
        medRunTime: 0,
        error: 0
      },
      tasksQueue: []
    })
  }

  /**
   * Sets the given worker in the pool worker nodes.
   *
   * @param workerNodeKey - The worker node key.
   * @param worker - The worker.
   * @param tasksUsage - The worker tasks usage.
   * @param tasksQueue - The worker task queue.
   */
  private setWorkerNode (
    workerNodeKey: number,
    worker: Worker,
    tasksUsage: TasksUsage,
    tasksQueue: Array<Task<Data>>
  ): void {
    this.workerNodes[workerNodeKey] = {
      worker,
      tasksUsage,
      tasksQueue
    }
  }

  /**
   * Removes the given worker from the pool worker nodes.
   *
   * @param worker - The worker.
   */
  protected removeWorkerNode (worker: Worker): void {
    const workerNodeKey = this.getWorkerNodeKey(worker)
    this.workerNodes.splice(workerNodeKey, 1)
    this.workerChoiceStrategyContext.remove(workerNodeKey)
  }
}
