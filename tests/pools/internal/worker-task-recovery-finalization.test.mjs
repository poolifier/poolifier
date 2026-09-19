import { expect, it, vi } from 'vitest'

import { WorkerTaskRecovery } from '../../../lib/pools/worker-task-recovery.mjs'

const signal = new AbortController().signal

it('finalizes once after every residual rejection attempt fails', async () => {
  const lease = { generation: 1, id: 12 }
  const reservations = [
    '00000000-0000-0000-0000-000000000d15',
    '00000000-0000-0000-0000-000000000d16',
  ].map(taskId => ({ lease, previousState: 'queued', taskId }))
  const finalize = vi.fn()
  const reject = vi.fn(() => {
    throw new Error('reject failed')
  })
  const recovery = new WorkerTaskRecovery(
    {
      classification: 'faulted',
      handle: { lease, worker: { info: { dynamic: false } } },
      ownedTaskIds: reservations.map(({ taskId }) => taskId),
      previousState: 'ready',
    },
    reservations,
    {
      apply: vi.fn(),
      error: () => new Error('crash'),
      finalize,
      prepare: () => Promise.resolve(),
      reject,
      restore: () => {
        throw new Error('restore failed')
      },
    }
  )
  await recovery.prepare(signal)

  expect(() => recovery.restore(signal)).toThrow('restore failed')
  expect(() => recovery.finalizeResidual(signal)).toThrow(AggregateError)

  expect(reject).toHaveBeenCalledTimes(2)
  expect(reject).toHaveBeenCalledBefore(finalize)
  expect(finalize).toHaveBeenCalledOnce()
})
