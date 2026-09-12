import type {
  LifecycleWorker,
  WorkerExit,
  WorkerHandle,
  WorkerLifecycleCallbacks,
  WorkerReconciliationClassification,
} from './lifecycle-types.js'

import { synchronousPhaseSignal } from './worker-lifecycle-state.js'
import { WorkerTopologyRegistry } from './worker-topology-registry.js'

export class WorkerLifecycleTerminalState<
  Worker extends LifecycleWorker = LifecycleWorker
> {
  public constructor (
    private readonly topology: WorkerTopologyRegistry<Worker>,
    private readonly exclude: WorkerLifecycleCallbacks<Worker>['exclude']
  ) {}

  public enrichExit (handle: WorkerHandle<Worker>, exit: WorkerExit): void {
    const slot = this.topology.slot(handle)
    if (slot == null) return
    slot.exit ??= { code: exit.code, signal: exit.signal }
    slot.exit.code ??= exit.code
    slot.exit.signal ??= exit.signal
  }

  public promoteFault (
    handle: WorkerHandle<Worker>,
    cause: unknown,
    exit?: WorkerExit
  ): boolean {
    const slot = this.topology.slot(handle)
    if (
      slot == null ||
      !this.topology.isCurrent(handle) ||
      (slot.state !== 'draining' && slot.state !== 'exited')
    ) {
      return false
    }
    if (exit != null) this.enrichExit(handle, exit)
    slot.cause = cause
    slot.state = 'faulted'
    slot.terminalClassification = 'faulted'
    this.topology.advance()
    return true
  }

  public quarantine (
    handle: WorkerHandle<Worker>,
    cause: unknown,
    classification: Exclude<
      WorkerReconciliationClassification,
      'draining'
    > = 'faulted'
  ): boolean {
    const slot = this.topology.slot(handle)
    if (
      slot == null ||
      slot.state === 'removed' ||
      slot.terminalClassification != null
    ) {
      return false
    }
    slot.cause = cause
    slot.reconciliationPreviousState = slot.state
    slot.state = classification
    slot.terminalClassification = classification
    this.topology.advance()
    try {
      this.exclude(handle, synchronousPhaseSignal)
    } catch (error) {
      slot.exclusionError = error
    }
    return true
  }
}
