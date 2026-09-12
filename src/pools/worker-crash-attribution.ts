import type { TaskUUID } from '../utility-types.js'
import type { ReconciliationReservation } from './lifecycle-types.js'

import { isActiveTaskState } from './task-transition-decision.js'

type WorkerCrashAttribution = Readonly<{
  activeTaskIds: ReadonlySet<TaskUUID>
  attributedTaskId: TaskUUID | undefined
}>

export const getWorkerCrashAttribution = (
  reservations: readonly ReconciliationReservation[]
): WorkerCrashAttribution => {
  const activeTaskIds = new Set<TaskUUID>()
  for (const reservation of reservations) {
    if (isActiveTaskState(reservation.previousState)) {
      activeTaskIds.add(reservation.taskId)
    }
  }
  const attributedTaskId =
    activeTaskIds.size === 1 ? [...activeTaskIds][0] : undefined
  return { activeTaskIds, attributedTaskId }
}
