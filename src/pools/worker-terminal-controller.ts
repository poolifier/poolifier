import type {
  LifecycleWorker,
  WorkerHandle,
  WorkerLease,
  WorkerReconciliationResult,
} from './lifecycle-types.js'

import { type WorkerCrashError, WorkerTerminationError } from './errors.js'
import { TerminalSignalAggregator } from './terminal-signal-aggregator.js'
import { WorkerLifecycleCoordinator } from './worker-lifecycle-coordinator.js'
import {
  buildUnexpectedExitError,
  buildWorkerCrashError,
  buildWorkerTaskCrashError,
} from './worker-reconciliation-error-builders.js'
import { waitForWorkerTransportDrain } from './worker-transport-drain.js'

interface TerminalWorker extends LifecycleWorker {
  readonly usage: { readonly tasks: { readonly executing: number } }
}

interface WorkerTerminalCallbacks<Worker extends TerminalWorker> {
  readonly isAbnormalExit: (
    exitCode: null | number,
    signal: NodeJS.Signals | null | undefined,
    workerId: number | undefined
  ) => boolean
  readonly rejectOwnedTasks: (
    handle: WorkerHandle<Worker>,
    error: WorkerCrashError
  ) => WorkerCrashError
  readonly rejectTaskFunctionRequests: (
    handle: WorkerHandle<Worker>,
    error: Error
  ) => void
  readonly track: (
    lease: WorkerLease,
    reconciliation: Promise<WorkerReconciliationResult>
  ) => void
}

export class WorkerTerminalController<Worker extends TerminalWorker> {
  readonly #aggregators = new WeakMap<Worker, TerminalSignalAggregator>()
  readonly #crashErrors = new WeakMap<Worker, WorkerCrashError>()
  readonly #expectedExits = new WeakSet<Worker>()

  public constructor (
    private readonly coordinator: WorkerLifecycleCoordinator<Worker>,
    private readonly callbacks: WorkerTerminalCallbacks<Worker>
  ) {}

  public error (handle: WorkerHandle<Worker>, cause: Error): void {
    const classification = this.coordinator.classification(handle)
    const promoted =
      classification === 'draining' || classification === 'exited'
    const crashError = this.#rejectCrash(
      handle,
      buildWorkerCrashError(cause, handle.worker.info.id)
    )
    this.callbacks.track(
      handle.lease,
      this.#aggregator(handle).error(promoted ? crashError : cause)
    )
  }

  public exit (
    handle: WorkerHandle<Worker>,
    exitCode: null | number,
    signal?: NodeJS.Signals | null
  ): void {
    const exit = { code: exitCode, signal }
    if (this.#expectedExits.has(handle.worker)) {
      this.callbacks.track(handle.lease, this.coordinator.exit(handle, exit))
      return
    }
    const classification = this.coordinator.classification(handle)
    const promoted =
      classification === 'draining' || classification === 'exited'
    const abnormal = this.callbacks.isAbnormalExit(
      exitCode,
      signal,
      handle.worker.info.id
    )
    const faulted = abnormal || handle.worker.usage.tasks.executing > 0
    if (faulted) {
      const reentry = this.#crashErrors.has(handle.worker)
      const crashError = this.#rejectCrash(
        handle,
        buildUnexpectedExitError(
          'lifecycle',
          exitCode,
          signal,
          handle.worker.info.id
        ),
        exit
      )
      if (reentry) {
        this.coordinator.exit(handle, exit).catch(() => undefined)
      }
      this.callbacks.track(
        handle.lease,
        this.#aggregator(handle).exit(exit, true, promoted ? crashError : exit)
      )
      return
    }
    if (classification === 'draining' || classification === 'exited') {
      this.callbacks.track(handle.lease, this.coordinator.exit(handle, exit))
      return
    }
    const error = new WorkerTerminationError('Worker node terminated', {
      workerId: handle.lease.id,
    })
    this.callbacks.rejectTaskFunctionRequests(handle, error)
    this.callbacks.track(
      handle.lease,
      this.#aggregator(handle).exit(exit, false, exit)
    )
  }

  public async terminate (
    handle: WorkerHandle<Worker>,
    operation: () => Promise<void>
  ): Promise<void> {
    this.#expectedExits.add(handle.worker)
    try {
      await operation()
    } finally {
      this.#expectedExits.delete(handle.worker)
    }
  }

  #aggregator (handle: WorkerHandle<Worker>): TerminalSignalAggregator {
    const existing = this.#aggregators.get(handle.worker)
    if (existing != null) return existing
    const aggregator = new TerminalSignalAggregator({
      quarantine: observation => {
        this.coordinator.quarantine(
          handle,
          observation.cause,
          observation.classification
        )
      },
      reconcile: async observation =>
        await this.coordinator.reconcileTerminal(handle, observation),
      waitForTransportDrain: async () => {
        await waitForWorkerTransportDrain(handle.worker)
      },
    })
    this.#aggregators.set(handle.worker, aggregator)
    return aggregator
  }

  #rejectCrash (
    handle: WorkerHandle<Worker>,
    baseError: WorkerCrashError,
    exit?: { code: null | number; signal?: NodeJS.Signals | null }
  ): WorkerCrashError {
    const existing = this.#crashErrors.get(handle.worker)
    if (existing != null) return existing
    const classification = this.coordinator.classification(handle)
    if (classification === 'draining' || classification === 'exited') {
      this.callbacks.rejectOwnedTasks(handle, baseError)
    }
    this.#crashErrors.set(handle.worker, baseError)
    this.callbacks.rejectTaskFunctionRequests(
      handle,
      buildWorkerTaskCrashError(baseError, baseError.workerId)
    )
    if (classification === 'draining' || classification === 'exited') {
      exit == null
        ? this.coordinator.promoteTerminalFault(handle, baseError)
        : this.coordinator.promoteTerminalFault(handle, baseError, exit)
    }
    return baseError
  }
}
