import { describe, expect, it, vi } from 'vitest'

import { WorkerLifecycleCoordinator } from '../../../lib/pools/worker-lifecycle-coordinator.mjs'
import { register, worker } from './worker-lifecycle-fixture.mjs'

const createFixture = () => {
  const callbacks = {
    complete: vi.fn(async () => undefined),
    drain: vi.fn(async () => undefined),
    exclude: vi.fn(),
    isPoolRunning: vi.fn(() => true),
    reconcile: vi.fn(async () => undefined),
    remove: vi.fn(),
    replace: vi.fn(async () => undefined),
    shouldReplace: vi.fn(() => true),
    snapshotOwnedWork: vi.fn(() => []),
    terminate: vi.fn(async () => undefined),
  }
  return {
    callbacks,
    coordinator: new WorkerLifecycleCoordinator(callbacks),
  }
}

describe('Worker lifecycle terminal promotion', () => {
  it('promotes a draining reconciliation without replacing its promise', async () => {
    const { callbacks, coordinator } = createFixture()
    const handle = register(coordinator, worker(1))
    coordinator.markReady(handle)
    const terminationCause = new Error('pool termination')
    const crash = new Error('worker crash')
    const exit = { code: 9, signal: 'SIGKILL' }

    const reconciliation = coordinator.beginDrain(handle, terminationCause)
    const promises = coordinator.snapshotPromises()
    const promoted = Reflect.apply(
      Reflect.get(coordinator, 'promoteTerminalFault'),
      coordinator,
      [handle, crash, exit]
    )

    expect(promoted).toBe(true)
    expect(coordinator.snapshotPromises()).toStrictEqual(promises)
    expect(promises).toStrictEqual([reconciliation])
    const result = await reconciliation
    expect(callbacks.reconcile).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ classification: 'draining' }),
      expect.any(AbortSignal)
    )
    expect(callbacks.complete).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        transition: expect.objectContaining({
          cause: crash,
          classification: 'faulted',
          exit,
        }),
      }),
      expect.any(AbortSignal)
    )
    expect(result).toMatchObject({
      cause: crash,
      classification: 'faulted',
      exit,
    })
    expect(callbacks.exclude).toHaveBeenCalledOnce()
    expect(callbacks.reconcile).toHaveBeenCalledOnce()
    expect(callbacks.replace).toHaveBeenCalledOnce()
  })

  it('promotes an exited reconciliation without replacing its promise', async () => {
    const { callbacks, coordinator } = createFixture()
    const handle = register(coordinator, worker(2))
    coordinator.markReady(handle)
    const cleanExit = new Error('clean exit')
    const crash = new Error('late abnormal exit')
    const exit = { code: 7, signal: null }

    coordinator.quarantine(handle, cleanExit, 'exited')
    const reconciliation = coordinator.reconcile(handle)
    const promoted = Reflect.apply(
      Reflect.get(coordinator, 'promoteTerminalFault'),
      coordinator,
      [handle, crash, exit]
    )

    expect(promoted).toBe(true)
    expect(coordinator.snapshotPromises()).toStrictEqual([reconciliation])
    const result = await reconciliation
    expect(callbacks.reconcile).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ classification: 'exited' }),
      expect.any(AbortSignal)
    )
    expect(callbacks.complete).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        transition: expect.objectContaining({
          cause: crash,
          classification: 'faulted',
          exit,
        }),
      }),
      expect.any(AbortSignal)
    )
    expect(result).toMatchObject({
      cause: crash,
      classification: 'faulted',
      exit,
    })
    expect(callbacks.exclude).toHaveBeenCalledOnce()
    expect(callbacks.reconcile).toHaveBeenCalledOnce()
    expect(callbacks.replace).toHaveBeenCalledOnce()
  })

  it('does not promote ready faulted removed missing or stale handles', async () => {
    const { coordinator } = createFixture()
    const ready = register(coordinator, worker(1))
    coordinator.markReady(ready)
    const faulted = register(coordinator, worker(2))
    const faultReconciliation = coordinator.fault(faulted, new Error('first'))
    const removed = register(coordinator, worker(3))
    coordinator.remove(removed)
    const stale = register(coordinator, worker(4))
    coordinator.remove(stale)
    register(coordinator, worker(4))
    const missing = {
      lease: { generation: 99, id: 99 },
      worker: worker(99),
    }
    const epoch = coordinator.topologyEpoch
    const crash = new Error('late crash')

    const decisions = [ready, faulted, removed, missing, stale].map(handle =>
      Reflect.apply(
        Reflect.get(coordinator, 'promoteTerminalFault'),
        coordinator,
        [handle, crash, { code: 1 }]
      )
    )

    expect(decisions).toStrictEqual([false, false, false, false, false])
    expect(coordinator.topologyEpoch).toBe(epoch)
    expect(coordinator.state(ready)).toBe('ready')
    expect(coordinator.state(faulted)).toBe('faulted')
    await faultReconciliation
  })

  it('advances topology once and does not duplicate reconciliation work', async () => {
    const { callbacks, coordinator } = createFixture()
    const handle = register(coordinator, worker(1))
    coordinator.markReady(handle)
    const reconciliation = coordinator.beginDrain(handle, new Error('destroy'))
    const epoch = coordinator.topologyEpoch
    const crash = new Error('crash')

    const promote = () =>
      Reflect.apply(
        Reflect.get(coordinator, 'promoteTerminalFault'),
        coordinator,
        [handle, crash]
      )
    expect(promote()).toBe(true)
    expect(promote()).toBe(false)
    expect(coordinator.topologyEpoch).toBe(epoch + 1)
    expect(coordinator.snapshotPromises()).toStrictEqual([reconciliation])
    await reconciliation
    expect(callbacks.exclude).toHaveBeenCalledOnce()
    expect(callbacks.reconcile).toHaveBeenCalledOnce()
    expect(callbacks.remove).toHaveBeenCalledOnce()
    expect(callbacks.terminate).toHaveBeenCalledOnce()
    expect(callbacks.complete).toHaveBeenCalledOnce()
    expect(callbacks.shouldReplace).toHaveBeenCalledOnce()
    expect(callbacks.replace).toHaveBeenCalledOnce()
    expect(callbacks.drain).toHaveBeenCalledOnce()
  })
})
