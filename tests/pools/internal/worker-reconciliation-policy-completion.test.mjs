import { describe, expect, it, vi } from 'vitest'

import {
  WorkerCrashError,
  WorkerTerminationError,
} from '../../../lib/index.mjs'
import { WorkerReconciliationPolicy } from '../../../lib/pools/worker-reconciliation-policy.mjs'

const signal = new AbortController().signal

const createFixture = () => {
  const callbacks = {
    apply: vi.fn(),
    createDynamic: vi.fn(),
    defer: vi.fn(),
    detachQueued: vi.fn(),
    drainPhysical: vi.fn(),
    executionFinished: vi.fn(),
    isRunning: vi.fn(() => true),
    publishError: vi.fn(),
    reject: vi.fn(() => true),
    replenishFixed: vi.fn(),
    reserve: vi.fn(() => []),
    restartWorkerOnError: vi.fn(() => true),
    restore: vi.fn(() => []),
    rollbackStartup: vi.fn(),
    taskDequeued: vi.fn(),
    tasksFinishedTimeout: vi.fn(() => 2000),
    waitForDrain: vi.fn(() => Promise.resolve()),
    workers: vi.fn(() => []),
  }
  const worker = {
    info: { dynamic: false, id: 7 },
    usage: { tasks: { executed: 0, failed: 0 } },
  }
  const handle = { lease: { generation: 1, id: 7 }, worker }
  return {
    callbacks,
    handle,
    policy: new WorkerReconciliationPolicy(callbacks),
  }
}

describe('WorkerReconciliationPolicy completion precedence', () => {
  it('prefers promoted transition crash over stale termination value', async () => {
    const { callbacks, handle, policy } = createFixture()
    const promotedCrash = new WorkerCrashError('worker crashed', {
      exitCode: 9,
      signal: 'SIGKILL',
      workerId: handle.lease.id,
    })
    const staleTermination = new WorkerTerminationError('pool termination', {
      workerId: handle.lease.id,
    })

    await policy.complete(
      {
        reconciliationValue: staleTermination,
        transition: {
          cause: promotedCrash,
          classification: 'faulted',
          exit: { code: 9, signal: 'SIGKILL' },
          handle,
          ownedTaskIds: [],
          previousState: 'ready',
        },
      },
      signal
    )

    expect(callbacks.publishError).toHaveBeenCalledExactlyOnceWith(
      promotedCrash,
      handle.lease
    )
  })

  it('preserves the raw cause for a faulted completion without owned tasks', async () => {
    const { callbacks, handle, policy } = createFixture()
    const rawCause = new Error('raw exit')

    await policy.complete(
      {
        reconciliationValue: undefined,
        transition: {
          cause: rawCause,
          classification: 'faulted',
          handle,
          ownedTaskIds: [],
          previousState: 'ready',
        },
      },
      signal
    )

    expect(callbacks.publishError).toHaveBeenCalledOnce()
    const published = callbacks.publishError.mock.calls[0][0]
    expect(published).toBeInstanceOf(WorkerCrashError)
    expect(published.cause).toBe(rawCause)
  })

  it('preserves the raw cause after all faulted work is recovered', async () => {
    const { callbacks, handle, policy } = createFixture()
    const rawCause = new Error('raw exit')

    await policy.complete(
      {
        reconciliationValue: undefined,
        transition: {
          cause: rawCause,
          classification: 'faulted',
          handle,
          ownedTaskIds: ['00000000-0000-4000-8000-000000000001'],
          previousState: 'ready',
        },
      },
      signal
    )

    expect(callbacks.publishError).toHaveBeenCalledOnce()
    const published = callbacks.publishError.mock.calls[0][0]
    expect(published).toBeInstanceOf(WorkerCrashError)
    expect(published.cause).toBe(rawCause)
  })

  it('publishes a transition crash without a task over a task reconciliation value', async () => {
    const { callbacks, handle, policy } = createFixture()
    const rawCause = new Error('named transition raw crash')
    const reconciliationCrash = new WorkerCrashError('reserved task crash', {
      taskId: '00000000-0000-4000-8000-000000000001',
      workerId: handle.lease.id,
    })

    await policy.complete(
      {
        reconciliationValue: reconciliationCrash,
        transition: {
          cause: rawCause,
          classification: 'faulted',
          handle,
          ownedTaskIds: [],
          previousState: 'ready',
        },
      },
      signal
    )

    expect(callbacks.publishError).toHaveBeenCalledOnce()
    const published = callbacks.publishError.mock.calls[0][0]
    expect(published).toBeInstanceOf(WorkerCrashError)
    expect(published).not.toBe(reconciliationCrash)
    expect(published.message).toBe(
      'Worker node crashed: named transition raw crash'
    )
    expect(published.cause).toBe(rawCause)
    expect(published.workerId).toBe(handle.lease.id)
    expect(published.taskId).toBeUndefined()
    expect(callbacks.publishError.mock.calls[0][1]).toBe(handle.lease)
  })

  it('synthesizes a crash when neither completion source contains one', async () => {
    const { callbacks, handle, policy } = createFixture()
    const staleTermination = new WorkerTerminationError('draining timeout', {
      workerId: handle.lease.id,
    })

    await policy.complete(
      {
        reconciliationValue: staleTermination,
        transition: {
          cause: 'abnormal exit',
          classification: 'faulted',
          exit: { code: 7, signal: 'SIGTERM' },
          handle,
          ownedTaskIds: [],
          previousState: 'ready',
        },
      },
      signal
    )

    expect(callbacks.publishError).toHaveBeenCalledOnce()
    const published = callbacks.publishError.mock.calls[0][0]
    expect(published).toBeInstanceOf(WorkerCrashError)
    expect(published).not.toBe(staleTermination)
    expect(published).toMatchObject({
      exitCode: 7,
      signal: 'SIGTERM',
      workerId: handle.lease.id,
    })
    expect(callbacks.publishError.mock.calls[0][1]).toBe(handle.lease)
  })

  it('preserves non-faulted termination completion', async () => {
    const { callbacks, handle, policy } = createFixture()
    const termination = new WorkerTerminationError('clean termination', {
      workerId: handle.lease.id,
    })

    await policy.complete(
      {
        reconciliationValue: termination,
        transition: {
          cause: termination,
          classification: 'exited',
          exit: { code: 0, signal: null },
          handle,
          ownedTaskIds: [],
          previousState: 'ready',
        },
      },
      signal
    )

    expect(callbacks.publishError).toHaveBeenCalledExactlyOnceWith(
      termination,
      handle.lease
    )
  })
})
