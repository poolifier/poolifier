import type { TaskUUID } from '../utility-types.js'
import type {
  LifecycleWorker,
  ReconciliationReservation,
  WorkerCompletionInput,
  WorkerLease,
  WorkerReconciliationInput,
  WorkerReplacementInput,
} from './lifecycle-types.js'
import type { ScheduleResult } from './task-scheduler-types.js'
import type { IWorker, IWorkerNode } from './worker.js'

import { WorkerCrashError, WorkerTerminationError } from './errors.js'
import { getWorkerCrashAttribution } from './worker-crash-attribution.js'
import {
  buildUnexpectedExitError,
  buildWorkerCrashError,
  buildWorkerReconciliationError,
  buildWorkerTaskCrashError,
} from './worker-reconciliation-error-builders.js'
import { WorkerTaskRecovery } from './worker-task-recovery.js'

export interface WorkerReconciliationPolicyCallbacks<
  WorkerNode extends LifecycleWorker
> {
  readonly apply: (
    result: ScheduleResult<WorkerNode>,
    owner?: WorkerLease
  ) => void
  readonly attemptRestart: () => boolean
  readonly createDynamic: () => void
  readonly defer: (error: unknown, owner: WorkerLease) => void
  readonly detachQueued: (
    handle: WorkerReplacementInput<WorkerNode>['handle']
  ) => void
  readonly drainPhysical: (
    handle: WorkerReplacementInput<WorkerNode>['handle']
  ) => void
  readonly executionFinished: (owner: WorkerLease) => void
  readonly isRunning: () => boolean
  readonly publishError: (error: unknown, owner?: WorkerLease) => void
  readonly reject: (
    taskId: TaskUUID,
    worker: WorkerNode,
    error: WorkerCrashError | WorkerTerminationError,
    owner: WorkerLease
  ) => boolean
  readonly replenishFixed: () => void
  readonly reserve: (
    taskIds: readonly TaskUUID[],
    owner: WorkerLease
  ) => readonly ReconciliationReservation[]
  readonly restartWorkerOnError: () => boolean
  readonly restore: (
    reservations: readonly ReconciliationReservation[],
    error: (taskId: TaskUUID) => WorkerCrashError | WorkerTerminationError
  ) => readonly ScheduleResult<WorkerNode>[]
  readonly rollbackStartup: (failed: WorkerNode) => void
  readonly taskDequeued: (owner: WorkerLease) => void
  readonly tasksFinishedTimeout: () => number
  readonly waitForDrain: (
    worker: WorkerNode,
    signal: AbortSignal
  ) => Promise<void>
  readonly workers: () => readonly WorkerNode[]
}

export class WorkerReconciliationPolicy<
  Worker extends IWorker,
  Data,
  WorkerNode extends IWorkerNode<Worker, Data> = IWorkerNode<Worker, Data>
> {
  public constructor (
    private readonly callbacks: WorkerReconciliationPolicyCallbacks<WorkerNode>
  ) {}

  public buildCrashError (
    cause: Error,
    workerNode: WorkerNode,
    taskId?: TaskUUID
  ): WorkerCrashError {
    return buildWorkerCrashError(cause, workerNode.info.id, taskId)
  }

  public buildTaskCrashError (
    cause: Error,
    workerNode: WorkerNode,
    taskId: TaskUUID,
    isCrashAttributed: boolean
  ): WorkerCrashError {
    return buildWorkerTaskCrashError(
      cause,
      workerNode.info.id,
      taskId,
      isCrashAttributed
    )
  }

  public buildUnexpectedExitError (
    context: 'lifecycle' | 'teardown',
    exitCode: null | number,
    signal: NodeJS.Signals | null | undefined,
    workerId: number | undefined
  ): WorkerCrashError {
    return buildUnexpectedExitError(context, exitCode, signal, workerId)
  }

  public complete (
    input: WorkerCompletionInput<WorkerNode>,
    signal: AbortSignal
  ): Promise<void> {
    const firstError =
      input.reconciliationValue instanceof WorkerCrashError ||
      input.reconciliationValue instanceof WorkerTerminationError
        ? input.reconciliationValue
        : undefined
    signal.throwIfAborted()
    this.#publishCompletionError(input, firstError)
    return Promise.resolve()
  }

  public reconcile (
    input: WorkerReconciliationInput<WorkerNode>,
    signal: AbortSignal
  ): WorkerTaskRecovery<WorkerNode> {
    signal.throwIfAborted()
    const { handle } = input
    const reserved = this.callbacks.reserve(input.ownedTaskIds, handle.lease)
    const { attributedTaskId } = getWorkerCrashAttribution(reserved)
    return new WorkerTaskRecovery(
      input,
      reserved,
      {
        apply: result => {
          this.callbacks.apply(result, handle.lease)
        },
        error: taskId =>
          buildWorkerReconciliationError(
            input,
            taskId,
            taskId === attributedTaskId
          ),
        finalize: () => {
          this.callbacks.executionFinished(handle.lease)
        },
        prepare: async phaseSignal => {
          phaseSignal.throwIfAborted()
          if (
            input.classification === 'faulted' &&
            input.previousState === 'awaitingReady' &&
            input.ownedTaskIds.length === 0 &&
            !handle.worker.info.dynamic
          ) {
            this.callbacks.rollbackStartup(handle.worker)
          }
          this.callbacks.detachQueued(handle)
          this.callbacks.drainPhysical(handle)
          this.callbacks.taskDequeued(handle.lease)
          if (input.classification === 'draining') {
            await this.callbacks.waitForDrain(handle.worker, phaseSignal)
            phaseSignal.throwIfAborted()
          }
        },
        reject: (reservation, error) =>
          this.callbacks.reject(
            reservation.taskId,
            handle.worker,
            error instanceof WorkerCrashError ||
              error instanceof WorkerTerminationError
              ? error
              : buildWorkerReconciliationError(
                input,
                reservation.taskId,
                reservation.taskId === attributedTaskId
              ),
            handle.lease
          ),
        restore: (reservations, error) =>
          this.callbacks.restore(reservations, taskId => {
            const failure = error(taskId)
            return failure instanceof WorkerCrashError ||
              failure instanceof WorkerTerminationError
              ? failure
              : new WorkerTerminationError(
                failure instanceof Error
                  ? failure.message
                  : 'Worker task could not be restored',
                {
                  taskId,
                  workerId: handle.lease.id,
                }
              )
          }),
      },
      input.classification === 'draining'
        ? this.callbacks.tasksFinishedTimeout()
        : undefined
    )
  }

  public replace (
    input: WorkerReplacementInput<WorkerNode>,
    signal: AbortSignal
  ): Promise<void> {
    try {
      signal.throwIfAborted()
      const existingWorkers = new Set(this.callbacks.workers())
      input.handle.worker.info.dynamic
        ? this.callbacks.createDynamic()
        : this.callbacks.replenishFixed()
      const replacement = this.callbacks
        .workers()
        .find(worker => !existingWorkers.has(worker))
      signal.throwIfAborted()
      if (replacement != null) {
        replacement.usage.tasks.executed +=
          input.handle.worker.usage.tasks.executed
        replacement.usage.tasks.failed += input.handle.worker.usage.tasks.failed
      }
      return Promise.resolve()
    } catch (error) {
      try {
        this.callbacks.publishError(error, input.handle.lease)
      } catch (reportingError) {
        this.callbacks.defer(reportingError, input.handle.lease)
      }
      // Deferred so the synchronous publishError completes before the throw propagates.
      return Promise.resolve().then(() => {
        throw error
      })
    }
  }

  public restore (
    reservations: readonly ReconciliationReservation[],
    source: WorkerLease
  ): void {
    const results = this.callbacks.restore(
      reservations,
      taskId =>
        new WorkerTerminationError(
          'Worker node terminated by pool (detached queued task could not be restored)',
          { taskId, workerId: source.id }
        )
    )
    for (const result of results) this.callbacks.apply(result, source)
  }

  public shouldReplace (input: WorkerReplacementInput<WorkerNode>): boolean {
    if (!this.callbacks.isRunning()) return false
    if (input.classification === 'faulted') {
      return (
        this.callbacks.restartWorkerOnError() && this.callbacks.attemptRestart()
      )
    }
    return !input.handle.worker.info.dynamic
  }

  #publishCompletionError (
    input: WorkerCompletionInput<WorkerNode>,
    firstError: undefined | WorkerCrashError | WorkerTerminationError
  ): void {
    const { transition } = input
    if (transition.classification === 'faulted') {
      const crashError =
        transition.cause instanceof WorkerCrashError
          ? transition.cause
          : transition.cause instanceof Error
            ? new WorkerCrashError(
                `Worker node crashed: ${transition.cause.message}`,
                {
                  cause: transition.cause,
                  exitCode: transition.exit?.code ?? null,
                  signal: transition.exit?.signal ?? null,
                  workerId: transition.handle.worker.info.id,
                }
            )
            : this.buildUnexpectedExitError(
              'lifecycle',
              transition.exit?.code ?? null,
              transition.exit?.signal,
              transition.handle.worker.info.id
            )
      this.callbacks.publishError(crashError, transition.handle.lease)
    } else if (firstError != null) {
      this.callbacks.publishError(firstError, transition.handle.lease)
    }
  }
}
