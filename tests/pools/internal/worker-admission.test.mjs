import { describe, expect, it, vi } from 'vitest'

import { WorkerAdmission } from '../../../lib/pools/worker-admission.mjs'

const handle = (id, state) => ({
  handle: { lease: { generation: 1, id }, worker: { id } },
  state,
})

const createFixture = (candidates, waiting = new Map(), demand = 0) => {
  const states = new Map(
    candidates.map(candidate => [candidate.handle, candidate.state])
  )
  const coordinator = {
    acquireDispatch: candidate => {
      const readiness = states.get(candidate)
      return readiness === 'ready' || readiness === 'awaitingReady'
        ? { handle: candidate, readiness }
        : undefined
    },
    snapshotHandles: () => candidates.map(candidate => candidate.handle),
    state: candidate => states.get(candidate),
  }
  const createWorker = vi.fn()
  const select = vi.fn((_strategy, keys) => [...keys][0])
  const callbacks = {
    affinity: () => undefined,
    createWorker,
    isPoolActive: () => true,
    maxWorkers: 4,
    select,
    strategy: () => 'least-used',
    workerCount: () => candidates.length,
    workerNodeKey: candidate =>
      candidates.findIndex(entry => entry.handle === candidate),
  }
  const registry = {
    size: demand,
    waitingReadyCount: lease => waiting.get(lease.id) ?? 0,
  }
  return {
    admission: new WorkerAdmission(coordinator, registry, callbacks),
    callbacks,
    createWorker,
    select,
    states,
  }
}

describe('WorkerAdmission', () => {
  it('prefers ready workers over awaiting-ready workers', () => {
    const fixture = createFixture([
      handle(1, 'awaitingReady'),
      handle(2, 'ready'),
    ])

    const permit = fixture.admission.acquire('task')

    expect(permit?.handle.lease.id).toBe(2)
    expect(permit?.readiness).toBe('ready')
  })

  it('chooses the least-loaded awaiting-ready tier', () => {
    const fixture = createFixture(
      [handle(1, 'awaitingReady'), handle(2, 'awaitingReady')],
      new Map([
        [1, 3],
        [2, 1],
      ])
    )

    expect(fixture.admission.acquire()?.handle.lease.id).toBe(2)
    expect(fixture.select).not.toHaveBeenCalled()
  })

  it('breaks awaiting-ready load ties by worker key', () => {
    const fixture = createFixture(
      [handle(2, 'awaitingReady'), handle(1, 'awaitingReady')],
      new Map([
        [1, 1],
        [2, 1],
      ])
    )

    expect(fixture.admission.acquire()?.handle.lease.id).toBe(2)
    expect(fixture.select).not.toHaveBeenCalled()
  })

  it('adds awaiting-ready capacity for registered burst demand', () => {
    const candidates = [handle(1, 'awaitingReady')]
    const waiting = new Map([[1, 1]])
    const fixture = createFixture(candidates, waiting, 3)
    let nextId = 2
    fixture.createWorker.mockImplementation(() => {
      const candidate = handle(nextId++, 'awaitingReady')
      candidates.push(candidate)
      fixture.states.set(candidate.handle, candidate.state)
    })

    const firstPermit = fixture.admission.acquire()
    waiting.set(firstPermit.handle.lease.id, 1)
    const secondPermit = fixture.admission.acquire()

    expect(fixture.createWorker).toHaveBeenCalledTimes(2)
    expect(firstPermit.handle.lease.id).toBe(2)
    expect(secondPermit.handle.lease.id).toBe(3)
    expect(firstPermit.readiness).toBe('awaitingReady')
    expect(secondPermit.readiness).toBe('awaitingReady')
  })

  it('restricts ready strategy selection to affinity candidates', () => {
    const fixture = createFixture([handle(1, 'ready'), handle(2, 'ready')])
    fixture.callbacks.affinity = () => new Set([1])

    expect(fixture.admission.acquire('task')?.handle.lease.id).toBe(2)
    expect(fixture.select).toHaveBeenCalledWith('least-used', new Set([1]))
  })

  it('recomputes candidates once after a selection race', () => {
    const fixture = createFixture([handle(1, 'ready'), handle(2, 'ready')])
    fixture.select
      .mockImplementationOnce(() => -1)
      .mockImplementationOnce(() => 1)

    expect(fixture.admission.acquire()?.handle.lease.id).toBe(2)
    expect(fixture.select).toHaveBeenCalledTimes(2)
  })

  it('provisions affinity indices before selecting', () => {
    const fixture = createFixture([handle(1, 'ready')])
    fixture.callbacks.affinity = () => new Set([2])
    fixture.callbacks.workerCount =
      fixture.createWorker.mock.calls.length === -1
        ? () => 1
        : (() => {
            let count = 1
            fixture.createWorker.mockImplementation(() => {
              ++count
            })
            return () => count
          })()

    fixture.admission.acquire()

    expect(fixture.createWorker).toHaveBeenCalledTimes(2)
  })
})
