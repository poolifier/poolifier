import type { TaskUUID } from '../utility-types.js'
import type {
  AbortDecision,
  AccountingEffect,
  DispatchPermit,
  ReconciliationReservation,
  RegisterTaskInput,
  RegistryTransition,
  SettlementResult,
  TaskRecord,
  TaskSettlement,
  TaskState,
  WorkerLease,
} from './lifecycle-types.js'

import { DuplicateTaskError } from './duplicate-task-error.js'
import {
  hasActiveExecution,
  hasOwnedWork,
  snapshotActiveReconciliationTaskIds,
  snapshotTasksByLease,
  snapshotWaitingReadyTasks,
} from './task-registry-queries.js'
import {
  finalizeTaskSettlement,
  rollbackTaskRegistration,
} from './task-settlement-finalizer.js'
import {
  decideTaskTransition,
  isActiveTaskState,
  sameWorkerLease,
} from './task-transition-decision.js'

const legalTransitions = {
  assigned: ['dispatching', 'queued', 'reconciling', 'settled'],
  cancelling: ['reconciling', 'running', 'settled'],
  detached: ['queued', 'assigned', 'reconciling', 'settled'],
  dispatching: ['reconciling', 'running', 'settled'],
  queued: ['assigned', 'detached', 'reconciling', 'settled'],
  reconciling: ['registered', 'settled'],
  registered: ['waitingReady', 'queued', 'assigned', 'reconciling', 'settled'],
  running: ['cancelling', 'reconciling', 'settled'],
  settled: [],
  waitingReady: ['assigned', 'queued', 'reconciling', 'settled'],
} as const satisfies Record<TaskState, readonly TaskState[]>

type ReservableTaskState = ReconciliationReservation['previousState']

const isReservableTaskState = (
  state: TaskState
): state is ReservableTaskState =>
  state !== 'reconciling' && state !== 'settled'

const getTaskAbortDecision = <Data, Response>(
  record: Readonly<TaskRecord<Data, Response>>,
  taskId: TaskUUID
): AbortDecision => {
  switch (record.state) {
    case 'assigned':
    case 'detached':
    case 'queued':
    case 'registered':
    case 'waitingReady':
      return {
        error:
          record.abortSignal?.reason ??
          new Error(
            `Task '${record.task.name ?? 'default'}' id '${taskId}' aborted`
          ),
        kind: 'settle-local',
        ...(record.currentLease != null && { lease: record.currentLease }),
        state: record.state,
      }
    case 'cancelling':
      return { kind: 'noop', reason: 'already_cancelling' }
    case 'dispatching':
      return { kind: 'defer-dispatch' }
    case 'reconciling':
      return { kind: 'noop', reason: 'reconciling' }
    case 'running':
      return record.currentLease == null
        ? { kind: 'noop', reason: 'missing' }
        : { kind: 'send-running-abort', lease: record.currentLease }
    case 'settled':
      return { kind: 'noop', reason: 'settled' }
  }
}

export { DuplicateTaskError } from './duplicate-task-error.js'

export class TaskRegistry<Data = unknown, Response = unknown> {
  public get size (): number {
    return this.#records.size
  }

  readonly #records = new Map<TaskUUID, TaskRecord<Data, Response>>()

  public bindAssigned<Worker>(
    taskId: TaskUUID,
    permit: DispatchPermit<Worker>
  ): RegistryTransition {
    return this.#bind(taskId, permit, 'assigned')
  }

  public bindWaitingReady<Worker>(
    taskId: TaskUUID,
    permit: DispatchPermit<Worker>
  ): RegistryTransition {
    if (permit.readiness !== 'awaitingReady') {
      return { ok: false, reason: 'state_mismatch' }
    }
    return this.#bind(taskId, permit, 'waitingReady')
  }

  public get (
    taskId: TaskUUID
  ): Readonly<TaskRecord<Data, Response>> | undefined {
    return this.#records.get(taskId)
  }

  public hasActiveExecution (lease: WorkerLease): boolean {
    return hasActiveExecution(this.#records, lease)
  }

  public hasOwnedWork (lease: WorkerLease): boolean {
    return hasOwnedWork(this.#records, lease)
  }

  public register (input: RegisterTaskInput<Data, Response>): TaskUUID {
    const { task } = input
    if (this.#records.has(task.taskId)) {
      throw new DuplicateTaskError(task.taskId)
    }
    const abortListener = (): void => {
      input.onAbort(task.taskId)
    }
    const record: TaskRecord<Data, Response> = {
      abortListener: input.abortSignal != null ? abortListener : undefined,
      abortSignal: input.abortSignal,
      asyncResource: input.asyncResource,
      reject: input.reject,
      resolve: input.resolve,
      selectedLease: input.selectedLease,
      state: 'registered',
      task,
    }
    this.#records.set(task.taskId, record)
    try {
      input.abortSignal?.addEventListener('abort', abortListener, {
        once: true,
      })
    } catch (error) {
      rollbackTaskRegistration(this.#records, record)
      throw error
    }
    return task.taskId
  }

  public requestAbort (taskId: TaskUUID): AbortDecision {
    const record = this.#records.get(taskId)
    if (record == null) {
      return { kind: 'noop', reason: 'missing' }
    }
    const decision = getTaskAbortDecision(record, taskId)
    if (decision.kind === 'send-running-abort') {
      record.state = 'cancelling'
    }
    return decision
  }

  public reserveForReconciliation (
    taskIds: readonly TaskUUID[],
    lease: WorkerLease
  ): readonly ReconciliationReservation[] {
    const reserved: ReconciliationReservation[] = []
    for (const taskId of taskIds) {
      const record = this.#records.get(taskId)
      if (record == null) continue
      const ownedLease = record.currentLease ?? record.selectedLease
      if (!sameWorkerLease(ownedLease, lease)) continue
      const previousState = record.state
      if (!isReservableTaskState(previousState)) continue
      const active = isActiveTaskState(previousState)
      if (
        this.transition(
          taskId,
          [
            'registered',
            'waitingReady',
            'queued',
            'assigned',
            'dispatching',
            'running',
            'cancelling',
            'detached',
          ],
          'reconciling',
          lease
        ).ok
      ) {
        record.activeOnReconciliation = active
        reserved.push(Object.freeze({ lease, previousState, taskId }))
      }
    }
    return reserved
  }

  public restoreReservation (
    reservation: ReconciliationReservation
  ): RegistryTransition {
    const transition = this.transition(
      reservation.taskId,
      ['reconciling'],
      'registered'
    )
    if (transition.ok) {
      const record = this.#records.get(reservation.taskId)
      if (record != null) delete record.currentLease
    }
    return transition
  }

  public settle (
    taskId: TaskUUID,
    settlement: TaskSettlement<Response>
  ): SettlementResult {
    if (this.#records.get(taskId)?.state === 'reconciling') {
      return { settled: false }
    }
    return this.#settle(taskId, settlement)
  }

  public settleReserved (
    taskId: TaskUUID,
    settlement: TaskSettlement<Response>,
    lease: WorkerLease
  ): SettlementResult {
    const record = this.#records.get(taskId)
    if (
      record?.state !== 'reconciling' ||
      !sameWorkerLease(record.currentLease, lease)
    ) {
      return { settled: false }
    }
    return this.#settle(taskId, settlement)
  }

  public snapshotActiveReconciliationTaskIds (
    taskIds: readonly TaskUUID[],
    lease: WorkerLease
  ): readonly TaskUUID[] {
    return snapshotActiveReconciliationTaskIds(this.#records, taskIds, lease)
  }

  public snapshotByLease (lease: WorkerLease): readonly TaskUUID[] {
    return snapshotTasksByLease(this.#records, lease)
  }

  public snapshotWaitingReady (lease: WorkerLease): readonly TaskUUID[] {
    return snapshotWaitingReadyTasks(this.#records, lease)
  }

  public transition (
    taskId: TaskUUID,
    expected: readonly TaskState[],
    next: TaskState,
    lease?: WorkerLease
  ): RegistryTransition {
    const record = this.#records.get(taskId)
    if (record == null) {
      return { ok: false, reason: 'missing' }
    }
    const decision = decideTaskTransition(
      record,
      expected,
      legalTransitions[record.state],
      next,
      lease
    )
    if (!decision.ok) {
      return { ok: false, reason: 'state_mismatch' }
    }
    record.state = next
    if (next === 'detached') {
      delete record.currentLease
    }
    if (next !== 'detached' && decision.currentLease != null) {
      record.currentLease = decision.currentLease
    }
    return { current: next, ok: true, previous: decision.previous }
  }

  public waitingReadyCount (lease: WorkerLease): number {
    return snapshotWaitingReadyTasks(this.#records, lease).length
  }

  #bind<Worker>(
    taskId: TaskUUID,
    permit: DispatchPermit<Worker>,
    next: 'assigned' | 'waitingReady'
  ): RegistryTransition {
    const record = this.#records.get(taskId)
    if (record == null) return { ok: false, reason: 'missing' }
    if (record.state !== 'registered') {
      return { ok: false, reason: 'state_mismatch' }
    }
    record.selectedLease ??= permit.handle.lease
    return this.transition(taskId, ['registered'], next, permit.handle.lease)
  }

  #settle (
    taskId: TaskUUID,
    settlement: TaskSettlement<Response>
  ): SettlementResult {
    const record = this.#records.get(taskId)
    if (record == null || record.state === 'settled') {
      return { settled: false }
    }
    const activeLease =
      record.state === 'running' ||
      record.state === 'cancelling' ||
      (record.state === 'reconciling' && record.activeOnReconciliation === true)
        ? record.currentLease
        : undefined
    const effect: AccountingEffect = {
      ...(activeLease != null && { activeLease }),
      executionStarted: activeLease != null,
      outcome: settlement.kind === 'resolved' ? 'executed' : 'failed',
      selectedLease: record.selectedLease,
      taskName: record.task.name ?? 'default',
    }
    delete record.currentLease
    record.state = 'settled'
    const result = finalizeTaskSettlement(record, settlement, effect)
    this.#records.delete(taskId)
    return result
  }
}
