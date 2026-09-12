import type { PoolEventPublisher } from './pool-event-publisher.js'

export interface PoolTaskEventStateCallbacks<Info> {
  readonly backPressure: () => boolean
  readonly busy: () => boolean
  readonly info: () => Info
  readonly publisher: PoolEventPublisher
  readonly ready: () => boolean
}

type LifecycleOwner = Parameters<PoolEventPublisher['defer']>[1]

export class PoolTaskEventState<Info> {
  public backPressureEventEmitted = false
  public busyEventEmitted = false
  public readyEventEmitted = false

  public constructor (
    private readonly callbacks: PoolTaskEventStateCallbacks<Info>
  ) {}

  public checkExecutionFinished (owner?: LifecycleOwner): void {
    if (
      this.callbacks.publisher.emitter != null &&
      this.busyEventEmitted &&
      !this.callbacks.busy()
    ) {
      this.busyEventEmitted = false
      this.callbacks.publisher.publish('busyEnd', this.callbacks.info(), owner)
    }
  }

  public checkExecutionStarted (): void {
    if (
      this.callbacks.publisher.emitter != null &&
      !this.busyEventEmitted &&
      this.callbacks.busy()
    ) {
      this.busyEventEmitted = true
      this.callbacks.publisher.publish('busy', this.callbacks.info())
    }
  }

  public checkReady (): void {
    if (
      this.callbacks.publisher.emitter != null &&
      !this.readyEventEmitted &&
      this.callbacks.ready()
    ) {
      this.readyEventEmitted = true
      this.callbacks.publisher.publish('ready', this.callbacks.info())
    }
  }

  public checkTaskDequeued (owner?: LifecycleOwner): void {
    if (
      this.callbacks.publisher.emitter != null &&
      this.backPressureEventEmitted &&
      !this.callbacks.backPressure()
    ) {
      this.backPressureEventEmitted = false
      this.callbacks.publisher.publish(
        'backPressureEnd',
        this.callbacks.info(),
        owner
      )
    }
  }

  public checkTaskQueued (): void {
    if (
      this.callbacks.publisher.emitter != null &&
      !this.backPressureEventEmitted &&
      this.callbacks.backPressure()
    ) {
      this.backPressureEventEmitted = true
      this.callbacks.publisher.publish('backPressure', this.callbacks.info())
    }
  }

  public synchronizeBackPressure (): void {
    this.backPressureEventEmitted = this.callbacks.backPressure()
  }
}
