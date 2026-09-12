import type { Task, TaskUUID } from '../utility-types.js'
import type {
  DispatchPermit,
  SettlementResult,
  TaskSettlement,
  WorkerHandle,
  WorkerLease,
} from './lifecycle-types.js'
import type { TaskRegistry } from './task-registry.js'
import type {
  ScheduleResult,
  SchedulerWorker,
  TaskSchedulerCallbacks,
} from './task-scheduler-types.js'

export class TaskDispatcher<
  Worker extends SchedulerWorker<Data>,
  Data,
  Response
> {
  public constructor (
    protected readonly registry: TaskRegistry<Data, Response>,
    protected readonly callbacks: TaskSchedulerCallbacks<Worker, Data>
  ) {}

  public abort (taskId: TaskUUID): ScheduleResult<Worker> {
    const decision = this.registry.requestAbort(taskId)
    switch (decision.kind) {
      case 'defer-dispatch':
      case 'noop':
        return { kind: 'retry' }
      case 'send-running-abort': {
        const handle = this.handleForLease(decision.lease)
        if (handle == null) return { kind: 'retry' }
        try {
          this.callbacks.sendAbort(handle, taskId)
        } catch (error) {
          // no-excuse-ok: catch -- transports may throw arbitrary values
          this.registry.transition(
            taskId,
            ['cancelling'],
            'running',
            handle.lease
          )
          return { error, kind: 'retry' }
        }
        return { handle, kind: 'committed', state: 'cancelling', taskId }
      }
      case 'settle-local': {
        const record = this.registry.get(taskId)
        if (record == null) return { kind: 'settled' }
        const handle = this.handleForLease(
          decision.lease ?? record.selectedLease
        )
        if (decision.state === 'queued' && handle != null) {
          try {
            handle.worker.deleteTask(record.task)
          } catch (error) {
            // no-excuse-ok: catch -- queue adapters may throw arbitrary values
            return this.reject(taskId, error)
          }
        }
        return this.reject(taskId, decision.error)
      }
      default: {
        const exhaustive: never = decision
        return exhaustive
      }
    }
  }

  public dispatch (
    taskId: TaskUUID,
    permit: DispatchPermit<Worker>
  ): ScheduleResult<Worker> {
    const transition = this.registry.transition(
      taskId,
      ['registered', 'queued', 'detached', 'waitingReady'],
      'assigned',
      permit.handle.lease
    )
    return transition.ok
      ? this.dispatchAssigned(taskId, permit)
      : this.registry.get(taskId) == null
        ? { kind: 'settled' }
        : { kind: 'retry' }
  }

  public dispatchAssigned (
    taskId: TaskUUID,
    permit: DispatchPermit<Worker>
  ): ScheduleResult<Worker> {
    const record = this.registry.get(taskId)
    if (record == null) return { kind: 'settled' }
    if (record.abortSignal?.aborted === true) return this.abort(taskId)
    if (
      !this.registry.transition(
        taskId,
        ['assigned'],
        'dispatching',
        permit.handle.lease
      ).ok
    ) {
      return { kind: 'retry' }
    }
    try {
      this.callbacks.send(permit, record.task, record.task.transferList)
    } catch (error) {
      // no-excuse-ok: catch -- transports may throw arbitrary values
      return this.reject(taskId, error)
    }
    if (
      !this.registry.transition(
        taskId,
        ['dispatching'],
        'running',
        permit.handle.lease
      ).ok
    ) {
      return { kind: 'retry' }
    }
    return this.registry.get(taskId)?.abortSignal?.aborted === true
      ? this.abort(taskId)
      : { handle: permit.handle, kind: 'committed', state: 'running', taskId }
  }

  public dispatchUntracked (
    task: Task<Data>,
    permit: DispatchPermit<Worker>
  ): ScheduleResult<Worker> {
    try {
      this.callbacks.send(permit, task, task.transferList)
      return { handle: permit.handle, kind: 'committed', state: 'running' }
    } catch (error) {
      // no-excuse-ok: catch -- transports may throw arbitrary values
      return { error, kind: 'retry' }
    }
  }

  public reject (
    taskId: TaskUUID,
    error: unknown,
    reservationLease?: WorkerLease
  ): ScheduleResult<Worker> {
    const record = this.registry.get(taskId)
    const handle = this.handleForLease(
      record?.currentLease ?? record?.selectedLease
    )
    const settlement =
      reservationLease != null
        ? this.registry.settleReserved(
          taskId,
          { error, kind: 'rejected' },
          reservationLease
        )
        : this.registry.settle(taskId, { error, kind: 'rejected' })
    return { handle, kind: 'settled', settlement, taskId }
  }

  public settle (
    taskId: TaskUUID,
    settlement: TaskSettlement<Response>,
    reservationLease?: WorkerLease
  ): SettlementResult {
    return reservationLease != null
      ? this.registry.settleReserved(taskId, settlement, reservationLease)
      : this.registry.settle(taskId, settlement)
  }

  public wait (
    taskId: TaskUUID,
    permit: DispatchPermit<Worker>
  ): ScheduleResult<Worker> {
    return this.registry.bindWaitingReady(taskId, permit).ok
      ? {
          handle: permit.handle,
          kind: 'committed',
          state: 'waitingReady',
          taskId,
        }
      : { kind: 'retry' }
  }

  protected handleForLease (
    lease?: WorkerHandle<Worker>['lease']
  ): undefined | WorkerHandle<Worker> {
    if (lease == null) return undefined
    return this.callbacks
      .candidates()
      .find(
        candidate =>
          candidate.lease.id === lease.id &&
          candidate.lease.generation === lease.generation
      )
  }
}
