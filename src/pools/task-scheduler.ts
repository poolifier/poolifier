import type { Task, TaskUUID } from '../utility-types.js'
import type {
  DispatchPermit,
  ReconciliationReservation,
  WorkerHandle,
  WorkerLease,
} from './lifecycle-types.js'
import type { TaskRegistry } from './task-registry.js'
import type {
  ScheduleResult,
  SchedulerWorker,
  TaskSchedulerCallbacks,
} from './task-scheduler-types.js'

import { TaskDispatcher } from './task-dispatcher.js'
import { TaskSchedulerQueue } from './task-scheduler-queue.js'

export class TaskScheduler<
  Worker extends SchedulerWorker<Data>,
  Data,
  Response
> extends TaskDispatcher<Worker, Data, Response> {
  readonly #queue: TaskSchedulerQueue<Worker, Data, Response>

  public constructor (
    registry: TaskRegistry<Data, Response>,
    callbacks: TaskSchedulerCallbacks<Worker, Data>
  ) {
    super(registry, callbacks)
    this.#queue = new TaskSchedulerQueue(registry)
  }

  public dequeueAndDispatch (
    source: WorkerHandle<Worker>
  ): ScheduleResult<Worker> {
    const taken = this.#queue.takeAssigned(source)
    if (taken.kind !== 'task') return taken
    const permit = this.callbacks.acquire(source)
    return permit == null
      ? this.#queue.rollbackAssigned(source, taken.taskId)
      : this.dispatchAssigned(taken.taskId, permit)
  }

  public detachQueued (source: WorkerHandle<Worker>): readonly TaskUUID[] {
    return this.#queue.detachQueued(source)
  }

  public drainPhysical (source: WorkerHandle<Worker>): readonly TaskUUID[] {
    return this.#queue.drainPhysical(source)
  }

  public enqueue (
    taskId: TaskUUID,
    destination: WorkerHandle<Worker>
  ): ScheduleResult<Worker> {
    return this.#queue.enqueue(taskId, destination)
  }

  public enqueueUntracked (
    task: Task<Data>,
    destination: WorkerHandle<Worker>
  ): ScheduleResult<Worker> {
    return this.#queue.enqueueUntracked(task, destination)
  }

  public redistribute (
    source: WorkerHandle<Worker>
  ): readonly ScheduleResult<Worker>[] {
    const results: ScheduleResult<Worker>[] = []
    while (source.worker.tasksQueueSize() > 0) {
      const taken = this.#queue.takeDetached(source)
      if (taken.kind !== 'task') {
        results.push(taken)
        if (taken.kind === 'retry') break
        continue
      }
      results.push(this.#placeDetached(taken.taskId, source))
    }
    return results
  }

  public register (
    input: Parameters<TaskRegistry<Data, Response>['register']>[0]
  ): void {
    this.registry.register(input)
  }

  public rejectQueued (
    source: WorkerHandle<Worker>,
    errorFactory: (taskId: TaskUUID) => unknown
  ): readonly ScheduleResult<Worker>[] {
    return this.#queue.rejectQueued(source, errorFactory)
  }

  public reserveForReconciliation (
    taskIds: readonly TaskUUID[],
    lease: WorkerLease
  ): readonly ReconciliationReservation[] {
    return this.registry.reserveForReconciliation(taskIds, lease)
  }

  public restore (
    tasks: readonly (ReconciliationReservation | TaskUUID)[],
    candidates: readonly WorkerHandle<Worker>[],
    noCandidateError: (taskId: TaskUUID) => unknown = () =>
      new Error('No scheduling candidate')
  ): readonly ScheduleResult<Worker>[] {
    return tasks.map(task => {
      const taskId = typeof task === 'string' ? task : task.taskId
      if (
        typeof task !== 'string' &&
        !this.registry.restoreReservation(task).ok
      ) {
        return { kind: 'settled', taskId }
      }
      const destination = candidates.reduce<undefined | WorkerHandle<Worker>>(
        (least, handle) =>
          least == null ||
          handle.worker.tasksQueueSize() < least.worker.tasksQueueSize()
            ? handle
            : least,
        undefined
      )
      if (destination == null) {
        return this.reject(taskId, noCandidateError(taskId))
      }
      return this.#settlePlacementRetry(
        taskId,
        this.#placeOn(taskId, destination)
      )
    })
  }

  public schedule (
    taskId: TaskUUID,
    permit: DispatchPermit<Worker>,
    execute: boolean
  ): ScheduleResult<Worker> {
    if (this.registry.get(taskId)?.abortSignal?.aborted === true) {
      return this.abort(taskId)
    }
    return permit.readiness === 'awaitingReady'
      ? this.wait(taskId, permit)
      : execute
        ? this.dispatch(taskId, permit)
        : this.enqueue(taskId, permit.handle)
  }

  public steal (
    source: WorkerHandle<Worker>,
    destination: WorkerHandle<Worker>
  ): ScheduleResult<Worker> {
    const taken = this.#queue.takeDetached(source, true)
    return taken.kind === 'task'
      ? this.#placeOn(taken.taskId, destination)
      : taken
  }

  #placeDetached (
    taskId: TaskUUID,
    source: WorkerHandle<Worker>
  ): ScheduleResult<Worker> {
    const destination = this.callbacks.candidates(source).at(0)
    return destination == null
      ? this.reject(taskId, new Error('No scheduling candidate'))
      : this.#settlePlacementRetry(taskId, this.#placeOn(taskId, destination))
  }

  #placeOn (
    taskId: TaskUUID,
    destination: WorkerHandle<Worker>
  ): ScheduleResult<Worker> {
    if (this.registry.get(taskId)?.abortSignal?.aborted === true) {
      return this.abort(taskId)
    }
    const permit = this.callbacks.acquire(destination)
    return permit != null && this.callbacks.shouldDispatch(permit)
      ? this.dispatch(taskId, permit)
      : this.enqueue(taskId, destination)
  }

  #settlePlacementRetry (
    taskId: TaskUUID,
    result: ScheduleResult<Worker>
  ): ScheduleResult<Worker> {
    return result.kind === 'retry'
      ? this.reject(taskId, result.error ?? new Error('Task placement failed'))
      : result
  }
}
