import type { IWorker, WorkerType } from './worker.js'

import { WorkerTerminationError } from './errors.js'
import { WorkerTypes } from './worker.js'

export const WORKER_TERMINATION_GRACE_MS = 5000

type TerminationOutcome =
  | Readonly<{ error: unknown; kind: 'failed' }>
  | Readonly<{ kind: 'completed' }>

type TerminationSignal =
  | Readonly<{ kind: 'disconnect' }>
  | Readonly<{ kind: 'exit' }>
  | Readonly<{ kind: 'grace-expired' }>

type WorkerSignal = Readonly<{
  promise: Promise<TerminationSignal>
  remove: () => void
}>

const observe = (promise: Promise<unknown>): Promise<TerminationOutcome> =>
  promise.then<TerminationOutcome, TerminationOutcome>(
    () => ({ kind: 'completed' }),
    (error: unknown) => ({ error, kind: 'failed' })
  )

const captureSignal = (
  worker: IWorker,
  event: 'disconnect' | 'exit'
): WorkerSignal => {
  let handler: (() => void) | undefined
  const promise = new Promise<TerminationSignal>(resolve => {
    handler = () => {
      resolve({ kind: event })
    }
    worker.once(event, handler)
  })
  return {
    promise,
    remove: () => {
      if (handler != null) worker.removeListener(event, handler)
    },
  }
}

const createGrace = (): Readonly<{
  clear: () => void
  promise: Promise<TerminationSignal>
}> => {
  let timeout: NodeJS.Timeout | undefined
  const promise = new Promise<TerminationSignal>(resolve => {
    timeout = setTimeout(() => {
      resolve({ kind: 'grace-expired' })
    }, WORKER_TERMINATION_GRACE_MS)
  })
  return {
    clear: () => {
      if (timeout != null) clearTimeout(timeout)
    },
    promise,
  }
}

const isWorkerAlreadyExitedError = (error: unknown): boolean =>
  error instanceof Error && 'code' in error && error.code === 'ESRCH'

const requestHardStop = (worker: IWorker): TerminationOutcome => {
  try {
    worker.kill?.('SIGKILL')
    return { kind: 'completed' }
  } catch (error) {
    return isWorkerAlreadyExitedError(error)
      ? { kind: 'completed' }
      : { error, kind: 'failed' }
  }
}

const requestThreadTermination = (
  worker: IWorker
): Promise<TerminationOutcome> | TerminationOutcome => {
  try {
    const termination = worker.terminate?.()
    return termination == null ? { kind: 'completed' } : observe(termination)
  } catch (error) {
    return { error, kind: 'failed' }
  }
}

const throwFailure = (outcome: TerminationOutcome): void => {
  if (outcome.kind === 'failed') throw outcome.error
}

const terminateClusterWorker = async (
  worker: IWorker,
  exit: WorkerSignal,
  grace: Promise<TerminationSignal>
): Promise<void> => {
  const disconnect = captureSignal(worker, 'disconnect')
  let requestFailure: TerminationOutcome | undefined
  try {
    worker.disconnect?.()
  } catch (error) {
    requestFailure = { error, kind: 'failed' }
  }
  try {
    if (requestFailure == null) {
      const selected = await Promise.race([
        exit.promise,
        disconnect.promise,
        grace,
      ])
      if (selected.kind === 'exit') return
    }
    const hardStopGrace = createGrace()
    try {
      const hardStop = requestHardStop(worker)
      const failure = requestFailure ?? hardStop
      if (hardStop.kind === 'failed') throwFailure(failure)
      const selected = await Promise.race([exit.promise, hardStopGrace.promise])
      if (selected.kind === 'exit') {
        throwFailure(failure)
        return
      }
      throwFailure(failure)
      throw new WorkerTerminationError(
        'Worker node termination was not confirmed',
        { workerId: worker.id }
      )
    } finally {
      hardStopGrace.clear()
    }
  } finally {
    disconnect.remove()
  }
}

const terminateThreadWorker = async (
  worker: IWorker,
  exit: WorkerSignal,
  grace: Promise<TerminationSignal>
): Promise<void> => {
  let requestFailure: TerminationOutcome | undefined
  try {
    worker.unref?.()
  } catch (error) {
    requestFailure = { error, kind: 'failed' }
  }
  const termination = requestThreadTermination(worker)
  const observedTermination = Promise.resolve(termination)
  const selected = await Promise.race(
    requestFailure == null
      ? [exit.promise, grace, observedTermination]
      : [grace, observedTermination]
  )
  const selectedOutcome =
    selected.kind === 'failed' ? selected : { kind: 'completed' as const }
  throwFailure(requestFailure ?? selectedOutcome)
}

export const terminateWorker = async (
  worker: IWorker,
  type: WorkerType,
  alreadyExited: boolean
): Promise<void> => {
  if (alreadyExited) return
  const exit = captureSignal(worker, 'exit')
  const grace = createGrace()
  try {
    switch (type) {
      case WorkerTypes.cluster:
        await terminateClusterWorker(worker, exit, grace.promise)
        break
      case WorkerTypes.thread:
        await terminateThreadWorker(worker, exit, grace.promise)
        break
      default: {
        const exhaustive: never = type
        throw new Error(`Unknown worker type '${String(exhaustive)}'`)
      }
    }
  } finally {
    grace.clear()
    exit.remove()
  }
}
