import { PoolType } from '../pool-internal'
import type { ClusterPoolOptions } from './fixed'
import { FixedClusterPool } from './fixed'

/**
 * A cluster pool with a dynamic number of workers, but a guaranteed minimum number of workers.
 *
 * This cluster pool creates new workers when the others are busy, up to the maximum number of workers.
 * When the maximum number of workers is reached, an event is emitted. If you want to listen to this event, use the pool's `emitter`.
 *
 * @template Data Type of data sent to the worker. This can only be serializable data.
 * @template Response Type of response of execution. This can only be serializable data.
 *
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
   * @param min Minimum number of workers which are always active.
   * @param max Maximum number of workers that can be created by this pool.
   * @param filePath Path to an implementation of a `ClusterWorker` file, which can be relative or absolute.
   * @param opts Options for this dynamic cluster pool. Default: `{}`
   */
  public constructor (
    min: number,
    public readonly max: number,
    filePath: string,
    opts: ClusterPoolOptions = {}
  ) {
    super(min, filePath, opts)
  }

  /** @inheritdoc */
  public get type (): PoolType {
    return PoolType.DYNAMIC
  }

  /** @inheritdoc */
  public get busy (): boolean {
    return this.workers.length === this.max
  }
}
