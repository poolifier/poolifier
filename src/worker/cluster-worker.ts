import type { Worker } from 'cluster'
import { isMaster, worker } from 'cluster'
import type { MessageValue } from '../utility-types'
import { AbstractWorker } from './abstract-worker'
import type { WorkerOptions } from './worker-options'

/**
 * A cluster worker used by a poolifier `ClusterPool`.
 *
 * When this worker is inactive for more than the given `maxInactiveTime`,
 * it will send a termination request to its main worker.
 *
 * If you use a `DynamicClusterPool` the extra workers that were created will be terminated,
 * but the minimum number of workers will be guaranteed.
 *
 * @template Data Type of data this worker receives from pool's execution. This can only be serializable data.
 * @template Response Type of response the worker sends back to the main worker. This can only be serializable data.
 *
 * @author [Christopher Quadflieg](https://github.com/Shinigami92)
 * @since 2.0.0
 */
export class ClusterWorker<
  Data = unknown,
  Response = unknown
> extends AbstractWorker<Worker, Data, Response> {
  /**
   * Constructs a new poolifier cluster worker.
   *
   * @param fn Function processed by the worker when the pool's `execution` function is invoked.
   * @param opts Options for the worker.
   */
  public constructor (fn: (data: Data) => Response, opts: WorkerOptions = {}) {
    super('worker-cluster-pool:pioardi', isMaster, fn, worker, opts)
  }

  /** @inheritdoc */
  protected sendToMainWorker (message: MessageValue<Response>): void {
    this.getMainWorker().send(message)
  }

  /** @inheritdoc */
  protected handleError (e: Error | string): string {
    return e instanceof Error ? e.message : e
  }
}
