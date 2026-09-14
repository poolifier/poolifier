import type { TaskRecord, TaskState, WorkerLease } from './lifecycle-types.js'

export type TaskTransitionDecision =
  | Readonly<{
    currentLease: undefined | WorkerLease
    ok: true
    previous: TaskState
  }>
  | Readonly<{ ok: false }>

export const sameWorkerLease = (
  left: undefined | WorkerLease,
  right: WorkerLease
): boolean => left?.id === right.id && left.generation === right.generation

export const decideTaskTransition = <Data, Response>(
  record: Readonly<TaskRecord<Data, Response>>,
  expected: readonly TaskState[],
  legalNextStates: readonly TaskState[],
  next: TaskState,
  lease?: WorkerLease
): TaskTransitionDecision => {
  const currentLease = record.currentLease ?? lease
  const requiresLease =
    next === 'assigned' ||
    next === 'cancelling' ||
    next === 'dispatching' ||
    next === 'queued' ||
    next === 'reconciling' ||
    next === 'running'
  if (
    record.state === 'settled' ||
    !expected.includes(record.state) ||
    !legalNextStates.some(state => state === next) ||
    (record.currentLease != null &&
      lease != null &&
      !sameWorkerLease(record.currentLease, lease)) ||
    next === 'settled' ||
    (requiresLease && currentLease == null) ||
    (next === 'detached' && lease != null)
  ) {
    return { ok: false }
  }
  return { currentLease, ok: true, previous: record.state }
}

export const isActiveTaskState = (state: TaskState): boolean =>
  state === 'dispatching' || state === 'running' || state === 'cancelling'

export const isOwnedWorkState = (state: TaskState): boolean =>
  state === 'waitingReady' ||
  state === 'assigned' ||
  state === 'dispatching' ||
  state === 'queued' ||
  state === 'running' ||
  state === 'cancelling'
