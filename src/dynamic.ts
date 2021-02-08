/* eslint-disable @typescript-eslint/strict-boolean-expressions */

import { Pool, PoolOptions, WorkerWithMessageChannel } from './pool'

import { EventEmitter } from 'events'

class MyEmitter extends EventEmitter {}

export type DynamicThreadPoolOptions = PoolOptions

/**
 * A thread pool with a min/max number of threads, is possible to execute tasks in sync or async mode as you prefer.
 *
 * This thread pool will create new workers when the other ones are busy, until the max number of threads,
 * when the max number of threads is reached, an event will be emitted, if you want to listen this event use the emitter method.
 *
 * @author [Alessandro Pio Ardizio](https://github.com/pioardi)
 * @since 0.0.1
 */
export class DynamicThreadPool<Data = any, Response = any> extends Pool<
Data,
Response
> {
  public readonly emitter: MyEmitter

  /**
   * @param min Min number of threads that will be always active
   * @param max Max number of threads that will be active
   * @param filename A file path with implementation of `ThreadWorker` class, relative path is fine.
   * @param opts An object with possible options for example `errorHandler`, `onlineHandler`. Default: `{ maxTasks: 1000 }`
   */
  public constructor (
    public readonly min: number,
    public readonly max: number,
    public readonly filename: string,
    public readonly opts: DynamicThreadPoolOptions = { maxTasks: 1000 }
  ) {
    super(min, filename, opts)

    this.emitter = new MyEmitter()
  }

  protected _chooseWorker (): WorkerWithMessageChannel {
    let worker: WorkerWithMessageChannel | undefined
    for (const entry of this.tasks) {
      if (entry[1] === 0) {
        worker = entry[0]
        break
      }
    }

    if (worker) {
      // a worker is free, use it
      return worker
    } else {
      if (this.workers.length === this.max) {
        this.emitter.emit('FullPool')
        return super._chooseWorker()
      }
      // all workers are busy create a new worker
      const worker = this._newWorker()
      worker.port2?.on('message', (message: { kill?: number }) => {
        if (message.kill) {
          worker.postMessage({ kill: 1 })
          // eslint-disable-next-line no-void
          void worker.terminate()
          // clean workers from data structures
          const workerIndex = this.workers.indexOf(worker)
          this.workers.splice(workerIndex, 1)
          this.tasks.delete(worker)
        }
      })
      return worker
    }
  }
}
