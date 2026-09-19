import { describe, expect, it, vi } from 'vitest'

import { PoolEventPublisher } from '../../../lib/pools/pool-event-publisher.mjs'
import { ScheduleResultAdapter } from '../../../lib/pools/schedule-result-adapter.mjs'

describe('ScheduleResultAdapter', () => {
  it('defers retry errors and settled secondary errors in exact order', () => {
    const publisher = new PoolEventPublisher('adapter-test', false)
    const defer = vi.spyOn(publisher, 'defer')
    const first = new Error('first')
    const second = new Error('second')
    const adapter = new ScheduleResultAdapter({
      accounting: { applyRejectedSettlement: vi.fn() },
      beforeTaskExecution: vi.fn(),
      events: { checkExecutionStarted: vi.fn(), checkTaskQueued: vi.fn() },
      getTask: vi.fn(),
      getWorkerNodeKeyByHandle: vi.fn(),
      publisher,
    })

    adapter.apply({ error: first, kind: 'retry' }, 'lease')
    adapter.apply(
      {
        kind: 'settled',
        settlement: {
          effect: { executionStarted: false, taskName: 'default' },
          secondaryErrors: [first, second],
          settled: true,
        },
        taskId: 'task',
      },
      'lease'
    )

    expect(defer.mock.calls).toEqual([
      [first, 'lease'],
      [first, 'lease'],
      [second, 'lease'],
    ])
  })

  it('publishes queued backpressure before evaluating the pool edge', () => {
    const worker = { emit: vi.fn() }
    const order = []
    const publisher = new PoolEventPublisher('adapter-test', false)
    vi.spyOn(publisher, 'publishInternal').mockImplementation(() =>
      order.push('internal')
    )
    const adapter = new ScheduleResultAdapter({
      accounting: { applyRejectedSettlement: vi.fn() },
      beforeTaskExecution: vi.fn(),
      events: {
        checkExecutionStarted: vi.fn(),
        checkTaskQueued: () => order.push('pool'),
      },
      getTask: vi.fn(),
      getWorkerNodeKeyByHandle: vi.fn(),
      publisher,
    })

    adapter.apply({
      backPressureStarted: true,
      handle: { lease: { generation: 1, id: 7 }, worker },
      kind: 'committed',
      state: 'queued',
    })

    expect(order).toEqual(['internal', 'pool'])
  })

  it('uses the supplied protected-hook callback only after a committed running result', () => {
    const task = { name: 'default', taskId: 'task' }
    const beforeTaskExecution = vi.fn()
    const checkExecutionStarted = vi.fn()
    const handle = { lease: { generation: 1, id: 1 }, worker: {} }
    const adapter = new ScheduleResultAdapter({
      accounting: { applyRejectedSettlement: vi.fn() },
      beforeTaskExecution,
      events: { checkExecutionStarted, checkTaskQueued: vi.fn() },
      getTask: id => (id === 'task' ? task : undefined),
      getWorkerNodeKeyByHandle: candidate => (candidate === handle ? 4 : -1),
      publisher: new PoolEventPublisher('adapter-test', false),
    })

    adapter.apply({
      handle,
      kind: 'committed',
      state: 'running',
      taskId: 'task',
    })

    expect(beforeTaskExecution).toHaveBeenCalledWith(4, task)
    expect(checkExecutionStarted).toHaveBeenCalledTimes(1)
  })
})
