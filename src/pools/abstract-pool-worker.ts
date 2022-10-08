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
  /** @inheritDoc  */
  abstract on (event: 'message', handler: MessageHandler<this>): void
  /** @inheritDoc  */
  abstract on (event: 'error', handler: ErrorHandler<this>): void
  /** @inheritDoc  */
  abstract on (event: 'online', handler: OnlineHandler<this>): void
  /** @inheritDoc  */
  abstract on (event: 'exit', handler: ExitHandler<this>): void
  /** @inheritDoc  */
  abstract once (event: 'exit', handler: ExitHandler<this>): void
}
