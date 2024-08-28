import { PoolEvents, type PoolType, PoolTypes } from '../pool.js'
import { checkDynamicPoolSize } from '../utils.js'
import { type ClusterPoolOptions, FixedClusterPool } from './fixed.js'

/**
 * A cluster pool with a dynamic number of workers, but a guaranteed minimum number of workers.
 *
 * This cluster pool creates new workers when the others are busy, up to the maximum number of workers.
 * When the maximum number of workers is reached and workers are busy, an event is emitted. If you want to listen to this event, use the pool's `emitter`.
 * @typeParam Data - Type of data sent to the worker. This can only be structured-cloneable data.
 * @typeParam Response - Type of execution response. This can only be structured-cloneable data.
 * @author [Christopher Quadflieg](https://github.com/Shinigami92)
 * @since 2.0.0
 */
export class DynamicClusterPool<
  Data = unknown,
  Response = unknown
> extends FixedClusterPool<Data, Response> {
  /**
   * Whether the pool full event has been emitted or not.
   */
  private fullEventEmitted: boolean

  /**
   * Constructs a new poolifier dynamic cluster pool.
   * @param min - Minimum number of workers which are always active.
   * @param max - Maximum number of workers that can be created by this pool.
   * @param filePath - Path to an implementation of a `ClusterWorker` file, which can be relative or absolute.
   * @param opts - Options for this dynamic cluster pool.
   */
  public constructor (
    min: number,
    max: number,
    filePath: string,
    opts: ClusterPoolOptions = {}
  ) {
    super(min, filePath, opts, max)
    checkDynamicPoolSize(
      this.minimumNumberOfWorkers,
      this.maximumNumberOfWorkers
    )
    this.fullEventEmitted = false
  }

  /** @inheritDoc */
  protected checkAndEmitDynamicWorkerCreationEvents (): void {
    if (this.emitter != null && !this.fullEventEmitted && this.full) {
      this.emitter.emit(PoolEvents.full, this.info)
      this.fullEventEmitted = true
    }
  }

  /** @inheritDoc */
  protected checkAndEmitDynamicWorkerDestructionEvents (): void {
    if (this.emitter != null) {
      if (this.fullEventEmitted && !this.full) {
        this.emitter.emit(PoolEvents.fullEnd, this.info)
        this.fullEventEmitted = false
      }
      if (this.empty) {
        this.emitter.emit(PoolEvents.empty, this.info)
      }
    }
  }

  /** @inheritDoc */
  protected shallCreateDynamicWorker (): boolean {
    return (!this.full && this.internalBusy()) || this.empty
  }

  /** @inheritDoc */
  protected get backPressure (): boolean {
    return this.full && this.internalBackPressure()
  }

  /** @inheritDoc */
  protected get busy (): boolean {
    return this.full && this.internalBusy()
  }

  /** @inheritDoc */
  protected get type (): PoolType {
    return PoolTypes.dynamic
  }
}
