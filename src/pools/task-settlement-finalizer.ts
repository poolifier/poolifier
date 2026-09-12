import type { TaskUUID } from '../utility-types.js'
import type {
  AccountingEffect,
  SettlementResult,
  TaskRecord,
  TaskSettlement,
} from './lifecycle-types.js'

const cleanupTaskRecord = <Data, Response>(
  record: TaskRecord<Data, Response>
): readonly unknown[] => {
  const errors: unknown[] = []
  try {
    if (record.abortSignal != null && record.abortListener != null) {
      record.abortSignal.removeEventListener('abort', record.abortListener)
    }
  } catch (error) {
    // no-excuse-ok: catch -- AbortSignal removal may throw arbitrary values
    errors.push(error)
  }
  try {
    record.asyncResource?.emitDestroy()
  } catch (error) {
    // no-excuse-ok: catch -- AsyncResource cleanup may throw arbitrary values
    errors.push(error)
  }
  return errors
}

export const finalizeTaskSettlement = <Data, Response>(
  record: TaskRecord<Data, Response>,
  settlement: TaskSettlement<Response>,
  effect: AccountingEffect
): SettlementResult => {
  const secondaryErrors: unknown[] = []
  try {
    if (settlement.kind === 'resolved') {
      record.asyncResource != null
        ? record.asyncResource.runInAsyncScope(
          record.resolve,
          null,
          settlement.value
        )
        : record.resolve(settlement.value)
    } else {
      record.asyncResource != null
        ? record.asyncResource.runInAsyncScope(
          record.reject,
          null,
          settlement.error
        )
        : record.reject(settlement.error)
    }
  } catch (error) {
    // no-excuse-ok: catch -- settlement retains arbitrary callback values
    secondaryErrors.push(error)
  }
  secondaryErrors.push(...cleanupTaskRecord(record))
  return { effect, secondaryErrors, settled: true }
}

export const rollbackTaskRegistration = <Data, Response>(
  records: Map<TaskUUID, TaskRecord<Data, Response>>,
  record: TaskRecord<Data, Response>
): void => {
  const taskId = record.task.taskId
  if (records.get(taskId) !== record) return
  records.delete(taskId)
  cleanupTaskRecord(record)
}
