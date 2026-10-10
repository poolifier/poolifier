import type { Task, TaskUUID } from '../utility-types.js'
import type { DispatchPermit } from './lifecycle-types.js'
import type { ScheduleResult, SchedulerWorker } from './task-scheduler-types.js'
import type { TaskScheduler } from './task-scheduler.js'

export interface TaskRoutingCallbacks<Worker> {
  readonly concurrency: () => number
  readonly executing: (worker: Worker) => number
  readonly onResult: (result: ScheduleResult<Worker>) => void
  readonly queuesEnabled: () => boolean
}

export class TaskRouter<Worker extends SchedulerWorker<Data>, Data, Response> {
  public constructor (
    private readonly scheduler: TaskScheduler<Worker, Data, Response>,
    private readonly callbacks: TaskRoutingCallbacks<Worker>
  ) {}

  public route (
    taskId: TaskUUID,
    permit: DispatchPermit<Worker>
  ): ScheduleResult<Worker> {
    const result = this.scheduler.schedule(
      taskId,
      permit,
      this.shouldExecute(permit.handle.worker)
    )
    this.callbacks.onResult(result)
    return result
  }

  public routeUntracked (
    task: Task<Data>,
    permit: DispatchPermit<Worker>
  ): ScheduleResult<Worker> {
    const result = this.shouldExecute(permit.handle.worker)
      ? this.scheduler.dispatchUntracked(task, permit)
      : this.scheduler.enqueueUntracked(task, permit.handle)
    this.callbacks.onResult(result)
    return result
  }

  public shouldExecute (worker: Worker): boolean {
    return (
      !this.callbacks.queuesEnabled() ||
      (worker.tasksQueueSize() === 0 &&
        this.callbacks.executing(worker) < this.callbacks.concurrency())
    )
  }
}
