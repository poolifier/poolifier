import { expect, it } from 'vitest'

import {
  WorkerCrashError,
  WorkerTerminationError,
} from '../../../lib/index.mjs'
import { WorkerReconciliationPolicy } from '../../../lib/pools/worker-reconciliation-policy.mjs'
import {
  createCallbacks,
  signal,
} from './worker-reconciliation-policy-fixture.mjs'

it('keeps lease ownership outside replacement policy', () => {
  const callbacks = createCallbacks()
  const policy = new WorkerReconciliationPolicy(callbacks)
  const worker = { info: { dynamic: true }, usage: { tasks: {} } }
  const input = {
    classification: 'faulted',
    handle: { lease: { generation: 3, id: 9 }, worker },
  }

  expect(policy.shouldReplace(input)).toBe(true)
  expect(callbacks.createDynamic).not.toHaveBeenCalled()
})

it.each([
  ['dynamic', true, 'createDynamic'],
  ['fixed', false, 'replenishFixed'],
])(
  'publishes and rethrows the exact %s replacement failure',
  async (_kind, dynamic, replacementHook) => {
    const failure = { replacement: replacementHook }
    const callbacks = createCallbacks()
    callbacks[replacementHook].mockImplementation(() => {
      throw failure
    })
    const policy = new WorkerReconciliationPolicy(callbacks)
    const lease = { generation: 3, id: 9 }
    const worker = {
      info: { dynamic },
      usage: { tasks: { executed: 1, failed: 2 } },
    }

    const rejected = await Promise.resolve()
      .then(() =>
        policy.replace(
          {
            classification: 'faulted',
            handle: { lease, worker },
          },
          signal
        )
      )
      .catch(error => error)

    expect(callbacks.publishError).toHaveBeenCalledWith(failure, lease)
    expect(rejected).toBe(failure)
  }
)

it('preserves the replacement failure when error publication also throws', async () => {
  const primary = { replacement: 'failed' }
  const publicationFailure = new Error('publication failed')
  const lease = { generation: 1, id: 1 }
  const callbacks = createCallbacks()
  callbacks.replenishFixed.mockImplementation(() => {
    throw primary
  })
  callbacks.publishError.mockImplementation(() => {
    throw publicationFailure
  })
  const policy = new WorkerReconciliationPolicy(callbacks)

  const rejected = await Promise.resolve()
    .then(() =>
      policy.replace(
        {
          classification: 'faulted',
          handle: {
            lease,
            worker: {
              info: { dynamic: false },
              usage: { tasks: { executed: 0, failed: 0 } },
            },
          },
        },
        signal
      )
    )
    .catch(error => error)

  expect(callbacks.publishError).toHaveBeenCalledExactlyOnceWith(primary, lease)
  expect(rejected).toBe(primary)
  expect(callbacks.defer).toHaveBeenCalledExactlyOnceWith(
    publicationFailure,
    lease
  )
})

it('publishes and rethrows replacement accounting failures', async () => {
  const failure = new Error('replacement accounting failed')
  const callbacks = createCallbacks()
  const source = {
    info: { dynamic: false },
    usage: { tasks: { executed: 1, failed: 2 } },
  }
  const replacementTasks = { failed: 0 }
  Object.defineProperty(replacementTasks, 'executed', {
    get: () => 0,
    set: () => {
      throw failure
    },
  })
  const replacement = {
    info: { dynamic: false },
    usage: { tasks: replacementTasks },
  }
  callbacks.workers
    .mockReturnValueOnce([source])
    .mockReturnValue([source, replacement])
  const policy = new WorkerReconciliationPolicy(callbacks)
  const lease = { generation: 1, id: 1 }

  const rejected = await Promise.resolve()
    .then(() =>
      policy.replace(
        {
          classification: 'faulted',
          handle: { lease, worker: source },
        },
        signal
      )
    )
    .catch(error => error)

  expect(callbacks.publishError).toHaveBeenCalledWith(failure, lease)
  expect(rejected).toBe(failure)
})

it('commits reconciliation preparation before physical drain', async () => {
  const callbacks = createCallbacks()
  const policy = new WorkerReconciliationPolicy(callbacks)
  const worker = { info: { dynamic: false } }
  const handle = { lease: { generation: 1, id: 2 }, worker }

  const recovery = policy.reconcile(
    {
      classification: 'faulted',
      handle,
      ownedTaskIds: ['task'],
      previousState: 'ready',
    },
    signal
  )
  await recovery.prepare(signal)
  expect(callbacks.reserve).toHaveBeenCalledBefore(callbacks.drainPhysical)
  expect(callbacks.drainPhysical).toHaveBeenCalledBefore(callbacks.reject)
  expect(callbacks.taskDequeued).toHaveBeenCalledWith(handle.lease)
  expect(callbacks.executionFinished).not.toHaveBeenCalled()

  recovery.finalizeResidual(signal)

  expect(callbacks.reject).toHaveBeenCalledBefore(callbacks.executionFinished)
  expect(callbacks.executionFinished).toHaveBeenCalledOnce()
  expect(callbacks.executionFinished).toHaveBeenCalledWith(handle.lease)
})

it('does not finish execution after a timed-out drain preparation resumes', async () => {
  const callbacks = createCallbacks()
  const gate = Promise.withResolvers()
  callbacks.waitForDrain.mockReturnValue(gate.promise)
  const policy = new WorkerReconciliationPolicy(callbacks)
  const controller = new AbortController()
  const recovery = policy.reconcile(
    {
      classification: 'draining',
      handle: {
        lease: { generation: 1, id: 2 },
        worker: { info: { dynamic: false } },
      },
      ownedTaskIds: [],
      previousState: 'ready',
    },
    controller.signal
  )
  const preparation = recovery
    .prepare(controller.signal)
    .catch(reason => reason)

  controller.abort(new Error('prepare timeout'))
  gate.resolve()
  await preparation

  expect(callbacks.executionFinished).not.toHaveBeenCalled()
})

it('publishes a transition crash without a task separately from task rejection', async () => {
  const taskId = '00000000-0000-0000-0000-000000000abc'
  const rawCause = new Error('queued transition raw crash')
  const callbacks = createCallbacks()
  const policy = new WorkerReconciliationPolicy(callbacks)
  const worker = { info: { dynamic: false, id: 7 }, usage: { tasks: {} } }
  const handle = { lease: { generation: 1, id: 7 }, worker }
  callbacks.reserve.mockReturnValue([
    { lease: handle.lease, previousState: 'running', taskId },
  ])

  const recovery = policy.reconcile(
    {
      cause: rawCause,
      classification: 'faulted',
      handle,
      ownedTaskIds: [taskId],
      previousState: 'ready',
    },
    signal
  )
  const firstError = await recovery.prepare(signal)
  await recovery.restore(signal)
  await policy.complete(
    {
      reconciliationValue: firstError,
      transition: {
        cause: rawCause,
        classification: 'faulted',
        handle,
        ownedTaskIds: [taskId],
        previousState: 'ready',
      },
    },
    signal
  )

  expect(callbacks.reject).toHaveBeenCalledOnce()
  const taskError = callbacks.reject.mock.calls[0][2]
  expect(taskError).toBeInstanceOf(WorkerCrashError)
  expect(taskError.taskId).toBe(taskId)
  expect(taskError.workerId).toBe(handle.lease.id)

  expect(callbacks.publishError).toHaveBeenCalledOnce()
  const published = callbacks.publishError.mock.calls[0][0]
  expect(published).toBeInstanceOf(WorkerCrashError)
  expect(published).not.toBe(taskError)
  expect(published.message).toBe(
    'Worker node crashed: queued transition raw crash'
  )
  expect(published.cause).toBe(rawCause)
  expect(published.workerId).toBe(handle.lease.id)
  expect(published.workerId).toBe(taskError.workerId)
  expect(published.taskId).toBeUndefined()
  expect(callbacks.publishError.mock.calls[0][1]).toBe(handle.lease)
})

it('full pool drain rejects reserved queued work without redistribution', async () => {
  const taskId = '00000000-0000-0000-0000-000000000d13'
  const callbacks = createCallbacks()
  callbacks.isRunning.mockReturnValue(false)
  callbacks.reserve.mockReturnValue([
    {
      lease: { generation: 1, id: 9 },
      previousState: 'running',
      taskId,
    },
  ])
  const policy = new WorkerReconciliationPolicy(callbacks)
  const worker = { info: { dynamic: false, id: 9 }, usage: { tasks: {} } }

  const recovery = policy.reconcile(
    {
      classification: 'draining',
      handle: { lease: { generation: 1, id: 9 }, worker },
      ownedTaskIds: [taskId],
      previousState: 'ready',
    },
    signal
  )
  await recovery.prepare(signal)

  expect(callbacks.reject.mock.calls[0][2]).toBeInstanceOf(
    WorkerTerminationError
  )
  expect(callbacks.reject.mock.calls[0][2].taskId).toBe(taskId)
})

it('single worker drain restores reserved queued work through recovery', async () => {
  const taskId = '00000000-0000-0000-0000-000000000d14'
  const lease = { generation: 1, id: 11 }
  const callbacks = createCallbacks()
  callbacks.reserve.mockReturnValue([
    { lease, previousState: 'queued', taskId },
  ])
  callbacks.restore.mockReturnValue([
    { kind: 'committed', state: 'queued', taskId },
  ])
  const policy = new WorkerReconciliationPolicy(callbacks)
  const worker = { info: { dynamic: false, id: 11 }, usage: { tasks: {} } }

  const recovery = policy.reconcile(
    {
      classification: 'draining',
      handle: { lease, worker },
      ownedTaskIds: [taskId],
      previousState: 'ready',
    },
    signal
  )
  await recovery.prepare(signal)
  await recovery.restore(signal)
  recovery.finalizeResidual(signal)

  expect(callbacks.restore).toHaveBeenCalledOnce()
  expect(callbacks.reject).not.toHaveBeenCalled()
  expect(callbacks.apply).toHaveBeenCalledOnce()
  expect(callbacks.apply).toHaveBeenCalledBefore(callbacks.executionFinished)
  expect(callbacks.executionFinished).toHaveBeenCalledOnce()
  expect(callbacks.executionFinished).toHaveBeenCalledWith(lease)
})

it('denies faulted replacement when the restart circuit breaker trips', () => {
  const callbacks = createCallbacks()
  callbacks.attemptRestart.mockReturnValue(false)
  const policy = new WorkerReconciliationPolicy(callbacks)
  const worker = { info: { dynamic: false }, usage: { tasks: {} } }
  const input = {
    classification: 'faulted',
    handle: { lease: { generation: 1, id: 1 }, worker },
  }

  expect(policy.shouldReplace(input)).toBe(false)
  expect(callbacks.attemptRestart).toHaveBeenCalledOnce()
})

it('bypasses the circuit breaker for clean-exit replenishment', () => {
  const callbacks = createCallbacks()
  const policy = new WorkerReconciliationPolicy(callbacks)
  const worker = { info: { dynamic: false }, usage: { tasks: {} } }
  const input = {
    classification: 'exited',
    handle: { lease: { generation: 1, id: 1 }, worker },
  }

  expect(policy.shouldReplace(input)).toBe(true)
  expect(callbacks.attemptRestart).not.toHaveBeenCalled()
})
