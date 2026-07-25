import { expect, it, vi } from 'vitest'

import { WorkerTaskRecovery } from '../../../lib/pools/worker-task-recovery.mjs'

const signal = new AbortController().signal

it('never restores non-recoverable tasks when the prepare phase throws', async () => {
  const lease = { generation: 1, id: 7 }
  const running = {
    lease,
    previousState: 'running',
    taskId: '00000000-0000-0000-0000-000000000a01',
  }
  const queued = {
    lease,
    previousState: 'queued',
    taskId: '00000000-0000-0000-0000-000000000a02',
  }
  const apply = vi.fn()
  const reject = vi.fn(() => true)
  const restore = vi.fn(reservations =>
    reservations.map(() => ({ kind: 'committed' }))
  )
  const recovery = new WorkerTaskRecovery(
    {
      classification: 'faulted',
      handle: { lease, worker: { info: { dynamic: false } } },
      ownedTaskIds: [running.taskId, queued.taskId],
      previousState: 'ready',
    },
    [running, queued],
    {
      apply,
      error: () => new Error('crash'),
      finalize: vi.fn(),
      prepare: () => Promise.reject(new Error('drain failed')),
      reject,
      restore,
    }
  )

  await expect(recovery.prepare(signal)).rejects.toThrow('drain failed')

  await recovery.restore(signal)

  expect(restore).toHaveBeenCalledOnce()
  const restored = restore.mock.calls[0][0]
  expect(restored).toStrictEqual([queued])
  expect(apply).toHaveBeenCalledOnce()

  recovery.finalizeResidual(signal)
  expect(reject).toHaveBeenCalledOnce()
  expect(reject.mock.calls[0][0]).toStrictEqual(running)
})

it('does not re-reject already restored tasks when apply throws mid-restore', async () => {
  const lease = { generation: 1, id: 9 }
  const first = {
    lease,
    previousState: 'queued',
    taskId: '00000000-0000-0000-0000-000000000b01',
  }
  const second = {
    lease,
    previousState: 'queued',
    taskId: '00000000-0000-0000-0000-000000000b02',
  }
  const apply = vi.fn(() => {
    throw new Error('listener boom')
  })
  const reject = vi.fn(() => true)
  const restore = vi.fn(reservations =>
    reservations.map(() => ({ kind: 'committed' }))
  )
  const recovery = new WorkerTaskRecovery(
    {
      classification: 'faulted',
      handle: { lease, worker: { info: { dynamic: false } } },
      ownedTaskIds: [first.taskId, second.taskId],
      previousState: 'ready',
    },
    [first, second],
    {
      apply,
      error: () => new Error('crash'),
      finalize: vi.fn(),
      prepare: () => Promise.resolve(),
      reject,
      restore,
    }
  )

  await recovery.prepare(signal)
  expect(() => recovery.restore(signal)).toThrow('listener boom')

  recovery.finalizeResidual(signal)
  expect(restore).toHaveBeenCalledOnce()
  expect(apply).toHaveBeenCalledOnce()
  expect(reject).not.toHaveBeenCalled()
})

it('applies every committed placement even when the signal aborts mid-restore', async () => {
  const lease = { generation: 1, id: 13 }
  const first = {
    lease,
    previousState: 'queued',
    taskId: '00000000-0000-0000-0000-000000000c01',
  }
  const second = {
    lease,
    previousState: 'queued',
    taskId: '00000000-0000-0000-0000-000000000c02',
  }
  const controller = new AbortController()
  const apply = vi.fn(() => {
    controller.abort()
  })
  const reject = vi.fn(() => true)
  const restore = vi.fn(reservations =>
    reservations.map(() => ({ kind: 'committed' }))
  )
  const recovery = new WorkerTaskRecovery(
    {
      classification: 'faulted',
      handle: { lease, worker: { info: { dynamic: false } } },
      ownedTaskIds: [first.taskId, second.taskId],
      previousState: 'ready',
    },
    [first, second],
    {
      apply,
      error: () => new Error('crash'),
      finalize: vi.fn(),
      prepare: () => Promise.resolve(),
      reject,
      restore,
    }
  )

  await recovery.prepare(controller.signal)
  await recovery.restore(controller.signal)

  expect(restore).toHaveBeenCalledOnce()
  expect(apply).toHaveBeenCalledTimes(2)
  expect(reject).not.toHaveBeenCalled()
})
