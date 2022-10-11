import type { IPoolInternal } from '../pool-internal'
import { PoolType } from '../pool-internal'
import type { IPoolWorker } from '../pool-worker'
import type {
  IWorkerChoiceStrategy,
  RequiredStatistics
} from './selection-strategies-types'

/**
 * Abstract worker choice strategy class.
 *
 * @template Worker Type of worker which manages the strategy.
 * @template Data Type of data sent to the worker. This can only be serializable data.
 * @template Response Type of response of execution. This can only be serializable data.
 */
export abstract class AbstractWorkerChoiceStrategy<
  Worker extends IPoolWorker,
  Data,
  Response
> implements IWorkerChoiceStrategy<Worker> {
  /** @inheritDoc */
  public readonly isDynamicPool: boolean = this.pool.type === PoolType.DYNAMIC
  /** @inheritDoc */
  public requiredStatistics: RequiredStatistics = {
    runTime: false
  }

  /**
   * Constructs a worker choice strategy attached to the pool.
   *
   * @param pool The pool instance.
   */
  public constructor (
    protected readonly pool: IPoolInternal<Worker, Data, Response>
  ) {}

  /** @inheritDoc */
  public abstract resetStatistics (): boolean

  /** @inheritDoc */
  public abstract choose (): Worker
}
