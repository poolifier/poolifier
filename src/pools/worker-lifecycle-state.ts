import type {
  LifecycleWorker,
  WorkerHandle,
  WorkerLease,
  WorkerLifecycleSlot,
  WorkerReconciliationClassification,
  WorkerReconciliationInput,
  WorkerReconciliationResult,
  WorkerState,
} from './lifecycle-types.js'

export const synchronousPhaseSignal = new AbortController().signal

type WorkerReconcileTransition = Readonly<{
  classification: WorkerReconciliationClassification
  previousState: WorkerState
}>

export const compareWorkerHandles = <Worker>(
  left: WorkerHandle<Worker>,
  right: WorkerHandle<Worker>
): number =>
    left.lease.id - right.lease.id ||
  left.lease.generation - right.lease.generation

export const createWorkerReconciliationInput = <Worker extends LifecycleWorker>(
  slot: WorkerLifecycleSlot<Worker>,
  transition: WorkerReconcileTransition,
  ownedTaskIds: WorkerReconciliationInput<Worker>['ownedTaskIds']
): WorkerReconciliationInput<Worker> => {
  const exit = slot.exit == null ? undefined : Object.freeze({ ...slot.exit })
  return Object.freeze({
    cause: slot.cause,
    classification: transition.classification,
    ...(exit != null && { exit }),
    handle: slot.handle,
    ownedTaskIds,
    previousState: transition.previousState,
  })
}

export const missingReconciliationResult = (
  lease: WorkerLease
): WorkerReconciliationResult => ({ cause: undefined, committed: false, lease })

export const workerHasActiveWork = (
  worker: LifecycleWorker & {
    readonly usage?: { readonly tasks?: { readonly executing?: number } }
  }
): boolean => (worker.usage?.tasks?.executing ?? 0) > 0
