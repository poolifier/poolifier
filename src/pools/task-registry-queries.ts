import type { TaskUUID } from '../utility-types.js'
import type { TaskRecord, WorkerLease } from './lifecycle-types.js'

import {
  isOwnedWorkState,
  sameWorkerLease,
} from './task-transition-decision.js'

const hasTaskByLease = <Data, Response>(
  records: ReadonlyMap<TaskUUID, TaskRecord<Data, Response>>,
  lease: WorkerLease,
  matches: (record: TaskRecord<Data, Response>) => boolean
): boolean => {
  for (const record of records.values()) {
    if (sameWorkerLease(record.currentLease, lease) && matches(record)) {
      return true
    }
  }
  return false
}

export const hasActiveExecution = <Data, Response>(
  records: ReadonlyMap<TaskUUID, TaskRecord<Data, Response>>,
  lease: WorkerLease
): boolean =>
    hasTaskByLease(
      records,
      lease,
      record =>
        record.state === 'dispatching' ||
      record.state === 'running' ||
      record.state === 'cancelling'
    )

export const hasOwnedWork = <Data, Response>(
  records: ReadonlyMap<TaskUUID, TaskRecord<Data, Response>>,
  lease: WorkerLease
): boolean => {
  return hasTaskByLease(records, lease, record =>
    isOwnedWorkState(record.state)
  )
}

export const snapshotTasksByLease = <Data, Response>(
  records: ReadonlyMap<TaskUUID, TaskRecord<Data, Response>>,
  lease: WorkerLease
): readonly TaskUUID[] =>
    [...records]
      .filter(
        ([, record]) =>
          sameWorkerLease(record.currentLease, lease) ||
        ((record.state === 'registered' || record.state === 'detached') &&
          sameWorkerLease(record.selectedLease, lease))
      )
      .map(([taskId]) => taskId)

export const snapshotActiveReconciliationTaskIds = <Data, Response>(
  records: ReadonlyMap<TaskUUID, TaskRecord<Data, Response>>,
  taskIds: readonly TaskUUID[],
  lease: WorkerLease
): readonly TaskUUID[] =>
    [...new Set(taskIds)].filter(taskId => {
      const record = records.get(taskId)
      return (
        record?.state === 'reconciling' &&
      record.activeOnReconciliation === true &&
      sameWorkerLease(record.currentLease, lease)
      )
    })

export const snapshotWaitingReadyTasks = <Data, Response>(
  records: ReadonlyMap<TaskUUID, TaskRecord<Data, Response>>,
  lease: WorkerLease
): readonly TaskUUID[] =>
    [...records]
      .filter(
        ([, record]) =>
          record.state === 'waitingReady' &&
        sameWorkerLease(record.currentLease, lease)
      )
      .map(([taskId]) => taskId)
