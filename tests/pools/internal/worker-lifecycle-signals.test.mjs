import { describe, expect, it, vi } from 'vitest'

import { WorkerLifecycleCoordinator } from '../../../lib/pools/worker-lifecycle-coordinator.mjs'
import { createFixture, register, worker } from './worker-lifecycle-fixture.mjs'

describe('Worker lifecycle signals', () => {
  it('issues monotonically increasing leases for reused worker IDs', () => {
    const { coordinator } = createFixture()

    const first = register(coordinator, worker(1))
    coordinator.remove(first)
    const second = register(coordinator, worker(1))

    expect(first.lease).toStrictEqual({ generation: 1, id: 1 })
    expect(second.lease).toStrictEqual({ generation: 2, id: 1 })
  })

  it('advances topology for registration readiness direct and final removal', () => {
    const { coordinator } = createFixture()
    const epochs = Array.of(0)
    epochs.length = 0
    const unsubscribe = coordinator.subscribeTopologyChanges(epoch => {
      epochs.push(epoch)
    })

    const first = coordinator.register(worker(2))
    coordinator.finishProvisioning(first)
    coordinator.markReady(first)
    coordinator.remove(first)
    unsubscribe()
    coordinator.register(worker(3))

    expect(epochs).toStrictEqual([1, 2, 3, 4])
    expect(coordinator.topologyEpoch).toBe(5)
  })

  it('snapshots only ready handles in deterministic lease order', () => {
    const { coordinator } = createFixture()
    const second = register(coordinator, worker(2))
    const first = register(coordinator, worker(1))
    const awaiting = register(coordinator, worker(3))
    coordinator.markReady(second)
    coordinator.markReady(first)

    expect(coordinator.snapshotReadyHandles()).toStrictEqual([first, second])
    expect(coordinator.snapshotReadyHandles()).not.toContain(awaiting)
  })

  it('notifies topology subscribers synchronously and stops after unsubscribe', () => {
    const { coordinator } = createFixture()
    const epochs = Array.of(0)
    epochs.length = 0
    const unsubscribe = coordinator.subscribeTopologyChanges(epoch => {
      epochs.push(epoch)
    })

    coordinator.register(worker(1))
    expect(epochs).toStrictEqual([1])
    unsubscribe()
    coordinator.register(worker(2))

    expect(epochs).toStrictEqual([1])
  })

  it('deduplicates quarantine and advances topology only on first terminal signal', async () => {
    const { coordinator } = createFixture()
    const handle = register(coordinator, worker(1))
    coordinator.markReady(handle)
    const epoch = coordinator.topologyEpoch

    const first = coordinator.quarantine(handle, new Error('uncertain'))
    const duplicate = coordinator.quarantine(handle, new Error('duplicate'))

    expect(first).toBe(true)
    expect(duplicate).toBe(false)
    expect(coordinator.acquireDispatch(handle)).toBeUndefined()
    expect(coordinator.topologyEpoch).toBe(epoch + 1)
    const reconciliation = coordinator.reconcile(handle)
    expect(coordinator.reconcile(handle)).toBe(reconciliation)
    await reconciliation
  })

  it('does not advance topology for stale generation signals', async () => {
    const { coordinator } = createFixture()
    const stale = register(coordinator, worker(1))
    coordinator.remove(stale)
    register(coordinator, worker(1))
    const epoch = coordinator.topologyEpoch

    const excluded = coordinator.quarantine(stale, new Error('late'))

    expect(excluded).toBe(false)
    expect(coordinator.topologyEpoch).toBe(epoch)
  })

  it('ignores a message bound to a removed lease', () => {
    const { coordinator } = createFixture()
    const removedLease = register(coordinator, worker(1))
    coordinator.remove(removedLease)
    register(coordinator, worker(1))

    expect(coordinator.markReady(removedLease)).toBe(false)
    expect(coordinator.isCurrent(removedLease)).toBe(false)
  })

  it('deduplicates error then exit into one reconciliation and replacement', async () => {
    const { calls, coordinator } = createFixture()
    const lease = register(coordinator, worker(1))
    coordinator.markReady(lease)
    const error = new Error('boom')

    const first = coordinator.fault(lease, error)
    const duplicate = coordinator.exit(lease, { code: 1 })

    expect(duplicate).toBe(first)
    await first
    expect(calls.filter(([name]) => name === 'reconcile')).toHaveLength(1)
    expect(calls.filter(([name]) => name === 'replace')).toHaveLength(1)
    expect(calls.find(([name]) => name === 'reconcile')[1].cause).toBe(error)
  })

  it('classifies clean exit with running work as faulted', async () => {
    const { coordinator } = createFixture()
    const lease = register(coordinator, worker(1, false, 1))
    coordinator.markReady(lease)

    const result = await coordinator.exit(lease, { code: 0 })

    expect(result.classification).toBe('faulted')
  })

  it('classifies clean exit with queued-only work as exited', async () => {
    const { coordinator } = createFixture()
    const lease = register(coordinator, worker(1))
    coordinator.markReady(lease)

    const result = await coordinator.exit(lease, { code: 0 })

    expect(result.classification).toBe('exited')
  })

  it('classifies clean exit without owned work as exited', async () => {
    const { coordinator } = createFixture()
    const lease = register(coordinator, worker(1))
    coordinator.markReady(lease)

    const result = await coordinator.exit(lease, { code: 0 })

    expect(result.classification).toBe('exited')
  })

  it('uses explicit drain cause ahead of later runtime signals', async () => {
    const { calls, coordinator } = createFixture()
    const lease = register(coordinator, worker(1))
    coordinator.markReady(lease)
    const termination = new Error('explicit')

    const drain = coordinator.beginDrain(lease, termination)
    coordinator.fault(lease, new Error('late runtime error'))
    await drain

    expect(calls.find(([name]) => name === 'reconcile')[1].cause).toBe(
      termination
    )
  })

  it('enriches the first runtime error with later exit metadata', async () => {
    let releaseTermination
    const terminationGate = new Promise(resolve => {
      releaseTermination = resolve
    })
    const coordinator = new WorkerLifecycleCoordinator({
      complete: async () => undefined,
      drain: async () => undefined,
      exclude: () => undefined,
      isPoolRunning: () => false,
      reconcile: async () => undefined,
      remove: () => undefined,
      replace: async () => undefined,
      shouldReplace: () => false,
      snapshotOwnedWork: () => [],
      terminate: async () => terminationGate,
    })
    const lease = register(coordinator, worker(1))
    const error = new Error('first')

    const reconciliation = coordinator.fault(lease, error)
    const duplicate = coordinator.exit(lease, { code: null, signal: 'SIGKILL' })
    releaseTermination()
    const result = await reconciliation

    expect(duplicate).toBe(reconciliation)
    expect(result.cause).toBe(error)
    expect(result.exit).toStrictEqual({ code: null, signal: 'SIGKILL' })
  })

  it('refreshes owned work when constructing later reconciliation transitions', async () => {
    const snapshots = [['initial-task'], ['remaining-task'], []]
    const complete = vi.fn()
    const reconcile = vi.fn()
    const coordinator = new WorkerLifecycleCoordinator({
      complete,
      drain: async () => undefined,
      exclude: () => undefined,
      isPoolRunning: () => false,
      reconcile,
      remove: () => undefined,
      replace: async () => undefined,
      shouldReplace: () => false,
      snapshotOwnedWork: () => snapshots.shift() ?? [],
      terminate: async () => undefined,
    })
    const handle = register(coordinator, worker(1))

    await coordinator.fault(handle, new Error('crash'))

    expect(reconcile.mock.calls[0][0].ownedTaskIds).toStrictEqual([
      'initial-task',
    ])
    expect(complete.mock.calls[0][0].transition.ownedTaskIds).toStrictEqual([
      'remaining-task',
    ])
  })

  it('keeps explicit drain selected while enriching a later exit', async () => {
    let releaseTermination
    const terminationGate = new Promise(resolve => {
      releaseTermination = resolve
    })
    const coordinator = new WorkerLifecycleCoordinator({
      complete: async () => undefined,
      drain: async () => undefined,
      exclude: () => undefined,
      isPoolRunning: () => false,
      reconcile: async () => undefined,
      remove: () => undefined,
      replace: async () => undefined,
      shouldReplace: () => false,
      snapshotOwnedWork: () => [],
      terminate: async () => terminationGate,
    })
    const lease = register(coordinator, worker(1))
    const termination = new Error('explicit')

    const reconciliation = coordinator.beginDrain(lease, termination)
    coordinator.fault(lease, new Error('late crash'))
    coordinator.exit(lease, { code: 9, signal: null })
    releaseTermination()
    const result = await reconciliation

    expect(result.cause).toBe(termination)
    expect(result.classification).toBe('draining')
    expect(result.exit).toStrictEqual({ code: 9, signal: null })
  })

  it('settles when the owned termination callback reaches its fallback', async () => {
    const { calls, coordinator } = createFixture()
    const lease = register(coordinator, worker(1))

    await coordinator.exit(lease, { code: 0 })

    expect(calls.map(([name]) => name)).toEqual([
      'exclude',
      'reconcile',
      'remove',
      'terminate',
      'complete',
      'replace',
      'drain',
    ])
  })

  it('treats removed and missing leases as repeatable no-ops', async () => {
    const { coordinator } = createFixture()
    const lease = register(coordinator, worker(1))
    coordinator.remove(lease)

    expect(coordinator.remove(lease)).toBe(false)
    expect((await coordinator.fault(lease, new Error('late'))).committed).toBe(
      false
    )
    expect(
      (
        await coordinator.exit(
          { lease: { generation: 99, id: 99 }, worker: worker(99) },
          { code: 1 }
        )
      ).committed
    ).toBe(false)
  })
})
