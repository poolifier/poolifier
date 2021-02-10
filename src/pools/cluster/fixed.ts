import type { SendHandle } from 'child_process'
import { fork, isMaster, setupMaster, Worker } from 'cluster'
import type { MessageValue } from '../../utility-types'
import type { PoolOptions } from '../abstract-pool'
import { AbstractPool } from '../abstract-pool'

/**
 * A cluster pool with a static number of workers, is possible to execute tasks in sync or async mode as you prefer.
 *
 * This pool will select the worker in a round robin fashion.
 *
 * @author [Christopher Quadflieg](https://github.com/Shinigami92)
 * @since 2.0.0
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class FixedClusterPool<Data = any, Response = any> extends AbstractPool<
  Worker,
  Data,
  Response
> {
  /**
   * @param numWorkers Number of workers for this pool.
   * @param filePath A file path with implementation of `ClusterWorker` class, relative path is fine.
   * @param opts An object with possible options for example `errorHandler`, `onlineHandler`. Default: `{ maxTasks: 1000 }`
   */
  public constructor (
    numWorkers: number,
    filePath: string,
    opts: PoolOptions<Worker> = { maxTasks: 1000 }
  ) {
    super(numWorkers, filePath, opts)
  }

  protected setupHook (): void {
    setupMaster({
      exec: this.filePath
    })
  }

  protected isMain (): boolean {
    return isMaster
  }

  protected destroyWorker (worker: Worker): void {
    worker.kill()
  }

  /**
   * Execute the task specified into the constructor with the data parameter.
   *
   * @param data The input for the task specified.
   * @returns Promise that is resolved when the task is done.
   */
  public execute (data: Data): Promise<Response> {
    // configure worker to handle message with the specified task
    const worker = this.chooseWorker()
    // console.log('FixedClusterPool#execute choosen worker:', worker)
    const previousWorkerIndex = this.tasks.get(worker)
    if (previousWorkerIndex !== undefined) {
      this.tasks.set(worker, previousWorkerIndex + 1)
    } else {
      throw Error('Worker could not be found in tasks map')
    }
    const id = ++this.id
    const res = this.internalExecute(worker, id)
    // console.log('FixedClusterPool#execute send data to worker:', worker)
    worker.send({ data: data || {}, id: id })
    return res
  }

  protected internalExecute (worker: Worker, id: number): Promise<Response> {
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
          else resolve(message.data as Response)
        }
      }
      worker.on('message', listener)
    })
  }

  protected newWorker (): Worker {
    const worker: Worker = fork()
    worker.on('error', this.opts.errorHandler ?? (() => {}))
    worker.on('online', this.opts.onlineHandler ?? (() => {}))
    // TODO handle properly when a worker exit
    worker.on('exit', this.opts.exitHandler ?? (() => {}))
    this.workers.push(worker)
    // we will attach a listener for every task,
    // when task is completed the listener will be removed but to avoid warnings we are increasing the max listeners size
    worker.setMaxListeners(this.opts.maxTasks ?? 1000)
    // init tasks map
    this.tasks.set(worker, 0)
    return worker
  }
}
