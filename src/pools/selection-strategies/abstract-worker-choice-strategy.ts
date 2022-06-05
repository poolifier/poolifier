import type { AbstractPoolWorker } from '../abstract-pool-worker'
import type { IPoolInternal } from '../pool-internal'
import { PoolType } from '../pool-internal'
import type { IWorkerChoiceStrategy } from './selection-strategies-types'

/**
 * Abstract worker choice strategy class.
 *
 * @template Worker Type of worker which manages the strategy.
 * @template Data Type of data sent to the worker. This can only be serializable data.
 * @template Response Type of response of execution. This can only be serializable data.
 */
export abstract class AbstractWorkerChoiceStrategy<
  Worker extends AbstractPoolWorker,
  Data,
  Response
> implements IWorkerChoiceStrategy<Worker> {
  /** @inheritdoc */
  public isDynamicPool: boolean = this.pool.type === PoolType.DYNAMIC

  /**
   * Constructs a worker choice strategy attached to the pool.
   *
   * @param pool The pool instance.
   */
  public constructor (
    protected readonly pool: IPoolInternal<Worker, Data, Response>
  ) {}

  /** @inheritdoc */
  public abstract choose (): Worker
}
