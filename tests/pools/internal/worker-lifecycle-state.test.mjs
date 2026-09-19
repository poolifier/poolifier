import { describe, expect, it } from 'vitest'

import { createWorkerReconciliationInput } from '../../../lib/pools/worker-lifecycle-state.mjs'

describe('Worker lifecycle state', () => {
  it('builds an immutable reconciliation snapshot from lifecycle state', () => {
    const exit = { code: 1, signal: 'SIGTERM' }
    const handle = {
      lease: { generation: 2, id: 3 },
      worker: { info: { dynamic: false, id: 3 } },
    }
    const slot = {
      cause: new Error('crash'),
      exit,
      handle,
      state: 'faulted',
    }

    const input = createWorkerReconciliationInput(
      slot,
      { classification: 'faulted', previousState: 'ready' },
      ['first-task']
    )
    exit.code = 9

    expect(input).toStrictEqual({
      cause: slot.cause,
      classification: 'faulted',
      exit: { code: 1, signal: 'SIGTERM' },
      handle,
      ownedTaskIds: ['first-task'],
      previousState: 'ready',
    })
    expect(Object.isFrozen(input)).toBe(true)
    expect(Object.isFrozen(input.exit)).toBe(true)
  })

  it('omits exit metadata when no exit has been observed', () => {
    const handle = {
      lease: { generation: 1, id: 1 },
      worker: { info: { dynamic: false, id: 1 } },
    }

    const input = createWorkerReconciliationInput(
      { cause: undefined, handle, state: 'draining' },
      { classification: 'draining', previousState: 'ready' },
      []
    )

    expect(input).not.toHaveProperty('exit')
  })
})
