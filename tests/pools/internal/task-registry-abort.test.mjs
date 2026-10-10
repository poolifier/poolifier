import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'

import { TaskRegistry } from '../../../lib/pools/task-registry.mjs'

const selectedLease = { generation: 1, id: 1 }
const currentLease = { generation: 2, id: 2 }

const fixture = ({ reason } = {}) => {
  const registry = new TaskRegistry()
  const taskId = randomUUID()
  const signal = {
    aborted: false,
    addEventListener: vi.fn(),
    reason,
    removeEventListener: vi.fn(),
  }
  registry.register({
    abortSignal: signal,
    onAbort: vi.fn(),
    reject: vi.fn(),
    resolve: vi.fn(),
    selectedLease,
    task: { name: 'echo', taskId },
  })
  return { registry, signal, taskId }
}

const move = (subject, state) => {
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
    subject.registry.transition(
      subject.taskId,
      [subject.registry.get(subject.taskId).state],
      next,
      next === 'detached' ? undefined : currentLease
    )
  }
}

describe('TaskRegistry abort decisions and lease queries', () => {
  it.each([
    ['registered', undefined],
    ['queued', currentLease],
    ['assigned', currentLease],
    ['detached', undefined],
  ])('returns settle-local for %s ownership', (state, lease) => {
    const reason = { state }
    const subject = fixture({ reason })
    move(subject, state)

    expect(subject.registry.requestAbort(subject.taskId)).toStrictEqual({
      error: reason,
      kind: 'settle-local',
      ...(lease != null && { lease }),
      state,
    })
  })

  it('returns the exact fallback for a nullish abort reason', () => {
    const subject = fixture({ reason: null })

    expect(subject.registry.requestAbort(subject.taskId).error).toStrictEqual(
      new Error(`Task 'echo' id '${subject.taskId}' aborted`)
    )
  })

  it('settles an immediately aborted registration exactly once', () => {
    const abortReason = { source: 'immediate-abort' }
    const controller = new AbortController()
    const registry = new TaskRegistry()
    const onAbort = vi.fn(taskId => {
      expect(registry.requestAbort(taskId)).toStrictEqual({
        error: abortReason,
        kind: 'settle-local',
        state: 'registered',
      })
      registry.settle(taskId, { error: abortReason, kind: 'rejected' })
    })
    const reject = vi.fn()
    const resolve = vi.fn()
    const taskId = randomUUID()
    registry.register({
      abortSignal: controller.signal,
      onAbort,
      reject,
      resolve,
      selectedLease,
      task: { name: 'echo', taskId },
    })

    controller.abort(abortReason)

    expect(onAbort).toHaveBeenCalledExactlyOnceWith(taskId)
    expect(reject).toHaveBeenCalledExactlyOnceWith(abortReason)
    expect(resolve).not.toHaveBeenCalled()
    expect(registry.size).toBe(0)
  })

  it('transitions running to cancelling once with its current lease', () => {
    const subject = fixture()
    move(subject, 'running')

    expect(subject.registry.requestAbort(subject.taskId)).toStrictEqual({
      kind: 'send-running-abort',
      lease: currentLease,
    })
    expect(subject.registry.requestAbort(subject.taskId)).toStrictEqual({
      kind: 'noop',
      reason: 'already_cancelling',
    })
  })

  it('defers abort while synchronous dispatch owns the task', () => {
    const subject = fixture()
    move(subject, 'dispatching')

    expect(subject.registry.requestAbort(subject.taskId)).toStrictEqual({
      kind: 'defer-dispatch',
    })
    expect(subject.registry.get(subject.taskId)?.state).toBe('dispatching')
  })

  it('returns missing for unknown and post-settlement tasks', () => {
    const subject = fixture()
    expect(subject.registry.requestAbort(randomUUID())).toStrictEqual({
      kind: 'noop',
      reason: 'missing',
    })
    subject.registry.settle(subject.taskId, {
      kind: 'resolved',
      value: undefined,
    })

    expect(subject.registry.requestAbort(subject.taskId)).toStrictEqual({
      kind: 'noop',
      reason: 'missing',
    })
  })

  it('matches leases by id and generation and clears queries after settlement', () => {
    const subject = fixture()
    move(subject, 'running')

    expect(subject.registry.snapshotByLease(currentLease)).toStrictEqual([
      subject.taskId,
    ])
    expect(
      subject.registry.snapshotByLease({ ...currentLease, generation: 3 })
    ).toStrictEqual([])
    expect(subject.registry.hasOwnedWork(currentLease)).toBe(true)
    expect(
      subject.registry.hasOwnedWork({ ...currentLease, generation: 3 })
    ).toBe(false)
    subject.registry.settle(subject.taskId, {
      kind: 'resolved',
      value: undefined,
    })
    expect(subject.registry.snapshotByLease(currentLease)).toStrictEqual([])
    expect(subject.registry.hasOwnedWork(currentLease)).toBe(false)
  })

  it.each([
    ['queued', 'assigned'],
    ['assigned', 'queued'],
    ['assigned', 'dispatching'],
    ['dispatching', 'running'],
  ])('rejects stale ownership on %s to %s', (state, next) => {
    const subject = fixture()
    move(subject, state)
    const staleLease = {
      ...currentLease,
      generation: currentLease.generation + 1,
    }

    expect(
      subject.registry.transition(subject.taskId, [state], next, staleLease)
    ).toStrictEqual({ ok: false, reason: 'state_mismatch' })
    expect(subject.registry.get(subject.taskId)?.currentLease).toStrictEqual(
      currentLease
    )
    expect(subject.registry.get(subject.taskId)?.state).toBe(state)
  })

  it('rejects a stale generation on running to cancelling', () => {
    const subject = fixture()
    move(subject, 'running')
    const staleLease = {
      ...currentLease,
      generation: currentLease.generation + 1,
    }

    expect(
      subject.registry.transition(
        subject.taskId,
        ['running'],
        'cancelling',
        staleLease
      )
    ).toStrictEqual({ ok: false, reason: 'state_mismatch' })
    expect(subject.registry.requestAbort(subject.taskId)).toStrictEqual({
      kind: 'send-running-abort',
      lease: currentLease,
    })
  })

  it('preserves the active lease object when an equivalent lease is supplied', () => {
    const subject = fixture()
    move(subject, 'assigned')

    expect(
      subject.registry.transition(subject.taskId, ['assigned'], 'dispatching', {
        ...currentLease,
      }).ok
    ).toBe(true)
    expect(
      subject.registry.transition(subject.taskId, ['dispatching'], 'running', {
        ...currentLease,
      }).ok
    ).toBe(true)
    expect(subject.registry.get(subject.taskId)?.currentLease).toBe(
      currentLease
    )
  })
})
