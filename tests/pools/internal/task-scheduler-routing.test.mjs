import { describe, expect, it } from 'vitest'

import { createFixture } from './task-scheduler-fixture.mjs'

describe('Task scheduler routing', () => {
  it('discards a stale physical entry whose registry record is missing', () => {
    const fixture = createFixture()
    fixture.register('stale-entry')
    fixture.scheduler.enqueue('stale-entry', fixture.handle)
    fixture.registry.settle('stale-entry', { kind: 'resolved', value: 1 })

    const result = fixture.scheduler.dequeueAndDispatch(fixture.handle)

    expect(result.kind).toBe('settled')
    expect(fixture.queue).toHaveLength(0)
  })

  it('moves prioritized and redistributed tasks through detached ownership', () => {
    const fixture = createFixture()
    fixture.register('steal')
    fixture.register('redistribute')
    fixture.scheduler.enqueue('steal', fixture.handle)
    fixture.scheduler.enqueue('redistribute', fixture.handle)

    const stolen = fixture.scheduler.steal(fixture.handle, fixture.handle)
    const redistributed = fixture.scheduler.redistribute(fixture.handle)

    expect(stolen.kind).toBe('committed')
    expect(redistributed).toHaveLength(1)
    expect(fixture.queue).toHaveLength(0)
  })

  it('drains 25 distinct deterministic command sequences', () => {
    const traces = new Set()
    for (let seed = 1; seed <= 25; seed++) {
      const fixture = createFixture()
      const taskId = `seed-${seed}`
      const controller = new AbortController()
      fixture.register(taskId, controller.signal)
      let random = seed
      const trace = []
      for (let probe = 0; probe < seed; probe++) {
        fixture.scheduler.abort(`missing-${seed}-${probe}`)
        trace.push('missing-abort')
      }
      for (let step = 0; step < 6 && fixture.registry.size > 0; step++) {
        random = (random * 48_271) % 2_147_483_647
        const state = fixture.registry.get(taskId)?.state
        trace.push(`${state}:${random % 5}`)
        if (state === 'registered') {
          if (random % 2 === 0) {
            fixture.scheduler.enqueue(taskId, fixture.handle)
          } else {
            fixture.scheduler.dispatch(taskId, fixture.permit)
          }
        } else if (state === 'queued') {
          if (random % 3 === 0) {
            controller.abort(seed)
            fixture.scheduler.abort(taskId)
          } else if (random % 3 === 1) {
            fixture.scheduler.dequeueAndDispatch(fixture.handle)
          } else {
            fixture.scheduler.detachQueued(fixture.handle)
          }
        } else if (state === 'detached') {
          fixture.scheduler.restore([taskId], [fixture.handle])
        } else if (state === 'running') {
          if (random % 2 === 0) {
            fixture.scheduler.settle(taskId, { kind: 'resolved', value: seed })
          } else {
            controller.abort(seed)
          }
          if (
            fixture.registry.get(taskId)?.state === 'running' &&
            controller.signal.aborted
          ) {
            fixture.scheduler.abort(taskId)
          }
        } else if (state === 'cancelling') {
          fixture.scheduler.settle(taskId, { error: seed, kind: 'rejected' })
        }
      }
      const finalState = fixture.registry.get(taskId)?.state
      if (finalState === 'queued') {
        controller.abort(seed)
        fixture.scheduler.abort(taskId)
      } else if (finalState === 'detached') {
        fixture.scheduler.reject(taskId, seed)
      } else if (finalState != null) {
        fixture.scheduler.settle(taskId, { kind: 'resolved', value: seed })
      }
      traces.add(trace.join('|'))
      expect(fixture.registry.size).toBe(0)
      expect(fixture.queue).toHaveLength(0)
    }
    expect(traces.size).toBe(25)
  })
})
