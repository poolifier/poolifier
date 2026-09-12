import { expect, it } from 'vitest'

import { WorkerCrashError } from '../../../lib/index.mjs'
import { WorkerReconciliationPolicy } from '../../../lib/pools/worker-reconciliation-policy.mjs'
import {
  createCallbacks,
  signal,
} from './worker-reconciliation-policy-fixture.mjs'

it.each([
  ['dispatching', true, false],
  ['running', true, false],
  ['cancelling', true, false],
  ['registered', false, true],
  ['waitingReady', false, true],
  ['queued', false, true],
  ['assigned', false, false],
  ['detached', false, true],
])(
  'scopes raw crash details for reserved %s tasks',
  async (previousState, retainsCause, recoverable) => {
    const taskId = '00000000-0000-0000-0000-000000000c01'
    const lease = { generation: 3, id: 17 }
    const rawCause = new Error('reservation raw sentinel')
    const callbacks = createCallbacks()
    callbacks.reserve.mockReturnValue([{ lease, previousState, taskId }])
    const policy = new WorkerReconciliationPolicy(callbacks)
    const worker = { info: { dynamic: false, id: 17 }, usage: { tasks: {} } }

    const recovery = policy.reconcile(
      {
        cause: rawCause,
        classification: 'faulted',
        exit: { code: 23, signal: 'SIGTERM' },
        handle: { lease, worker },
        ownedTaskIds: [taskId],
        previousState: 'ready',
      },
      signal
    )
    await recovery.prepare(signal)
    if (recoverable) recovery.finalizeResidual(signal)

    expect(callbacks.reject).toHaveBeenCalledOnce()
    const rejected = callbacks.reject.mock.calls[0][2]
    expect(rejected).toBeInstanceOf(WorkerCrashError)
    expect(rejected.taskId).toBe(taskId)
    expect(rejected.workerId).toBe(17)
    expect(rejected.exitCode).toBe(23)
    expect(rejected.signal).toBe('SIGTERM')
    if (retainsCause) {
      expect(rejected.message).toBe(
        'Worker node crashed: reservation raw sentinel'
      )
      expect(rejected.cause).toBe(rawCause)
    } else {
      expect(rejected.message).toBe('Worker node crashed')
      expect(Object.hasOwn(rejected, 'cause')).toBe(false)
      expect(rejected.message).not.toContain('reservation raw sentinel')
      expect(rejected.stack).not.toContain('reservation raw sentinel')
    }
  }
)

it.each([
  [['running', 'queued'], '00000000-0000-0000-0000-000000000d01'],
  [['dispatching', 'cancelling'], undefined],
  [['running', 'dispatching', 'queued'], undefined],
  [['queued', 'assigned'], undefined],
])(
  'attributes raw crash details to one active reservation: %j',
  async (previousStates, rawTaskId) => {
    const taskIds = previousStates.map(
      (_, index) => `00000000-0000-0000-0000-000000000d0${index + 1}`
    )
    const lease = { generation: 6, id: 23 }
    const rawCause = new Error('multi-reservation raw sentinel')
    const callbacks = createCallbacks()
    callbacks.reserve.mockReturnValue(
      previousStates.map((previousState, index) => ({
        lease,
        previousState,
        taskId: taskIds[index],
      }))
    )
    const policy = new WorkerReconciliationPolicy(callbacks)
    const worker = {
      info: { dynamic: false, id: lease.id },
      usage: { tasks: {} },
    }

    const recovery = policy.reconcile(
      {
        cause: rawCause,
        classification: 'faulted',
        exit: { code: 29, signal: 'SIGTERM' },
        handle: { lease, worker },
        ownedTaskIds: taskIds,
        previousState: 'ready',
      },
      signal
    )
    await recovery.prepare(signal)
    recovery.finalizeResidual(signal)

    const rejectedByTaskId = new Map(
      callbacks.reject.mock.calls.map(([taskId, , error]) => [taskId, error])
    )
    expect(rejectedByTaskId.size).toBe(taskIds.length)
    for (const taskId of taskIds) {
      const rejected = rejectedByTaskId.get(taskId)
      expect(rejected).toBeInstanceOf(WorkerCrashError)
      expect(rejected.taskId).toBe(taskId)
      expect(rejected.workerId).toBe(lease.id)
      expect(rejected.exitCode).toBe(29)
      expect(rejected.signal).toBe('SIGTERM')
      if (taskId === rawTaskId) {
        expect(rejected.message).toBe(
          'Worker node crashed: multi-reservation raw sentinel'
        )
        expect(rejected.cause).toBe(rawCause)
      } else {
        expect(rejected.message).toBe('Worker node crashed')
        expect(Object.hasOwn(rejected, 'cause')).toBe(false)
        expect(rejected.message).not.toContain('multi-reservation raw sentinel')
        expect(rejected.stack).not.toContain('multi-reservation raw sentinel')
      }
    }
    const rejectedErrors = [...rejectedByTaskId.values()]
    expect(new Set(rejectedErrors).size).toBe(rejectedErrors.length)
  }
)

it.each([
  ['missing ownership', '00000000-0000-0000-0000-000000000c03'],
  ['non-active ownership', '00000000-0000-0000-0000-000000000c02'],
])('sanitizes failed restoration with %s', async (_ownership, failedTaskId) => {
  const taskId = '00000000-0000-0000-0000-000000000c02'
  const lease = { generation: 5, id: 19 }
  const rawCause = new Error('restoration raw sentinel')
  const callbacks = createCallbacks()
  callbacks.reserve.mockReturnValue([
    { lease, previousState: 'queued', taskId },
  ])
  let restorationError
  callbacks.restore.mockImplementation((_reservations, error) => {
    restorationError = error(failedTaskId)
    return [{ kind: 'settled', taskId }]
  })
  const policy = new WorkerReconciliationPolicy(callbacks)
  const worker = { info: { dynamic: false, id: 19 }, usage: { tasks: {} } }

  const recovery = policy.reconcile(
    {
      cause: rawCause,
      classification: 'faulted',
      exit: { code: 29, signal: 'SIGKILL' },
      handle: { lease, worker },
      ownedTaskIds: [taskId],
      previousState: 'ready',
    },
    signal
  )
  await recovery.prepare(signal)
  await recovery.restore(signal)

  expect(restorationError).toBeInstanceOf(WorkerCrashError)
  expect(restorationError.message).toBe('Worker node crashed')
  expect(Object.hasOwn(restorationError, 'cause')).toBe(false)
  expect(restorationError.message).not.toContain('restoration raw sentinel')
  expect(restorationError.stack).not.toContain('restoration raw sentinel')
  expect(restorationError.taskId).toBe(failedTaskId)
  expect(restorationError.workerId).toBe(19)
  expect(restorationError.exitCode).toBe(29)
  expect(restorationError.signal).toBe('SIGKILL')
})
