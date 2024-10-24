import cluster, { type Worker } from 'node:cluster'

import type { MessageValue } from '../utility-types.js'
import type { TaskFunction, TaskFunctions } from './task-functions.js'
import type { WorkerOptions } from './worker-options.js'

import { AbstractWorker } from './abstract-worker.js'

/**
 * A cluster worker used by a poolifier `ClusterPool`.
 *
 * When this worker is inactive for more than the given `maxInactiveTime`,
 * it will send a termination request to its main worker.
 *
 * If you use a `DynamicClusterPool` the extra workers that were created will be terminated,
 * but the minimum number of workers will be guaranteed.
 * @typeParam Data - Type of data this worker receives from pool's execution. This can only be structured-cloneable data.
 * @typeParam Response - Type of response the worker sends back to the main worker. This can only be structured-cloneable data.
 * @author [Christopher Quadflieg](https://github.com/Shinigami92)
 * @since 2.0.0
 */
export class ClusterWorker<
  Data = unknown,
  Response = unknown
> extends AbstractWorker<Worker, Data, Response> {
  /** @inheritDoc */
  protected readonly sendToMainWorker = (
    message: MessageValue<Response>
  ): void => {
    this.getMainWorker().send({
      ...message,
      workerId: this.id,
    } satisfies MessageValue<Response>)
  }

  /**
   * Constructs a new poolifier cluster worker.
   * @param taskFunctions - Task function(s) processed by the worker when the pool's `execute` method is invoked.
   * @param opts - Options for the worker.
   */
  public constructor (
    taskFunctions: TaskFunction<Data, Response> | TaskFunctions<Data, Response>,
    opts: WorkerOptions = {}
  ) {
    super(cluster.isPrimary, cluster.worker, taskFunctions, opts)
  }

  /**
   * @inheritDoc
   */
  protected handleError (error: Error): { message: string; stack?: string } {
    return { message: error.message, stack: error.stack }
  }

  /** @inheritDoc */
  protected handleReadyMessage (message: MessageValue<Data>): void {
    if (message.workerId === this.id && message.ready === false) {
      try {
        this.getMainWorker().on('message', this.messageListener.bind(this))
        this.sendToMainWorker({
          ready: true,
          taskFunctionsProperties: this.listTaskFunctionsProperties(),
        })
      } catch {
        this.sendToMainWorker({
          ready: false,
          taskFunctionsProperties: this.listTaskFunctionsProperties(),
        })
      }
    }
  }

  /** @inheritDoc */
  protected get id (): number {
    return this.getMainWorker().id
  }
}
