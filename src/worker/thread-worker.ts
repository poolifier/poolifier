import {
  type MessagePort,
  isMainThread,
  parentPort,
  threadId
} from 'node:worker_threads'
import type { MessageValue } from '../utility-types.js'
import { AbstractWorker } from './abstract-worker.js'
import type { WorkerOptions } from './worker-options.js'
import type { TaskFunction, TaskFunctions } from './task-functions.js'

/**
 * A thread worker used by a poolifier `ThreadPool`.
 *
 * When this worker is inactive for more than the given `maxInactiveTime`,
 * it will send a termination request to its main thread.
 *
 * If you use a `DynamicThreadPool` the extra workers that were created will be terminated,
 * but the minimum number of workers will be guaranteed.
 *
 * @typeParam Data - Type of data this worker receives from pool's execution. This can only be structured-cloneable data.
 * @typeParam Response - Type of response the worker sends back to the main thread. This can only be structured-cloneable data.
 * @author [Alessandro Pio Ardizio](https://github.com/pioardi)
 * @since 0.0.1
 */
export class ThreadWorker<
  Data = unknown,
  Response = unknown
> extends AbstractWorker<MessagePort, Data, Response> {
  /**
   * Message port used to communicate with the main worker.
   */
  private port?: MessagePort

  /**
   * Constructs a new poolifier thread worker.
   *
   * @param taskFunctions - Task function(s) processed by the worker when the pool's `execution` function is invoked.
   * @param opts - Options for the worker.
   */
  public constructor (
    taskFunctions: TaskFunction<Data, Response> | TaskFunctions<Data, Response>,
    opts: WorkerOptions = {}
  ) {
    super(isMainThread, parentPort as MessagePort, taskFunctions, opts)
  }

  /** @inheritDoc */
  protected handleReadyMessage (message: MessageValue<Data>): void {
    if (
      message.workerId === this.id &&
      message.ready === false &&
      message.port != null
    ) {
      try {
        this.port = message.port
        this.port.on('message', this.messageListener.bind(this))
        this.sendToMainWorker({
          ready: true,
          taskFunctionNames: this.listTaskFunctionNames()
        })
      } catch {
        this.sendToMainWorker({
          ready: false,
          taskFunctionNames: this.listTaskFunctionNames()
        })
      }
    }
  }

  /** @inheritDoc */
  protected handleKillMessage (message: MessageValue<Data>): void {
    super.handleKillMessage(message)
    this.port?.unref()
    this.port?.close()
  }

  /** @inheritDoc */
  protected get id (): number {
    return threadId
  }

  /** @inheritDoc */
  protected readonly sendToMainWorker = (
    message: MessageValue<Response>
  ): void => {
    this.port?.postMessage({ ...message, workerId: this.id })
  }

  /**
   * @inheritDoc
   * @override
   */
  protected handleError (error: Error | string): string {
    return error as string
  }
}
