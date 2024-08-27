import { PoolEvents, type PoolType, PoolTypes } from '../pool.js'
import { checkDynamicPoolSize } from '../utils.js'
import { FixedThreadPool, type ThreadPoolOptions } from './fixed.js'

/**
 * A thread pool with a dynamic number of threads, but a guaranteed minimum number of threads.
 *
 * This thread pool creates new threads when the others are busy, up to the maximum number of threads.
 * When the maximum number of threads is reached and workers are busy, an event is emitted. If you want to listen to this event, use the pool's `emitter`.
 * @typeParam Data - Type of data sent to the worker. This can only be structured-cloneable data.
 * @typeParam Response - Type of execution response. This can only be structured-cloneable data.
 * @author [Alessandro Pio Ardizio](https://github.com/pioardi)
 * @since 0.0.1
 */
export class DynamicThreadPool<
  Data = unknown,
  Response = unknown
> extends FixedThreadPool<Data, Response> {
  /**
   * Constructs a new poolifier dynamic thread pool.
   * @param min - Minimum number of threads which are always active.
   * @param max - Maximum number of threads that can be created by this pool.
   * @param filePath - Path to an implementation of a `ThreadWorker` file, which can be relative or absolute.
   * @param opts - Options for this dynamic thread pool.
   */
  public constructor (
    min: number,
    max: number,
    filePath: string,
    opts: ThreadPoolOptions = {}
  ) {
    super(min, filePath, opts, max)
    checkDynamicPoolSize(
      this.minimumNumberOfWorkers,
      this.maximumNumberOfWorkers
    )
  }

  /** @inheritDoc */
  protected checkAndEmitDynamicWorkerCreationEvents (): void {
    if (this.emitter != null && this.full) {
      this.emitter.emit(PoolEvents.full, this.info)
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
