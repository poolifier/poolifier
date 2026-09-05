import type { Task, TaskUUID } from '../utility-types.js'
import type { WorkerHandle } from './lifecycle-types.js'
import type { TaskRegistry } from './task-registry.js'
import type {
  QueueTakeResult,
  ScheduleResult,
  SchedulerWorker,
} from './task-scheduler-types.js'

export class TaskSchedulerQueue<
  Worker extends SchedulerWorker<Data>,
  Data,
  Response
> {
  public constructor (private readonly registry: TaskRegistry<Data, Response>) {}

  public detachQueued (source: WorkerHandle<Worker>): readonly TaskUUID[] {
    const taskIds: TaskUUID[] = []
    const initialSize = source.worker.tasksQueueSize()
    for (let index = 0; index < initialSize; index++) {
      const size = source.worker.tasksQueueSize()
      if (size === 0) break
      const taken = this.take(source, false, 'detached')
      if (taken.kind === 'task') taskIds.push(taken.taskId)
      if (taken.kind === 'retry' || source.worker.tasksQueueSize() >= size) {
        break
      }
    }
    return taskIds
  }

  public drainPhysical (source: WorkerHandle<Worker>): readonly TaskUUID[] {
    const taskIds: TaskUUID[] = []
    const initialSize = source.worker.tasksQueueSize()
    for (let index = 0; index < initialSize; index++) {
      const size = source.worker.tasksQueueSize()
      if (size === 0) break
      let task: Task<Data> | undefined
      try {
        task = source.worker.dequeueTask()
      } catch {
        // no-excuse-ok: catch -- queue adapters may throw arbitrary values
        break
      }
      if (task?.taskId != null) taskIds.push(task.taskId)
      if (source.worker.tasksQueueSize() >= size) break
    }
    return taskIds
  }

  public enqueue (
    taskId: TaskUUID,
    destination: WorkerHandle<Worker>
  ): ScheduleResult<Worker> {
    const record = this.registry.get(taskId)
    if (record == null) return { kind: 'settled' }
    let transition
    try {
      transition = this.registry.transition(
        taskId,
        ['assigned', 'detached', 'registered', 'waitingReady'],
        'queued',
        destination.lease
      )
    } catch (error) {
      // no-excuse-ok: catch -- injected registries may throw arbitrary values
      return this.reject(taskId, error, destination)
    }
    if (!transition.ok) {
      return this.registry.get(taskId) == null
        ? { kind: 'settled' }
        : this.reject(
          taskId,
          new Error('Queue ownership transition failed'),
          destination
        )
    }
    const wasBackPressured = destination.worker.info?.backPressure ?? false
    try {
      destination.worker.enqueueTask(record.task)
    } catch (error) {
      // no-excuse-ok: catch -- queue adapters may throw arbitrary values
      return this.reject(taskId, error, destination)
    }
    return {
      backPressureStarted:
        !wasBackPressured && (destination.worker.info?.backPressure ?? false),
      handle: destination,
      kind: 'committed',
      state: 'queued',
      taskId,
    }
  }

  public enqueueUntracked (
    task: Task<Data>,
    destination: WorkerHandle<Worker>
  ): ScheduleResult<Worker> {
    const wasBackPressured = destination.worker.info?.backPressure ?? false
    try {
      destination.worker.enqueueTask(task)
      return {
        backPressureStarted:
          !wasBackPressured && (destination.worker.info?.backPressure ?? false),
        handle: destination,
        kind: 'committed',
        state: 'queued',
      }
    } catch (error) {
      // no-excuse-ok: catch -- queue adapters may throw arbitrary values
      return { error, kind: 'retry' }
    }
  }

  public rejectQueued (
    source: WorkerHandle<Worker>,
    errorFactory: (taskId: TaskUUID) => unknown
  ): readonly ScheduleResult<Worker>[] {
    const results: ScheduleResult<Worker>[] = []
    while (source.worker.tasksQueueSize() > 0) {
      const taken = this.take(source, false, 'detached')
      if (taken.kind !== 'task') {
        results.push(taken)
        if (taken.kind === 'retry') break
        continue
      }
      results.push(
        this.reject(taken.taskId, errorFactory(taken.taskId), source)
      )
    }
    return results
  }

  public rollbackAssigned (
    source: WorkerHandle<Worker>,
    taskId: TaskUUID
  ): ScheduleResult<Worker> {
    const record = this.registry.get(taskId)
    if (record == null) return { kind: 'settled' }
    const transition = this.registry.transition(
      taskId,
      ['assigned'],
      'queued',
      source.lease
    )
    return transition.ok
      ? this.restorePhysical(source, record.task)
      : this.reject(taskId, new Error('Dispatch rollback failed'), source)
  }

  public takeAssigned (source: WorkerHandle<Worker>): QueueTakeResult<Worker> {
    return this.take(source, false, 'assigned')
  }

  public takeDetached (
    source: WorkerHandle<Worker>,
    prioritized = false
  ): QueueTakeResult<Worker> {
    return this.take(source, prioritized, 'detached')
  }

  private reject (
    taskId: TaskUUID,
    error: unknown,
    handle?: WorkerHandle<Worker>
  ): ScheduleResult<Worker> {
    const settlement = this.registry.settle(taskId, { error, kind: 'rejected' })
    return { handle, kind: 'settled', settlement, taskId }
  }

  private restorePhysical (
    source: WorkerHandle<Worker>,
    task: Task<Data>
  ): ScheduleResult<Worker> {
    try {
      source.worker.enqueueTask(task)
      return { kind: 'retry' }
    } catch (error) {
      // no-excuse-ok: catch -- queue adapters may throw arbitrary values
      return task.taskId == null
        ? { error, kind: 'retry' }
        : this.reject(task.taskId, error, source)
    }
  }

  private take (
    source: WorkerHandle<Worker>,
    prioritized: boolean,
    next: 'assigned' | 'detached'
  ): QueueTakeResult<Worker> {
    let task: Task<Data> | undefined
    try {
      task = prioritized
        ? source.worker.dequeueLastPrioritizedTask()
        : source.worker.dequeueTask()
    } catch (error) {
      // no-excuse-ok: catch -- queue adapters may throw arbitrary values
      return { error, kind: 'retry' }
    }
    if (task?.taskId == null) return { kind: 'retry' }
    let transition
    try {
      transition = this.registry.transition(
        task.taskId,
        ['queued'],
        next,
        next === 'assigned' ? source.lease : undefined
      )
    } catch (error) {
      // no-excuse-ok: catch -- injected registries may throw arbitrary values
      return this.reject(task.taskId, error, source)
    }
    if (transition.ok) return { kind: 'task', taskId: task.taskId }
    return this.registry.get(task.taskId) == null
      ? { kind: 'settled' }
      : this.reject(
        task.taskId,
        new Error('Queue ownership transition failed'),
        source
      )
  }
}
