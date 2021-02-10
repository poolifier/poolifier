import EventEmitter from 'events'
import type { MessageValue } from '../utility-types'

export type ErrorHandler<Worker> = (this: Worker, e: Error) => void
export type OnlineHandler<Worker> = (this: Worker) => void
export type ExitHandler<Worker> = (this: Worker, code: number) => void

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
   * This is just to avoid not useful warnings message, is used to set `maxListeners` on event emitters (workers are event emitters).
   *
   * @default 1000
   */
  maxTasks?: number
}

interface IWorker {
  on(event: 'error', handler: ErrorHandler<this>): void
  on(event: 'online', handler: OnlineHandler<this>): void
  on(event: 'exit', handler: ExitHandler<this>): void
}

class PoolEmitter extends EventEmitter {}

export abstract class AbstractPool<
  Worker extends IWorker,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Data = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Response = any
> {
  public readonly workers: Worker[] = []
  public nextWorker: number = 0

  /**
   * `workerId` as key and an integer value
   */
  public readonly tasks: Map<Worker, number> = new Map<Worker, number>()

  public readonly emitter: PoolEmitter

  protected id: number = 0

  public constructor (
    public readonly numWorkers: number,
    public readonly filePath: string,
    public readonly opts: PoolOptions<Worker> = { maxTasks: 1000 }
  ) {
    if (!this.isMain()) {
      throw new Error('Cannot start a pool from a worker!')
    }
    // TODO christopher 2021-02-07: Improve this check e.g. with a pattern or blank check
    if (!this.filePath) {
      throw new Error('Please specify a file with a worker implementation')
    }

    this.setupHook()

    for (let i = 1; i <= this.numWorkers; i++) {
      this.internalNewWorker()
    }

    this.emitter = new PoolEmitter()
  }

  protected setupHook (): void {
    // Can be overridden
  }

  protected abstract isMain (): boolean

  public async destroy (): Promise<void> {
    for (const worker of this.workers) {
      await this.destroyWorker(worker)
    }
  }

  protected abstract destroyWorker (worker: Worker): void | Promise<void>

  protected abstract sendToWorker (
    worker: Worker,
    message: MessageValue<Data>
  ): void

  /**
   * Execute the task specified into the constructor with the data parameter.
   *
   * @param data The input for the task specified.
   * @returns Promise that is resolved when the task is done.
   */
  public execute (data: Data): Promise<Response> {
    // configure worker to handle message with the specified task
    const worker = this.chooseWorker()
    const previousWorkerIndex = this.tasks.get(worker)
    if (previousWorkerIndex !== undefined) {
      this.tasks.set(worker, previousWorkerIndex + 1)
    } else {
      throw Error('Worker could not be found in tasks map')
    }
    const id = ++this.id
    const res = this.internalExecute(worker, id)
    this.sendToWorker(worker, { data: data || ({} as Data), id: id })
    return res
  }

  protected abstract registerWorkerMessageListener (
    port: Worker,
    listener: (message: MessageValue<Response>) => void
  ): void

  protected abstract unregisterWorkerMessageListener (
    port: Worker,
    listener: (message: MessageValue<Response>) => void
  ): void

  protected internalExecute (worker: Worker, id: number): Promise<Response> {
    return new Promise((resolve, reject) => {
      const listener: (message: MessageValue<Response>) => void = message => {
        if (message.id === id) {
          this.unregisterWorkerMessageListener(worker, listener)
          const previousWorkerIndex = this.tasks.get(worker)
          if (previousWorkerIndex !== undefined) {
            this.tasks.set(worker, previousWorkerIndex + 1)
          } else {
            throw Error('Worker could not be found in tasks map')
          }
          if (message.error) reject(message.error)
          else resolve(message.data as Response)
        }
      }
      this.registerWorkerMessageListener(worker, listener)
    })
  }

  protected chooseWorker (): Worker {
    if (this.workers.length - 1 === this.nextWorker) {
      this.nextWorker = 0
      return this.workers[this.nextWorker]
    } else {
      this.nextWorker++
      return this.workers[this.nextWorker]
    }
  }

  protected abstract newWorker (): Worker

  protected abstract afterNewWorkerPushed (worker: Worker): void

  protected internalNewWorker (): Worker {
    const worker: Worker = this.newWorker()
    worker.on('error', this.opts.errorHandler ?? (() => {}))
    worker.on('online', this.opts.onlineHandler ?? (() => {}))
    // TODO handle properly when a worker exit
    worker.on('exit', this.opts.exitHandler ?? (() => {}))
    this.workers.push(worker)
    this.afterNewWorkerPushed(worker)
    // init tasks map
    this.tasks.set(worker, 0)
    return worker
  }
}
