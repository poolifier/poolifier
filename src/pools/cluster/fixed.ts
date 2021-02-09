/* eslint-disable @typescript-eslint/strict-boolean-expressions */

import * as cluster from 'cluster'

import { MessageValue } from '../../utility-types'
import { SendHandle } from 'child_process'
import { Worker } from 'cluster'

export type WorkerWithMessageChannel = Worker // & Draft<MessageChannel>

export interface FixedClusterPoolOptions {
  /**
   * A function that will listen for error event on each worker.
   */
  errorHandler?: (this: Worker, e: Error) => void
  /**
   * A function that will listen for online event on each worker.
   */
  onlineHandler?: (this: Worker) => void
  /**
   * A function that will listen for exit event on each worker.
   */
  exitHandler?: (this: Worker, code: number) => void
  /**
   * This is just to avoid not useful warnings message, is used to set `maxListeners` on event emitters (workers are event emitters).
   *
   * @default 1000
   */
  maxTasks?: number
}

/**
 * A cluster pool with a static number of workers, is possible to execute tasks in sync or async mode as you prefer.
 *
 * This pool will select the worker in a round robin fashion.
 *
 * @author [Christopher Quadflieg](https://github.com/Shinigami92)
 * @since 2.0.0
 */
export class FixedClusterPool<Data = any, Response = any> {
  public readonly workers: WorkerWithMessageChannel[] = []
  public nextWorker: number = 0

  // workerId as key and an integer value
  /* eslint-disable @typescript-eslint/indent */
  public readonly tasks: Map<WorkerWithMessageChannel, number> = new Map<
    WorkerWithMessageChannel,
    number
  >()
  /* eslint-enable @typescript-eslint/indent */

  protected id: number = 0

  /**
   * @param numWorkers Number of workers for this pool.
   * @param filePath A file path with implementation of `ClusterWorker` class, relative path is fine.
   * @param opts An object with possible options for example `errorHandler`, `onlineHandler`. Default: `{ maxTasks: 1000 }`
   */
  public constructor (
    public readonly numWorkers: number,
    public readonly filePath: string,
    public readonly opts: FixedClusterPoolOptions = { maxTasks: 1000 }
  ) {
    if (!cluster.isMaster) {
      throw new Error('Cannot start a cluster pool from a worker!')
    }
    // TODO christopher 2021-02-09: Improve this check e.g. with a pattern or blank check
    if (!this.filePath) {
      throw new Error('Please specify a file with a worker implementation')
    }

    cluster.setupMaster({
      exec: this.filePath
    })

    for (let i: number = 1; i <= this.numWorkers; i++) {
      this.newWorker()
    }
  }

  public destroy (): void {
    for (const worker of this.workers) {
      worker.kill()
    }
  }

  /**
   * Execute the task specified into the constructor with the data parameter.
   *
   * @param data The input for the task specified.
   * @returns Promise that is resolved when the task is done.
   */
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  public execute (data: Data): Promise<Response> {
    // configure worker to handle message with the specified task
    const worker: WorkerWithMessageChannel = this.chooseWorker()
    // console.log('FixedClusterPool#execute choosen worker:', worker)
    const previousWorkerIndex = this.tasks.get(worker)
    if (previousWorkerIndex !== undefined) {
      this.tasks.set(worker, previousWorkerIndex + 1)
    } else {
      throw Error('Worker could not be found in tasks map')
    }
    const id: number = ++this.id
    const res: Promise<Response> = this.internalExecute(worker, id)
    // console.log('FixedClusterPool#execute send data to worker:', worker)
    worker.send({ data: data || {}, id: id })
    return res
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  protected internalExecute (
    worker: WorkerWithMessageChannel,
    id: number
  ): Promise<Response> {
    return new Promise((resolve, reject) => {
      const listener: (
        message: MessageValue<Response>,
        handle: SendHandle
      ) => void = message => {
        // console.log('FixedClusterPool#internalExecute listener:', message)
        if (message.id === id) {
          worker.removeListener('message', listener)
          const previousWorkerIndex = this.tasks.get(worker)
          if (previousWorkerIndex !== undefined) {
            this.tasks.set(worker, previousWorkerIndex + 1)
          } else {
            throw Error('Worker could not be found in tasks map')
          }
          if (message.error) reject(message.error)
          else resolve(message.data as any)
        }
      }
      worker.on('message', listener)
    })
  }

  protected chooseWorker (): WorkerWithMessageChannel {
    if (this.workers.length - 1 === this.nextWorker) {
      this.nextWorker = 0
      return this.workers[this.nextWorker]
    } else {
      this.nextWorker++
      return this.workers[this.nextWorker]
    }
  }

  protected newWorker (): WorkerWithMessageChannel {
    const worker: WorkerWithMessageChannel = cluster.fork()
    worker.on('error', this.opts.errorHandler ?? (() => {}))
    worker.on('online', this.opts.onlineHandler ?? (() => {}))
    // TODO handle properly when a worker exit
    worker.on('exit', this.opts.exitHandler ?? (() => {}))
    this.workers.push(worker)
    // const { port1, port2 } = new MessageChannel()
    // worker.send({ parent: port1 }, [port1])
    // worker.port1 = port1
    // worker.port2 = port2
    // we will attach a listener for every task,
    // when task is completed the listener will be removed but to avoid warnings we are increasing the max listeners size
    // worker.port2.setMaxListeners(this.opts.maxTasks ?? 1000)
    worker.setMaxListeners(this.opts.maxTasks ?? 1000)
    // init tasks map
    this.tasks.set(worker, 0)
    return worker
  }
}
