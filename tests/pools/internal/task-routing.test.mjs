import { describe, expect, it, vi } from 'vitest'

import { TaskRouter } from '../../../lib/pools/task-routing.mjs'

const createFixture = ({
  executing = 0,
  queuesEnabled = true,
  queueSize = 0,
} = {}) => {
  const worker = { tasksQueueSize: () => queueSize }
  const handle = { lease: { generation: 1, id: 1 }, worker }
  const result = state => ({ handle, kind: 'committed', state, taskId: 'task' })
  const scheduler = {
    dispatch: vi.fn(() => result('running')),
    dispatchUntracked: vi.fn(() => result('running')),
    enqueue: vi.fn(() => result('queued')),
    enqueueUntracked: vi.fn(() => result('queued')),
    wait: vi.fn(() => result('waitingReady')),
  }
  scheduler.schedule = vi.fn((taskId, permit, execute) =>
    permit.readiness === 'awaitingReady'
      ? scheduler.wait(taskId, permit)
      : execute
        ? scheduler.dispatch(taskId, permit)
        : scheduler.enqueue(taskId, permit.handle)
  )
  const onResult = vi.fn()
  const router = new TaskRouter(scheduler, {
    concurrency: () => 1,
    executing: () => executing,
    onResult,
    queuesEnabled: () => queuesEnabled,
  })
  return { handle, onResult, router, scheduler }
}

describe('TaskRouter', () => {
  it('waits without dispatching when admission awaits readiness', () => {
    const fixture = createFixture()

    fixture.router.route('task', {
      handle: fixture.handle,
      readiness: 'awaitingReady',
    })

    expect(fixture.scheduler.wait).toHaveBeenCalledOnce()
    expect(fixture.scheduler.dispatch).not.toHaveBeenCalled()
  })

  it('dispatches immediately when capacity is available', () => {
    const fixture = createFixture()

    fixture.router.route('task', {
      handle: fixture.handle,
      readiness: 'ready',
    })

    expect(fixture.scheduler.dispatch).toHaveBeenCalledOnce()
    expect(fixture.onResult).toHaveBeenCalledOnce()
  })

  it('enqueues when queueing is enabled and execution is saturated', () => {
    const fixture = createFixture({ executing: 1 })

    fixture.router.route('task', {
      handle: fixture.handle,
      readiness: 'ready',
    })

    expect(fixture.scheduler.enqueue).toHaveBeenCalledOnce()
  })
})
