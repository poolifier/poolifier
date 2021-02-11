import type { MessageValue } from '../../utility-types'
import type { PoolOptions } from '../abstract-pool'
import type { ThreadWorkerWithMessageChannel } from './fixed'
import { FixedThreadPool } from './fixed'

/**
 * A thread pool with a min/max number of threads, is possible to execute tasks in sync or async mode as you prefer.
 *
 * This thread pool will create new workers when the other ones are busy, until the max number of threads,
 * when the max number of threads is reached, an event will be emitted, if you want to listen this event use the emitter method.
 *
 * @author [Alessandro Pio Ardizio](https://github.com/pioardi)
 * @since 0.0.1
 */
export class DynamicThreadPool<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Data = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Response = any
> extends FixedThreadPool<Data, Response> {
  /**
   * @param min Min number of threads that will be always active
   * @param max Max number of threads that will be active
   * @param filename A file path with implementation of `ThreadWorker` class, relative path is fine.
   * @param opts An object with possible options for example `errorHandler`, `onlineHandler`. Default: `{ maxTasks: 1000 }`
   */
  public constructor (
    min: number,
    public readonly max: number,
    filename: string,
    opts: PoolOptions<ThreadWorkerWithMessageChannel> = { maxTasks: 1000 }
  ) {
    super(min, filename, opts)
  }

  protected chooseWorker (): ThreadWorkerWithMessageChannel {
    let worker: ThreadWorkerWithMessageChannel | undefined
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
      worker.port2?.on('message', (message: MessageValue<Data>) => {
        if (message.kill) {
          this.sendToWorker(worker, { kill: 1 })
          void this.destroyWorker(worker)
        }
      })
      return worker
    }
  }
}
