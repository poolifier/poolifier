import type { EventEmitter } from 'node:events'

import type { Task, TaskUUID } from '../utility-types.js'
import type { SettlementResult, WorkerHandle } from './lifecycle-types.js'
import type { PoolEventPublisher } from './pool-event-publisher.js'
import type { ScheduleResult } from './task-scheduler-types.js'

export interface RejectedSettlementAccounting<Worker> {
  applyRejectedSettlement: (
    result: SettlementResult,
    fallbackWorker?: Worker
  ) => undefined | Worker
}

export interface ScheduleResultAdapterCallbacks<Worker, Data> {
  readonly accounting: RejectedSettlementAccounting<Worker>
  readonly beforeTaskExecution: (
    workerNodeKey: number,
    task: Task<Data>
  ) => void
  readonly events: ScheduleResultEventState
  readonly getTask: (taskId: TaskUUID) => Task<Data> | undefined
  readonly getWorkerNodeKeyByHandle: (handle: WorkerHandle<Worker>) => number
  readonly publisher: PoolEventPublisher
}

export interface ScheduleResultEventState {
  checkExecutionStarted: () => void
  checkTaskQueued: () => void
}

type LifecycleOwner = Parameters<PoolEventPublisher['defer']>[1]

export class ScheduleResultAdapter<Worker extends EventEmitter, Data> {
  public constructor (
    private readonly callbacks: ScheduleResultAdapterCallbacks<Worker, Data>
  ) {}

  public apply (result: ScheduleResult<Worker>, owner?: LifecycleOwner): void {
    switch (result.kind) {
      case 'committed':
        this.applyCommit(result, owner)
        return
      case 'retry':
        if (result.error != null) {
          this.callbacks.publisher.defer(result.error, owner)
        }
        return
      case 'settled':
        this.applySettlement(result, owner)
        return
      default: {
        const exhaustive: never = result
        return exhaustive
      }
    }
  }

  private applyCommit (
    result: Extract<ScheduleResult<Worker>, { kind: 'committed' }>,
    owner?: LifecycleOwner
  ): void {
    if (result.state === 'queued') {
      if (result.backPressureStarted === true) {
        this.callbacks.publisher.publishInternal(
          result.handle.worker,
          'backPressure',
          { workerId: result.handle.lease.id },
          owner
        )
      }
      this.callbacks.events.checkTaskQueued()
      return
    }
    if (result.state !== 'running' || result.taskId == null) return
    const workerNodeKey = this.callbacks.getWorkerNodeKeyByHandle(result.handle)
    const task = this.callbacks.getTask(result.taskId)
    if (workerNodeKey === -1 || task == null) return
    this.callbacks.beforeTaskExecution(workerNodeKey, task)
    this.callbacks.events.checkExecutionStarted()
  }

  private applySettlement (
    result: Extract<ScheduleResult<Worker>, { kind: 'settled' }>,
    owner?: LifecycleOwner
  ): void {
    if (result.settlement?.settled !== true || result.taskId == null) return
    this.callbacks.publisher.deferAll(result.settlement.secondaryErrors, owner)
    const eventWorker = this.callbacks.accounting.applyRejectedSettlement(
      result.settlement,
      result.handle?.worker
    )
    if (eventWorker != null) {
      this.callbacks.publisher.publishInternal(
        eventWorker,
        'taskFinished',
        result.taskId,
        owner
      )
    }
  }
}
