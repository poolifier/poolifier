import type { Task } from '../utility-types.js'
import type { WorkerHandle } from './lifecycle-types.js'
import type { TaskRegistry } from './task-registry.js'
import type { ScheduleResult, SchedulerWorker } from './task-scheduler-types.js'
import type { TaskScheduler } from './task-scheduler.js'
import type { WorkerLifecycleCoordinator } from './worker-lifecycle-coordinator.js'

import { DEFAULT_TASK_NAME, exponentialDelay } from '../utils.js'

const MAX_TASK_STEALING_DELAY_MS = 1_000

export interface StealingWorker<Data> extends SchedulerWorker<Data> {
  readonly info: {
    backPressure: boolean
    backPressureStealing: boolean
    continuousStealing: boolean
    readonly dynamic: boolean
    queuedTaskAbortion: boolean
    ready: boolean
    stealing: boolean
    stolen: boolean
  }
}

export interface StealTimer {
  readonly cancel: () => void
}

export interface TaskStealingCallbacks<Worker, Data> {
  readonly applyResult: (result: ScheduleResult<Worker>) => void
  readonly cancel: (timer: StealTimer) => void
  readonly canSteal: () => boolean
  readonly defer: (callback: () => void) => void
  readonly handles: () => readonly WorkerHandle<Worker>[]
  readonly isIdle: (handle: WorkerHandle<Worker>) => boolean
  readonly onError: (error: unknown) => void
  readonly onStolen: (handle: WorkerHandle<Worker>, task: Task<Data>) => void
  readonly ratio: () => number
  readonly resetSequence: (
    handle: WorkerHandle<Worker>,
    previousTaskName?: string
  ) => void
  readonly schedule: (callback: () => void, delay: number) => StealTimer
  readonly sequentiallyStolen: (handle: WorkerHandle<Worker>) => number
  readonly updateSequence: (
    handle: WorkerHandle<Worker>,
    currentTaskName?: string,
    previousTaskName?: string
  ) => void
}

export class TaskStealingController<
  Worker extends StealingWorker<Data>,
  Data,
  Response
> {
  readonly #lastStolenTaskNames = new Map<WorkerHandle<Worker>, string>()
  readonly #timers = new Map<WorkerHandle<Worker>, StealTimer>()

  public constructor (
    private readonly scheduler: TaskScheduler<Worker, Data, Response>,
    private readonly registry: Pick<TaskRegistry<Data, Response>, 'get'>,
    private readonly coordinator: Pick<
      WorkerLifecycleCoordinator<Worker>,
      'handle' | 'isCurrent' | 'isSchedulable'
    >,
    private readonly callbacks: TaskStealingCallbacks<Worker, Data>
  ) {}

  public backPressure (source: WorkerHandle<Worker>): void {
    this.callbacks.defer(() => {
      try {
        if (
          !this.#isCurrent(source) ||
          !source.worker.info.backPressure ||
          !this.callbacks.canSteal() ||
          this.ratioReached()
        ) {
          return
        }
        const sourceSize = source.worker.tasksQueueSize()
        if (sourceSize <= 1) return
        const destinations = this.callbacks
          .handles()
          .filter(
            handle =>
              handle !== source &&
              handle.worker.tasksQueueSize() < sourceSize - 1
          )
          .sort(
            (left, right) =>
              left.worker.tasksQueueSize() - right.worker.tasksQueueSize()
          )
        for (const destination of destinations) {
          if (source.worker.tasksQueueSize() === 0) break
          destination.worker.info.backPressureStealing = true
          try {
            this.#steal(source, destination)
          } finally {
            destination.worker.info.backPressureStealing = false
          }
        }
      } catch (error) {
        this.callbacks.onError(error)
      }
    })
  }

  public cancel (handle: WorkerHandle<Worker>): void {
    this.#terminateSequence(handle)
  }

  public cancelAll (): void {
    for (const handle of this.callbacks.handles()) {
      this.#terminateSequence(handle)
    }
    for (const timer of this.#timers.values()) this.callbacks.cancel(timer)
    this.#timers.clear()
    this.#lastStolenTaskNames.clear()
  }

  public idle (
    destination: WorkerHandle<Worker>,
    previousTaskName?: string
  ): void {
    if (!this.#isCurrent(destination)) return
    const info = destination.worker.info
    if (
      !info.continuousStealing &&
      (!this.callbacks.canSteal() || this.ratioReached())
    ) {
      return
    }
    if (info.continuousStealing && !this.callbacks.isIdle(destination)) {
      this.#terminateSequence(destination, previousTaskName)
      return
    }
    const retainedPreviousTaskName =
      this.#lastStolenTaskNames.get(destination) ?? previousTaskName
    try {
      info.continuousStealing = true
      let source: undefined | WorkerHandle<Worker>
      let sourceSize = 0
      for (const handle of this.callbacks.handles()) {
        if (handle === destination) continue
        const size = handle.worker.tasksQueueSize()
        if (size > sourceSize) {
          source = handle
          sourceSize = size
        }
      }
      const stolenTaskName =
        source == null ? undefined : this.#steal(source, destination)
      this.callbacks.updateSequence(
        destination,
        stolenTaskName,
        retainedPreviousTaskName
      )
      if (stolenTaskName != null) {
        this.#lastStolenTaskNames.set(destination, stolenTaskName)
      }
      this.#cancelTimer(destination)
      const delay = Math.min(
        exponentialDelay(this.callbacks.sequentiallyStolen(destination)),
        MAX_TASK_STEALING_DELAY_MS
      )
      const timer = this.callbacks.schedule(() => {
        if (this.#timers.get(destination) !== timer) return
        this.#timers.delete(destination)
        if (this.#isCurrent(destination)) {
          this.idle(destination, stolenTaskName ?? retainedPreviousTaskName)
        }
      }, delay)
      this.#timers.set(destination, timer)
    } catch (error) {
      this.#terminateSequence(destination, retainedPreviousTaskName)
      this.callbacks.onError(error)
    }
  }

  public ratioReached (): boolean {
    const handles = this.callbacks.handles()
    const ratio = this.callbacks.ratio()
    if (ratio === 0) return true
    const stealing = handles.filter(
      handle =>
        handle.worker.info.continuousStealing ||
        handle.worker.info.backPressureStealing
    ).length
    return stealing >= Math.ceil(handles.length * ratio)
  }

  #cancelTimer (handle: WorkerHandle<Worker>): void {
    const timer = this.#timers.get(handle)
    if (timer != null) this.callbacks.cancel(timer)
    this.#timers.delete(handle)
  }

  #isCurrent (handle: WorkerHandle<Worker>): boolean {
    return (
      this.coordinator.isCurrent(handle) &&
      this.coordinator.handle(handle.worker) === handle &&
      this.coordinator.isSchedulable(handle)
    )
  }

  #steal (
    source: WorkerHandle<Worker>,
    destination: WorkerHandle<Worker>
  ): string | undefined {
    const sourceInfo = source.worker.info
    const destinationInfo = destination.worker.info
    if (
      !this.#isCurrent(source) ||
      !this.#isCurrent(destination) ||
      !sourceInfo.ready ||
      sourceInfo.stolen ||
      sourceInfo.stealing ||
      sourceInfo.queuedTaskAbortion ||
      !destinationInfo.ready ||
      destinationInfo.stolen ||
      destinationInfo.stealing ||
      destinationInfo.queuedTaskAbortion
    ) {
      return
    }
    destinationInfo.stealing = true
    sourceInfo.stolen = true
    try {
      const result = this.scheduler.steal(source, destination)
      this.callbacks.applyResult(result)
      if (result.kind !== 'committed' || result.taskId == null) return
      const task = this.registry.get(result.taskId)?.task
      if (task == null) return
      this.callbacks.onStolen(destination, task)
      return task.name ?? DEFAULT_TASK_NAME
    } finally {
      sourceInfo.stolen = false
      destinationInfo.stealing = false
    }
  }

  #terminateSequence (
    handle: WorkerHandle<Worker>,
    fallbackTaskName?: string
  ): void {
    this.#cancelTimer(handle)
    handle.worker.info.continuousStealing = false
    if (this.callbacks.sequentiallyStolen(handle) > 0) {
      this.callbacks.resetSequence(
        handle,
        this.#lastStolenTaskNames.get(handle) ?? fallbackTaskName
      )
    }
    this.#lastStolenTaskNames.delete(handle)
  }
}
