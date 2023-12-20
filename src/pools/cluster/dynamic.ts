import { type Worker } from 'node:cluster'
import { type PoolOptions, type PoolType, PoolTypes } from '../pool'
import { checkDynamicPoolSize } from '../utils'
import { FixedClusterPool } from './fixed'

/**
 * A cluster pool with a dynamic number of workers, but a guaranteed minimum number of workers.
 *
 * This cluster pool creates new workers when the others are busy, up to the maximum number of workers.
 * When the maximum number of workers is reached and workers are busy, an event is emitted. If you want to listen to this event, use the pool's `emitter`.
 *
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
   * Constructs a new poolifier dynamic cluster pool.
   *
   * @param min - Minimum number of workers which are always active.
   * @param max - Maximum number of workers that can be created by this pool.
   * @param filePath - Path to an implementation of a `ClusterWorker` file, which can be relative or absolute.
   * @param opts - Options for this dynamic cluster pool.
   */
  public constructor (
    min: number,
    max: number,
    filePath: string,
    opts: PoolOptions<Worker> = {}
  ) {
    super(min, filePath, opts, max)
    checkDynamicPoolSize(
      this.minimumNumberOfWorkers,
      this.maximumNumberOfWorkers as number
    )
  }

  /** @inheritDoc */
  protected get type (): PoolType {
    return PoolTypes.dynamic
  }

  /** @inheritDoc */
  protected get busy (): boolean {
    return this.full && this.internalBusy()
  }
}
