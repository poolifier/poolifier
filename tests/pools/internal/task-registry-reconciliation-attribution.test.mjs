import { AsyncResource } from 'node:async_hooks'
import { describe, expect, it, vi } from 'vitest'

import { TaskRegistry } from '../../../lib/pools/task-registry.mjs'

const workerLease = { generation: 3, id: 7 }
const foreignLease = { generation: 3, id: 8 }
const staleLease = { generation: 2, id: 7 }
const ids = {
  active: '00000000-0000-4000-8000-000000000201',
  foreign: '00000000-0000-4000-8000-000000000202',
  queued: '00000000-0000-4000-8000-000000000203',
  stale: '00000000-0000-4000-8000-000000000204',
}

const register = (registry, taskId, lease, state) => {
  registry.register({
    asyncResource: new AsyncResource('reconciliation-attribution-test', {
      requireManualDestroy: true,
    }),
    onAbort: vi.fn(),
    reject: vi.fn(),
    resolve: vi.fn(),
    selectedLease: lease,
    task: { data: { taskId }, name: 'echo', taskId },
  })
  if (state === 'queued') {
    registry.transition(taskId, ['registered'], 'queued', lease)
    return
  }
  registry.transition(taskId, ['registered'], 'assigned', lease)
  registry.transition(taskId, ['assigned'], 'dispatching', lease)
  registry.transition(taskId, ['dispatching'], 'running', lease)
  if (state === 'cancelling') {
    registry.transition(taskId, ['running'], 'cancelling', lease)
  }
}

describe('Task registry reconciliation attribution', () => {
  it('returns active IDs after records are already reconciling', () => {
    const registry = new TaskRegistry()
    register(registry, ids.active, workerLease, 'running')
    registry.reserveForReconciliation([ids.active], workerLease)

    expect(
      registry.snapshotActiveReconciliationTaskIds([ids.active], workerLease)
    ).toStrictEqual([ids.active])
  })

  it('does not re-reserve records already reconciling', () => {
    const registry = new TaskRegistry()
    register(registry, ids.active, workerLease, 'running')
    const first = registry.reserveForReconciliation([ids.active], workerLease)

    const second = registry.reserveForReconciliation([ids.active], workerLease)

    expect(first).toHaveLength(1)
    expect(second).toStrictEqual([])
    expect(registry.get(ids.active)?.activeOnReconciliation).toBe(true)
  })

  it('filters a different worker ID', () => {
    const registry = new TaskRegistry()
    register(registry, ids.active, workerLease, 'running')
    register(registry, ids.foreign, foreignLease, 'running')
    registry.reserveForReconciliation([ids.active], workerLease)
    registry.reserveForReconciliation([ids.foreign], foreignLease)

    expect(
      registry.snapshotActiveReconciliationTaskIds(
        [ids.foreign, ids.active],
        workerLease
      )
    ).toStrictEqual([ids.active])
  })

  it('filters a stale worker generation', () => {
    const registry = new TaskRegistry()
    register(registry, ids.active, workerLease, 'running')
    register(registry, ids.stale, staleLease, 'running')
    registry.reserveForReconciliation([ids.active], workerLease)
    registry.reserveForReconciliation([ids.stale], staleLease)

    expect(
      registry.snapshotActiveReconciliationTaskIds(
        [ids.stale, ids.active],
        workerLease
      )
    ).toStrictEqual([ids.active])
  })

  it('keeps queued reconciling records inactive', () => {
    const registry = new TaskRegistry()
    register(registry, ids.active, workerLease, 'running')
    register(registry, ids.queued, workerLease, 'queued')
    registry.reserveForReconciliation([ids.active, ids.queued], workerLease)

    expect(
      registry.snapshotActiveReconciliationTaskIds(
        [ids.queued, ids.active],
        workerLease
      )
    ).toStrictEqual([ids.active])
  })

  it('preserves stable unique input order', () => {
    const registry = new TaskRegistry()
    register(registry, ids.active, workerLease, 'running')
    register(registry, ids.foreign, workerLease, 'cancelling')
    registry.reserveForReconciliation([ids.active, ids.foreign], workerLease)

    expect(
      registry.snapshotActiveReconciliationTaskIds(
        [ids.foreign, ids.active, ids.foreign],
        workerLease
      )
    ).toStrictEqual([ids.foreign, ids.active])
  })

  it('returns task IDs without exposing records', () => {
    const registry = new TaskRegistry()
    register(registry, ids.active, workerLease, 'running')
    registry.reserveForReconciliation([ids.active], workerLease)

    const snapshot = registry.snapshotActiveReconciliationTaskIds(
      [ids.active],
      workerLease
    )

    expect(snapshot).toStrictEqual([ids.active])
    expect(typeof snapshot[0]).toBe('string')
  })
})
