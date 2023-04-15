import { DEFAULT_WORKER_CHOICE_STRATEGY_OPTIONS } from '../../utils'
import { PoolType, type IPool } from '../pool'
import type { IWorker } from '../worker'
import type {
  IWorkerChoiceStrategy,
  RequiredStatistics,
  WorkerChoiceStrategyOptions
} from './selection-strategies-types'

/**
 * Worker choice strategy abstract base class.
 *
 * @typeParam Worker - Type of worker which manages the strategy.
 * @typeParam Data - Type of data sent to the worker. This can only be serializable data.
 * @typeParam Response - Type of execution response. This can only be serializable data.
 */
export abstract class AbstractWorkerChoiceStrategy<
  Worker extends IWorker,
  Data = unknown,
  Response = unknown
> implements IWorkerChoiceStrategy {
  /** @inheritDoc */
  protected readonly isDynamicPool: boolean
  /** @inheritDoc */
  public readonly requiredStatistics: RequiredStatistics = {
    runTime: false,
    avgRunTime: false,
    medRunTime: false
  }

  /**
   * Constructs a worker choice strategy bound to the pool.
   *
   * @param pool - The pool instance.
   * @param opts - The worker choice strategy options.
   */
  public constructor (
    protected readonly pool: IPool<Worker, Data, Response>,
    protected opts: WorkerChoiceStrategyOptions = DEFAULT_WORKER_CHOICE_STRATEGY_OPTIONS
  ) {
    this.isDynamicPool = this.pool.type === PoolType.DYNAMIC
    this.choose.bind(this)
  }

  protected checkOptions (opts: WorkerChoiceStrategyOptions): void {
    if (this.requiredStatistics.avgRunTime && opts.medRunTime === true) {
      this.requiredStatistics.avgRunTime = false
      this.requiredStatistics.medRunTime = opts.medRunTime as boolean
    }
    if (this.requiredStatistics.medRunTime && opts.medRunTime === false) {
      this.requiredStatistics.avgRunTime = true
      this.requiredStatistics.medRunTime = opts.medRunTime as boolean
    }
  }

  /** @inheritDoc */
  public abstract reset (): boolean

  /** @inheritDoc */
  public abstract choose (): number

  /** @inheritDoc */
  public abstract remove (workerNodeKey: number): boolean

  /** @inheritDoc */
  public setOptions (opts: WorkerChoiceStrategyOptions): void {
    opts = opts ?? DEFAULT_WORKER_CHOICE_STRATEGY_OPTIONS
    this.checkOptions(opts)
    this.opts = opts
  }
}
