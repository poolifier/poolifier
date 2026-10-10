import { describe, expect, it, vi } from 'vitest'

import {
  currentLease,
  registerTask,
  selectedLease,
} from './task-registry-fixture.mjs'

describe('Task registry invariants', () => {
  it('enforces lease invariants without mutating invalid transitions', () => {
    const fixture = registerTask()
    expect(
      fixture.registry.transition(fixture.taskId, ['registered'], 'assigned')
    ).toStrictEqual({ ok: false, reason: 'state_mismatch' })
    expect(fixture.registry.get(fixture.taskId)?.state).toBe('registered')
    expect(
      fixture.registry.transition(
        fixture.taskId,
        ['registered'],
        'queued',
        currentLease
      ).ok
    ).toBe(true)
    expect(
      fixture.registry.transition(
        fixture.taskId,
        ['queued'],
        'detached',
        currentLease
      )
    ).toStrictEqual({ ok: false, reason: 'state_mismatch' })
    expect(fixture.registry.get(fixture.taskId)?.currentLease).toStrictEqual(
      currentLease
    )
    expect(
      fixture.registry.transition(fixture.taskId, ['queued'], 'detached').ok
    ).toBe(true)
    expect(fixture.registry.get(fixture.taskId)?.currentLease).toBeUndefined()
  })

  it('rejects a lease with the same worker id and a stale generation', () => {
    const fixture = registerTask()
    const staleLease = {
      generation: selectedLease.generation + 1,
      id: selectedLease.id,
    }

    expect(
      fixture.registry.transition(
        fixture.taskId,
        ['registered'],
        'queued',
        selectedLease
      ).ok
    ).toBe(true)
    const transition = fixture.registry.transition(
      fixture.taskId,
      ['queued'],
      'assigned',
      staleLease
    )

    expect(transition.ok).toBe(false)
    expect(fixture.registry.get(fixture.taskId)?.state).toBe('queued')
  })

  it('covers running abort decisions and lease queries', () => {
    const fixture = registerTask()
    fixture.registry.transition(
      fixture.taskId,
      ['registered'],
      'assigned',
      currentLease
    )
    fixture.registry.transition(
      fixture.taskId,
      ['assigned'],
      'dispatching',
      currentLease
    )
    fixture.registry.transition(
      fixture.taskId,
      ['dispatching'],
      'running',
      currentLease
    )

    expect(fixture.registry.snapshotByLease(currentLease)).toStrictEqual([
      fixture.taskId,
    ])
    expect(fixture.registry.hasOwnedWork(currentLease)).toBe(true)
    expect(fixture.registry.requestAbort(fixture.taskId)).toStrictEqual({
      kind: 'send-running-abort',
      lease: currentLease,
    })
    expect(fixture.registry.requestAbort(fixture.taskId)).toStrictEqual({
      kind: 'noop',
      reason: 'already_cancelling',
    })
  })

  it('makes reentrant settlement and transition stale', () => {
    const resolve = vi.fn(() => {
      expect(fixture.registry.get(fixture.taskId)?.currentLease).toBeUndefined()
      expect(fixture.registry.requestAbort(fixture.taskId)).toStrictEqual({
        kind: 'noop',
        reason: 'settled',
      })
      expect(
        fixture.registry.settle(fixture.taskId, { kind: 'resolved', value: 2 })
      ).toStrictEqual({ settled: false })
      expect(
        fixture.registry.transition(fixture.taskId, ['settled'], 'queued')
      ).toStrictEqual({ ok: false, reason: 'state_mismatch' })
    })
    const fixture = registerTask({ resolve })

    fixture.registry.settle(fixture.taskId, { kind: 'resolved', value: 1 })
  })

  it('removes the record only after listener and resource cleanup', () => {
    const signal = {
      aborted: false,
      addEventListener: vi.fn(),
      reason: undefined,
      removeEventListener: vi.fn(() =>
        expect(fixture.registry.get(fixture.taskId)).toBeDefined()
      ),
    }
    const fixture = registerTask({ abortSignal: signal })
    fixture.emitDestroy.mockImplementation(() =>
      expect(fixture.registry.get(fixture.taskId)).toBeDefined()
    )

    fixture.registry.settle(fixture.taskId, { kind: 'resolved', value: 1 })

    expect(fixture.registry.get(fixture.taskId)).toBeUndefined()
  })

  it.each([
    ['registered', 'queued'],
    ['registered', 'assigned'],
    ['queued', 'assigned'],
    ['queued', 'detached'],
    ['assigned', 'queued'],
    ['assigned', 'dispatching'],
    ['dispatching', 'running'],
    ['detached', 'queued'],
    ['detached', 'assigned'],
    ['running', 'cancelling'],
  ])('commits legal edge %s to %s', (from, next) => {
    const fixture = registerTask()
    const paths = {
      assigned: ['assigned'],
      cancelling: ['assigned', 'dispatching', 'running', 'cancelling'],
      detached: ['queued', 'detached'],
      dispatching: ['assigned', 'dispatching'],
      queued: ['queued'],
      registered: [],
      running: ['assigned', 'dispatching', 'running'],
    }
    for (const state of paths[from]) {
      fixture.registry.transition(
        fixture.taskId,
        [fixture.registry.get(fixture.taskId).state],
        state,
        state === 'detached' ? undefined : currentLease
      )
    }

    expect(
      fixture.registry.transition(
        fixture.taskId,
        [from],
        next,
        next === 'detached' ? undefined : currentLease
      ).ok
    ).toBe(true)
  })

  it.each([
    'registered',
    'queued',
    'assigned',
    'dispatching',
    'running',
    'cancelling',
    'detached',
  ])('settles legally from %s', state => {
    const fixture = registerTask()
    const paths = {
      assigned: ['assigned'],
      cancelling: ['assigned', 'dispatching', 'running', 'cancelling'],
      detached: ['queued', 'detached'],
      dispatching: ['assigned', 'dispatching'],
      queued: ['queued'],
      registered: [],
      running: ['assigned', 'dispatching', 'running'],
    }
    for (const next of paths[state]) {
      fixture.registry.transition(
        fixture.taskId,
        [fixture.registry.get(fixture.taskId).state],
        next,
        next === 'detached' ? undefined : currentLease
      )
    }

    expect(
      fixture.registry.settle(fixture.taskId, {
        kind: 'resolved',
        value: state,
      }).settled
    ).toBe(true)
  })
})
