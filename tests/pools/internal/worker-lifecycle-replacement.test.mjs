import { describe, expect, it, vi } from 'vitest'

import { WorkerLifecycleCoordinator } from '../../../lib/pools/worker-lifecycle-coordinator.mjs'
import { createFixture, register, worker } from './worker-lifecycle-fixture.mjs'

describe('Worker lifecycle replacement', () => {
  it('applies fixed and dynamic replacement policy callbacks', async () => {
    const replace = vi.fn(async () => undefined)
    const coordinator = new WorkerLifecycleCoordinator({
      complete: async () => undefined,
      drain: async () => undefined,
      exclude: () => undefined,
      isPoolRunning: () => true,
      reconcile: async () => undefined,
      remove: () => undefined,
      replace,
      shouldReplace: ({ handle }) => handle.worker.info.dynamic === false,
      snapshotOwnedWork: () => [],
      terminate: async () => undefined,
    })
    const fixedLease = register(coordinator, worker(1))
    const dynamicLease = register(coordinator, worker(2, true))

    await coordinator.exit(fixedLease, { code: 0 })
    await coordinator.exit(dynamicLease, { code: 0 })

    expect(replace).toHaveBeenCalledOnce()
    expect(replace.mock.calls[0][0].handle).toStrictEqual(fixedLease)
  })

  it('does not replace after closing during a held replacement transition', async () => {
    let running = true
    const replace = vi.fn(async () => undefined)
    const coordinator = new WorkerLifecycleCoordinator({
      complete: async () => {
        running = false
      },
      drain: async () => undefined,
      exclude: () => undefined,
      isPoolRunning: () => running,
      reconcile: async () => undefined,
      remove: () => undefined,
      replace,
      shouldReplace: () => true,
      snapshotOwnedWork: () => [],
      terminate: async () => undefined,
    })
    const lease = register(coordinator, worker(1))

    await coordinator.fault(lease, new Error('boom'))

    expect(replace).not.toHaveBeenCalled()
  })

  it('removes physical storage before awaiting held termination', async () => {
    const order = []
    let releaseTermination
    const terminationGate = new Promise(resolve => {
      releaseTermination = resolve
    })
    const removed = Promise.withResolvers()
    const coordinator = new WorkerLifecycleCoordinator({
      complete: async () => order.push('complete'),
      drain: async () => order.push('drain'),
      exclude: () => order.push('exclude'),
      isPoolRunning: () => false,
      reconcile: async () => order.push('reconcile'),
      remove: () => {
        order.push('remove')
        removed.resolve()
      },
      replace: async () => order.push('replace'),
      shouldReplace: () => true,
      snapshotOwnedWork: () => [],
      terminate: async () => terminationGate,
    })
    const lease = register(coordinator, worker(1))

    const reconciliation = coordinator.exit(lease, { code: 0 })
    await removed.promise

    expect(order).toEqual(['exclude', 'reconcile', 'remove'])
    expect(coordinator.state(lease)).toBe('exited')
    releaseTermination()
    await reconciliation
    expect(order).toEqual([
      'exclude',
      'reconcile',
      'remove',
      'complete',
      'drain',
    ])
    expect(coordinator.state(lease)).toBe('removed')
  })

  it('passes detached task IDs to complete before replacement', async () => {
    const order = []
    const taskId = '00000000-0000-4000-8000-000000000001'
    const coordinator = new WorkerLifecycleCoordinator({
      complete: async ({ transition }) => {
        order.push(['complete', transition.ownedTaskIds])
      },
      drain: async () => order.push(['drain']),
      exclude: () => undefined,
      isPoolRunning: () => true,
      reconcile: async () => undefined,
      remove: () => undefined,
      replace: async () => order.push(['replace']),
      shouldReplace: () => true,
      snapshotOwnedWork: () => [taskId],
      terminate: async () => undefined,
    })
    const lease = register(coordinator, worker(1))

    await coordinator.exit(lease, { code: 0 })

    expect(order).toEqual([['complete', [taskId]], ['replace'], ['drain']])
  })

  it('records setup failure and exposes one reconciliation promise', async () => {
    const { coordinator } = createFixture({ replace: false })
    const lease = register(coordinator, worker(1))
    const setupValue = { setup: 'failed' }

    const first = coordinator.setupFailed(lease, setupValue)
    const promises = coordinator.snapshotPromises()

    expect(promises).toHaveLength(1)
    expect(promises[0]).toBe(first)
    expect((await first).cause).toBe(setupValue)
  })

  it('removes terminates and drains before surfacing reconciliation failure', async () => {
    const order = []
    const failure = new Error('reconcile failed')
    const coordinator = new WorkerLifecycleCoordinator({
      complete: async () => order.push('complete'),
      drain: async () => order.push('drain'),
      exclude: () => order.push('exclude'),
      isPoolRunning: () => true,
      reconcile: () => {
        order.push('reconcile')
        throw failure
      },
      remove: () => order.push('remove'),
      replace: async () => order.push('replace'),
      shouldReplace: () => true,
      snapshotOwnedWork: () => [],
      terminate: async () => order.push('terminate'),
    })
    const lease = register(coordinator, worker(1))

    await expect(
      coordinator.fault(lease, new Error('crash'))
    ).rejects.toMatchObject({
      cause: failure,
      stage: 'prepare',
    })

    expect(order).toEqual([
      'exclude',
      'reconcile',
      'remove',
      'terminate',
      'complete',
      'replace',
      'drain',
    ])
    expect(coordinator.state(lease)).toBe('removed')
  })
})
