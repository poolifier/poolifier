import { describe, expect, it } from 'vitest'

import { WorkerTopologyRegistry } from '../../../lib/pools/worker-topology-registry.mjs'
import { worker } from './worker-lifecycle-fixture.mjs'

describe('Worker topology registry', () => {
  it('allocates pool-global generations and rejects stale handles after ID reuse', () => {
    const registry = new WorkerTopologyRegistry()
    const first = registry.register(worker(1))
    const second = registry.register(worker(2))
    registry.finalize(registry.slot(first))

    const replacement = registry.register(worker(1))

    expect(first.lease).toStrictEqual({ generation: 1, id: 1 })
    expect(second.lease).toStrictEqual({ generation: 2, id: 2 })
    expect(replacement.lease).toStrictEqual({ generation: 3, id: 1 })
    expect(registry.isCurrent(first)).toBe(false)
    expect(registry.isCurrent(second)).toBe(true)
    expect(registry.isCurrent(replacement)).toBe(true)
  })

  it('rejects stale handles when the same worker object is re-registered', () => {
    const registry = new WorkerTopologyRegistry()
    const sharedWorker = worker(1)
    const first = registry.register(sharedWorker)
    registry.finalize(registry.slot(first))
    const intermediate = registry.register(worker(2))

    const replacement = registry.register(sharedWorker)

    expect(first.lease).toStrictEqual({ generation: 1, id: 1 })
    expect(intermediate.lease).toStrictEqual({ generation: 2, id: 2 })
    expect(replacement.lease).toStrictEqual({ generation: 3, id: 1 })
    expect(registry.slot(first)).toBeUndefined()
    expect(registry.isCurrent(first)).toBe(false)
    expect(registry.handle(sharedWorker)).toBe(replacement)
    expect(registry.isCurrent(replacement)).toBe(true)
  })

  it('returns deterministic snapshots from current slots only', () => {
    const registry = new WorkerTopologyRegistry()
    const second = registry.register(worker(2))
    const first = registry.register(worker(1))
    const awaiting = registry.register(worker(3))
    registry.slot(second).state = 'ready'
    registry.slot(first).state = 'ready'
    registry.slot(awaiting).state = 'awaitingReady'

    expect(registry.snapshotHandles()).toStrictEqual([second, first, awaiting])
    expect(registry.snapshotReadyHandles()).toStrictEqual([first, second])
  })

  it('notifies listeners synchronously for topology changes until unsubscribe', () => {
    const registry = new WorkerTopologyRegistry()
    const epochs = []
    const unsubscribe = registry.subscribe(epoch => {
      epochs.push(epoch)
    })

    const handle = registry.register(worker(1))
    registry.advance()
    registry.finalize(registry.slot(handle))
    unsubscribe()
    registry.register(worker(2))

    expect(epochs).toStrictEqual([1, 2, 3])
    expect(registry.epoch).toBe(4)
  })

  it('preserves a replacement slot when finalizing an older generation', () => {
    const registry = new WorkerTopologyRegistry()
    const first = registry.register(worker(1))
    const second = registry.register(worker(1))

    registry.finalize(registry.slot(first))

    expect(registry.snapshotHandles()).toStrictEqual([second])
    expect(registry.resolve(second)).toBe(second.worker)
  })
})
