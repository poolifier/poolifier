import type { TaskUUID } from '../utility-types.js'
import type {
  LifecycleWorker,
  WorkerReconciliationInput,
} from './lifecycle-types.js'

import { WorkerCrashError, WorkerTerminationError } from './errors.js'
import { formatExitDetail } from './utils.js'

export const buildWorkerCrashError = (
  cause: Error,
  workerId: number | undefined,
  taskId?: TaskUUID
): WorkerCrashError =>
  cause instanceof WorkerCrashError
    ? new WorkerCrashError(cause.message, {
      cause: cause.cause instanceof Error ? cause.cause : undefined,
      exitCode: cause.exitCode,
      signal: cause.signal,
      taskId,
      workerId,
    })
    : new WorkerCrashError(`Worker node crashed: ${cause.message}`, {
      cause,
      exitCode: null,
      signal: null,
      taskId,
      workerId,
    })

export const buildWorkerTaskCrashError = (
  cause: Error,
  workerId: number | undefined,
  taskId?: TaskUUID,
  isCrashAttributed = false
): WorkerCrashError =>
  isCrashAttributed
    ? buildWorkerCrashError(cause, workerId, taskId)
    : new WorkerCrashError('Worker node crashed', {
      exitCode: cause instanceof WorkerCrashError ? cause.exitCode : null,
      signal: cause instanceof WorkerCrashError ? cause.signal : null,
      taskId,
      workerId,
    })

export const buildWorkerReconciliationError = <Worker extends LifecycleWorker>(
  transition: WorkerReconciliationInput<Worker>,
  taskId: TaskUUID,
  isCrashAttributed: boolean
): WorkerCrashError | WorkerTerminationError => {
  if (transition.classification !== 'faulted') {
    return new WorkerTerminationError('Worker node terminated by pool', {
      taskId,
      workerId: transition.handle.lease.id,
    })
  }
  const cause =
    transition.cause instanceof WorkerCrashError
      ? transition.cause
      : transition.cause instanceof Error
        ? new WorkerCrashError(
            `Worker node crashed: ${transition.cause.message}`,
            {
              cause: transition.cause,
              exitCode: transition.exit?.code ?? null,
              signal: transition.exit?.signal ?? null,
              workerId: transition.handle.lease.id,
            }
        )
        : buildUnexpectedExitError(
          'lifecycle',
          transition.exit?.code ?? null,
          transition.exit?.signal,
          transition.handle.lease.id
        )
  return buildWorkerTaskCrashError(
    cause,
    transition.handle.worker.info.id,
    taskId,
    isCrashAttributed
  )
}

export const buildUnexpectedExitError = (
  context: 'lifecycle' | 'teardown',
  exitCode: null | number,
  signal: NodeJS.Signals | null | undefined,
  workerId: number | undefined
): WorkerCrashError => {
  const where = context === 'teardown' ? ' during teardown' : ''
  return new WorkerCrashError(
    `Worker node exited unexpectedly${where} (${formatExitDetail(exitCode, signal)})`,
    { exitCode, signal, workerId }
  )
}
