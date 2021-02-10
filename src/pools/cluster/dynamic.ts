import type { Worker } from 'cluster'
import { EventEmitter } from 'events'
import type { PoolOptions } from '../abstract-pool'
import { FixedClusterPool } from './fixed'

class MyEmitter extends EventEmitter {}

/**
 * A cluster pool with a min/max number of workers, is possible to execute tasks in sync or async mode as you prefer.
 *
 * This cluster pool will create new workers when the other ones are busy, until the max number of workers,
 * when the max number of workers is reached, an event will be emitted, if you want to listen this event use the emitter method.
 *
 * @author [Christopher Quadflieg](https://github.com/Shinigami92)
 * @since 2.0.0
 */
export class DynamicClusterPool<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Data = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Response = any
> extends FixedClusterPool<Data, Response> {
  public readonly emitter: MyEmitter

  /**
   * @param min Min number of workers that will be always active
   * @param max Max number of workers that will be active
   * @param filename A file path with implementation of `ClusterWorker` class, relative path is fine.
   * @param opts An object with possible options for example `errorHandler`, `onlineHandler`. Default: `{ maxTasks: 1000 }`
   */
  public constructor (
    min: number,
    public readonly max: number,
    filename: string,
    opts: PoolOptions<Worker> = { maxTasks: 1000 }
  ) {
    super(min, filename, opts)

    this.emitter = new MyEmitter()
  }

  protected chooseWorker (): Worker {
    let worker: Worker | undefined
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
        return super.chooseWorker()
      }
      // all workers are busy create a new worker
      const worker = this.internalNewWorker()
      worker.on('message', (message: { kill?: number }) => {
        if (message.kill) {
          worker.send({ kill: 1 })
          worker.kill()
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
