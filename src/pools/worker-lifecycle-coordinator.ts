import type {
  DispatchPermit,
  LifecycleWorker,
  TopologyChangeListener,
  WorkerExit,
  WorkerHandle,
  WorkerLifecycleCallbacks,
  WorkerLifecycleCommand,
  WorkerLifecycleSlot,
  WorkerReconciliationClassification,
  WorkerReconciliationResult,
  WorkerState,
  WorkerTerminalObservation,
} from './lifecycle-types.js'

import {
  createWorkerReconciliationInput,
  missingReconciliationResult,
  synchronousPhaseSignal,
  workerHasActiveWork,
} from './worker-lifecycle-state.js'
import { WorkerLifecycleTerminalState } from './worker-lifecycle-terminal-state.js'
import { WorkerReconciler } from './worker-reconciler.js'
import { WorkerTopologyRegistry } from './worker-topology-registry.js'

export class WorkerLifecycleCoordinator<
  Worker extends LifecycleWorker = LifecycleWorker
> {
  public get topologyEpoch (): number {
    return this.#topology.epoch
  }

  readonly #callbacks: WorkerLifecycleCallbacks<Worker>
  readonly #reconciler: WorkerReconciler<Worker>
  readonly #terminalState: WorkerLifecycleTerminalState<Worker>
  readonly #topology = new WorkerTopologyRegistry<Worker>()

  public constructor (callbacks: WorkerLifecycleCallbacks<Worker>) {
    this.#callbacks = callbacks
    this.#reconciler = new WorkerReconciler(callbacks)
    this.#terminalState = new WorkerLifecycleTerminalState(
      this.#topology,
      callbacks.exclude
    )
  }

  public acquireDispatch (
    handle: WorkerHandle<Worker>
  ): DispatchPermit<Worker> | undefined {
    const state = this.state(handle)
    return state === 'awaitingReady' || state === 'ready'
      ? { handle, readiness: state }
      : undefined
  }

  public beginDrain (
    handle: WorkerHandle<Worker>,
    cause: unknown
  ): Promise<WorkerReconciliationResult> {
    return this.#start({
      allowReplacement: true,
      cause,
      classification: 'draining',
      handle,
    })
  }

  public classification (
    handle: WorkerHandle<Worker>
  ): undefined | WorkerReconciliationClassification {
    return this.#topology.slot(handle)?.terminalClassification
  }

  public exit (
    handle: WorkerHandle<Worker>,
    exit: WorkerExit
  ): Promise<WorkerReconciliationResult> {
    const slot = this.#topology.slot(handle)
    if (slot == null) {
      return Promise.resolve(missingReconciliationResult(handle.lease))
    }
    this.#terminalState.enrichExit(handle, exit)
    if (slot.reconciliation != null) return slot.reconciliation
    if (slot.terminalClassification != null) return this.reconcile(handle)
    return this.#start({
      allowReplacement: true,
      cause: slot.exit,
      classification:
        exit.code !== 0 ||
        exit.signal != null ||
        workerHasActiveWork(handle.worker)
          ? 'faulted'
          : 'exited',
      handle,
    })
  }

  public fault (
    handle: WorkerHandle<Worker>,
    cause: unknown
  ): Promise<WorkerReconciliationResult> {
    return this.#start({
      allowReplacement: true,
      cause,
      classification: 'faulted',
      handle,
    })
  }

  public finishProvisioning (handle: WorkerHandle<Worker>): boolean {
    const slot = this.#topology.slot(handle)
    if (slot?.state !== 'provisioning') return false
    slot.state = 'awaitingReady'
    return true
  }

  public handle (worker: Worker): undefined | WorkerHandle<Worker> {
    return this.#topology.handle(worker)
  }

  public isCurrent (handle: WorkerHandle<Worker>): boolean {
    return this.#topology.isCurrent(handle)
  }

  public isSchedulable (handle: WorkerHandle<Worker>): boolean {
    return this.state(handle) === 'ready'
  }

  public markReady (handle: WorkerHandle<Worker>): boolean {
    const slot = this.#topology.slot(handle)
    if (slot?.state !== 'awaitingReady') return false
    slot.state = 'ready'
    this.#topology.advance()
    return true
  }

  public promoteTerminalFault (
    handle: WorkerHandle<Worker>,
    cause: unknown,
    exit?: WorkerExit
  ): boolean {
    return this.#terminalState.promoteFault(handle, cause, exit)
  }

  public quarantine (
    handle: WorkerHandle<Worker>,
    cause: unknown,
    classification: Exclude<
      WorkerReconciliationClassification,
      'draining'
    > = 'faulted'
  ): boolean {
    return this.#terminalState.quarantine(handle, cause, classification)
  }

  public reconcile (
    handle: WorkerHandle<Worker>
  ): Promise<WorkerReconciliationResult> {
    const slot = this.#topology.slot(handle)
    if (slot == null || slot.state === 'removed') {
      return Promise.resolve(missingReconciliationResult(handle.lease))
    }
    if (slot.reconciliation != null) return slot.reconciliation
    const classification = slot.terminalClassification
    if (classification == null) {
      return Promise.resolve(missingReconciliationResult(handle.lease))
    }
    const previousState = slot.reconciliationPreviousState ?? slot.state
    delete slot.reconciliationPreviousState
    const command = {
      allowReplacement: true,
      cause: slot.cause,
      excluded: true,
      ...(slot.exclusionError != null && {
        exclusionError: slot.exclusionError,
      }),
      classification,
      handle,
    }
    slot.reconciliation = this.#reconcile(slot, command, previousState)
    return slot.reconciliation
  }

  public reconcileTerminal (
    handle: WorkerHandle<Worker>,
    observation: WorkerTerminalObservation
  ): Promise<WorkerReconciliationResult> {
    const slot = this.#topology.slot(handle)
    if (slot == null || slot.state === 'removed') {
      return Promise.resolve(missingReconciliationResult(handle.lease))
    }
    if (slot.terminalClassification === 'draining') {
      if (observation.exit != null) {
        this.#terminalState.enrichExit(handle, observation.exit)
      }
      return this.reconcile(handle)
    }
    slot.cause = observation.cause
    slot.terminalClassification = observation.classification
    slot.state = observation.classification
    if (observation.exit != null) {
      this.#terminalState.enrichExit(handle, observation.exit)
    }
    return this.reconcile(handle)
  }

  public register (worker: Worker): WorkerHandle<Worker> {
    return this.#topology.register(worker)
  }

  public remove (handle: WorkerHandle<Worker>): boolean {
    const slot = this.#topology.slot(handle)
    if (
      slot == null ||
      slot.state === 'removed' ||
      slot.reconciliation != null
    ) {
      return false
    }
    this.#topology.advance()
    this.#callbacks.exclude(handle, synchronousPhaseSignal)
    this.#callbacks.remove(handle, synchronousPhaseSignal)
    this.#topology.finalize(slot)
    return true
  }

  public resolve (handle: WorkerHandle<Worker>): undefined | Worker {
    return this.#topology.resolve(handle)
  }

  public setupFailed (
    handle: WorkerHandle<Worker>,
    cause: unknown
  ): Promise<WorkerReconciliationResult> {
    return this.beginDrain(handle, cause)
  }

  public snapshotHandles (): readonly WorkerHandle<Worker>[] {
    return this.#topology.snapshotHandles()
  }

  public snapshotPromises (): readonly Promise<WorkerReconciliationResult>[] {
    return this.#topology.snapshotPromises()
  }

  public snapshotReadyHandles (): readonly WorkerHandle<Worker>[] {
    return this.#topology.snapshotReadyHandles()
  }

  public state (handle: WorkerHandle<Worker>): undefined | WorkerState {
    return this.#topology.slot(handle)?.state
  }

  public subscribeTopologyChanges (
    listener: TopologyChangeListener
  ): () => void {
    return this.#topology.subscribe(listener)
  }

  #reconcile (
    slot: WorkerLifecycleSlot<Worker>,
    command: WorkerLifecycleCommand<Worker>,
    previousState: WorkerState
  ): Promise<WorkerReconciliationResult> {
    const transition = () =>
      createWorkerReconciliationInput(
        slot,
        {
          classification: slot.terminalClassification ?? command.classification,
          previousState,
        },
        this.#callbacks.snapshotOwnedWork(slot.handle.lease)
      )
    return this.#reconciler.reconcile({
      baseTransition: transition(),
      command,
      finalize: () => {
        this.#topology.finalize(slot)
      },
      transition,
    })
  }

  #start (
    command: WorkerLifecycleCommand<Worker>
  ): Promise<WorkerReconciliationResult> {
    const slot = this.#topology.slot(command.handle)
    if (slot == null || slot.state === 'removed') {
      return Promise.resolve(missingReconciliationResult(command.handle.lease))
    }
    if (slot.reconciliation != null) return slot.reconciliation
    const previousState = slot.state
    slot.cause = command.cause
    slot.state = command.classification
    slot.terminalClassification = command.classification
    this.#topology.advance()
    slot.reconciliation = this.#reconcile(slot, command, previousState)
    return slot.reconciliation
  }
}
