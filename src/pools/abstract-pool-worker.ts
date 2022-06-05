import cluster from 'cluster'
import { threadId } from 'worker_threads'
import type {
  ErrorHandler,
  ExitHandler,
  IPoolWorker,
  MessageHandler,
  OnlineHandler
} from './pool-worker'

/**
 * Basic class that implement the minimum required for a pool worker.
 */
export abstract class AbstractPoolWorker implements IPoolWorker {
  /** @inheritdoc  */
  public readonly id?: number
  /** @inheritdoc  */
  constructor () {
    Object.defineProperty(this, 'id', {
      /** @inheritdoc  */
      get (): number {
        return threadId ?? cluster.worker?.id
      }
    })
  }

  /** @inheritdoc  */
  abstract on (event: 'message', handler: MessageHandler<this>): void
  /** @inheritdoc  */
  abstract on (event: 'error', handler: ErrorHandler<this>): void
  /** @inheritdoc  */
  abstract on (event: 'online', handler: OnlineHandler<this>): void
  /** @inheritdoc  */
  abstract on (event: 'exit', handler: ExitHandler<this>): void
  /** @inheritdoc  */
  abstract once (event: 'exit', handler: ExitHandler<this>): void
}
