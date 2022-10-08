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
