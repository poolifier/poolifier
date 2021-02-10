import type { Worker } from 'cluster'
import { isMaster, worker } from 'cluster'
import type { MessageValue } from '../utility-types'
import { AbstractWorker } from './abstract-worker'
import type { WorkerOptions } from './worker-options'

/**
 * An example worker that will be always alive, you just need to **extend** this class if you want a static pool.
 *
 * When this worker is inactive for more than 1 minute, it will send this info to the main worker,
 * if you are using DynamicClusterPool, the workers created after will be killed, the min num of worker will be guaranteed.
 *
 * @author [Christopher Quadflieg](https://github.com/Shinigami92)
 * @since 2.0.0
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class ClusterWorker<Data = any, Response = any> extends AbstractWorker<
  Worker,
  Data,
  Response
> {
  public constructor (fn: (data: Data) => Response, opts: WorkerOptions = {}) {
    super('worker-cluster-pool:pioardi', isMaster, fn, opts)

    worker.on('message', (value: MessageValue<Data>) => {
      if (value?.data && value.id) {
        // here you will receive messages
        // console.log('This is the main worker ' + isMain)
        if (this.async) {
          this.runInAsyncScope(this.runAsync.bind(this), this, fn, value)
        } else {
          this.runInAsyncScope(this.run.bind(this), this, fn, value)
        }
      } else if (value.kill) {
        // here is time to kill this worker, just clearing the interval
        if (this.interval) clearInterval(this.interval)
        this.emitDestroy()
      }
    })
  }

  protected getMainWorker (): Worker {
    return worker
  }

  protected sendToMainWorker (message: MessageValue<Response>): void {
    this.getMainWorker().send(message)
  }

  protected handleError (e: Error | string): string {
    return e instanceof Error ? e.message : e
  }
}
