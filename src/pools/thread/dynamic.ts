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
  /** @inheritDoc */
  protected override get backPressure (): boolean {
    return this.full && this.internalBackPressure()
  }

  /** @inheritDoc */
  protected override get busy (): boolean {
    return this.full && this.internalBusy()
  }

  /** @inheritDoc */
  protected override get type (): PoolType {
    return PoolTypes.dynamic
  }

  /**
   * Whether the pool empty event has been emitted or not
   */
  private emptyEventEmitted: boolean

  /**
   * Whether the pool full event has been emitted or not.
   */
  private fullEventEmitted: boolean

  /**
   * Whether the pool is empty or not.
   * @returns The pool emptiness boolean status.
   */
  private get empty (): boolean {
    return (
      this.minimumNumberOfWorkers === 0 &&
      this.workerNodes.length === this.minimumNumberOfWorkers
    )
  }

  /**
   * Whether the pool is full or not.
   * @returns The pool fullness boolean status.
   */
  private get full (): boolean {
    return (
      this.workerNodes.length >=
      (this.maximumNumberOfWorkers ?? this.minimumNumberOfWorkers)
    )
  }

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
    this.emptyEventEmitted = false
    this.fullEventEmitted = false
  }

  /** @inheritDoc */
  protected override checkAndEmitDynamicWorkerCreationEvents (): void {
    if (this.emitter != null) {
      if (!this.fullEventEmitted && this.full) {
        this.emitter.emit(PoolEvents.full, this.info)
        this.fullEventEmitted = true
      }
      if (this.emptyEventEmitted && !this.empty) {
        this.emptyEventEmitted = false
      }
    }
  }

  /** @inheritDoc */
  protected override checkAndEmitDynamicWorkerDestructionEvents (): void {
    if (this.emitter != null) {
      if (this.fullEventEmitted && !this.full) {
        this.emitter.emit(PoolEvents.fullEnd, this.info)
        this.fullEventEmitted = false
      }
      if (!this.emptyEventEmitted && this.empty) {
        this.emitter.emit(PoolEvents.empty, this.info)
        this.emptyEventEmitted = true
      }
    }
  }

  /** @inheritDoc */
  protected override shallCreateDynamicWorker (): boolean {
    return (!this.full && this.internalBusy()) || this.empty
  }
}
