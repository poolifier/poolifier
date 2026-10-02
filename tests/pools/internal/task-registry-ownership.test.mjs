import { describe, expect, it, vi } from 'vitest'

import { WorkerTerminationError } from '../../../lib/index.mjs'
import {
  currentLease,
  registerTask,
  selectedLease,
} from './task-registry-fixture.mjs'

describe('Task registry ownership', () => {
  it('binds waiting-ready ownership once and drains the exact lease', () => {
    const fixture = registerTask({ selected: null })
    const handle = { lease: currentLease, worker: {} }

    const bound = fixture.registry.bindWaitingReady(fixture.taskId, {
      handle,
      readiness: 'awaitingReady',
    })

    expect(bound).toStrictEqual({
      current: 'waitingReady',
      ok: true,
      previous: 'registered',
    })
    expect(fixture.registry.get(fixture.taskId)?.selectedLease).toBe(
      currentLease
    )
    expect(fixture.registry.snapshotWaitingReady(currentLease)).toStrictEqual([
      fixture.taskId,
    ])
    expect(fixture.registry.snapshotWaitingReady(selectedLease)).toStrictEqual(
      []
    )
  })

  it('reports active execution ownership independently from queued ownership', () => {
    const queued = registerTask({ selected: currentLease })
    queued.registry.transition(
      queued.taskId,
      ['registered'],
      'queued',
      currentLease
    )
    const running = registerTask({ selected: currentLease })
    running.registry.transition(
      running.taskId,
      ['registered'],
      'assigned',
      currentLease
    )
    running.registry.transition(
      running.taskId,
      ['assigned'],
      'dispatching',
      currentLease
    )

    expect(queued.registry.hasActiveExecution(currentLease)).toBe(false)
    expect(running.registry.hasActiveExecution(currentLease)).toBe(true)
  })

  it('reserves owned work before response and abort settlement', () => {
    const fixture = registerTask({ selected: currentLease })
    const handle = { lease: currentLease, worker: {} }
    fixture.registry.bindAssigned(fixture.taskId, {
      handle,
      readiness: 'ready',
    })
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

    const reserved = fixture.registry.reserveForReconciliation(
      [fixture.taskId],
      currentLease
    )

    expect(reserved).toStrictEqual([
      {
        lease: currentLease,
        previousState: 'running',
        taskId: fixture.taskId,
      },
    ])
    expect(Object.isFrozen(reserved[0])).toBe(true)
    expect(fixture.registry.requestAbort(fixture.taskId)).toStrictEqual({
      kind: 'noop',
      reason: 'reconciling',
    })
    expect(
      fixture.registry.settle(fixture.taskId, {
        kind: 'resolved',
        value: 'late',
      })
    ).toStrictEqual({ settled: false })
    expect(
      fixture.registry.settleReserved(
        fixture.taskId,
        {
          error: new Error('crash'),
          kind: 'rejected',
        },
        currentLease
      ).settled
    ).toBe(true)
    expect(fixture.registry.get(fixture.taskId)).toBeUndefined()
  })

  it('accepts reconciliation settlement only from the exact reserved lease', () => {
    const fixture = registerTask({ selected: currentLease })
    const handle = { lease: currentLease, worker: {} }
    fixture.registry.bindAssigned(fixture.taskId, {
      handle,
      readiness: 'ready',
    })
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
    fixture.registry.reserveForReconciliation([fixture.taskId], currentLease)
    const staleLease = {
      generation: currentLease.generation - 1,
      id: currentLease.id,
    }
    const differentWorkerLease = {
      generation: currentLease.generation,
      id: currentLease.id + 1,
    }

    const staleGeneration = fixture.registry.settleReserved(
      fixture.taskId,
      { kind: 'resolved', value: 'stale-generation' },
      staleLease
    )
    const differentWorker = fixture.registry.settleReserved(
      fixture.taskId,
      { kind: 'resolved', value: 'different-worker' },
      differentWorkerLease
    )

    expect(staleGeneration).toStrictEqual({ settled: false })
    expect(differentWorker).toStrictEqual({ settled: false })
    expect(fixture.registry.get(fixture.taskId)?.state).toBe('reconciling')
    expect(fixture.resolve).not.toHaveBeenCalled()
    expect(fixture.reject).not.toHaveBeenCalled()
    expect(fixture.emitDestroy).not.toHaveBeenCalled()

    const exact = fixture.registry.settleReserved(
      fixture.taskId,
      { kind: 'resolved', value: 'exact' },
      currentLease
    )
    const duplicate = fixture.registry.settleReserved(
      fixture.taskId,
      { kind: 'resolved', value: 'duplicate' },
      currentLease
    )

    expect(exact.settled).toBe(true)
    expect(duplicate).toStrictEqual({ settled: false })
    expect(fixture.registry.get(fixture.taskId)).toBeUndefined()
    expect(fixture.resolve).toHaveBeenCalledOnce()
    expect(fixture.resolve).toHaveBeenCalledWith('exact')
    expect(fixture.reject).not.toHaveBeenCalled()
    expect(fixture.emitDestroy).toHaveBeenCalledOnce()
  })

  it('keeps timeout rejection when it wins before a reserved response', () => {
    const fixture = registerTask({ selected: currentLease })
    const handle = { lease: currentLease, worker: {} }
    fixture.registry.bindAssigned(fixture.taskId, {
      handle,
      readiness: 'ready',
    })
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
    fixture.registry.reserveForReconciliation([fixture.taskId], currentLease)
    const terminationError = new WorkerTerminationError(
      'Worker termination timed out',
      { taskId: fixture.taskId, workerId: currentLease.id }
    )

    const timeout = fixture.registry.settleReserved(
      fixture.taskId,
      { error: terminationError, kind: 'rejected' },
      currentLease
    )
    const lateResponse = fixture.registry.settleReserved(
      fixture.taskId,
      { kind: 'resolved', value: 'late' },
      currentLease
    )

    expect(timeout.settled).toBe(true)
    expect(fixture.reject).toHaveBeenCalledOnce()
    expect(fixture.reject).toHaveBeenCalledWith(terminationError)
    expect(fixture.resolve).not.toHaveBeenCalled()
    expect(lateResponse).toStrictEqual({ settled: false })
    expect(fixture.registry.get(fixture.taskId)).toBeUndefined()
    expect(fixture.emitDestroy).toHaveBeenCalledOnce()
  })

  it.each([
    'registered',
    'waitingReady',
    'queued',
    'assigned',
    'dispatching',
    'running',
    'cancelling',
    'detached',
  ])('retains the previous %s state in an immutable reservation', state => {
    const fixture = registerTask({ selected: currentLease })
    const transitions = {
      assigned: ['registered', 'assigned'],
      cancelling: ['assigned', 'dispatching', 'running', 'cancelling'],
      detached: ['queued', 'detached'],
      dispatching: ['assigned', 'dispatching'],
      queued: ['registered', 'queued'],
      running: ['assigned', 'dispatching', 'running'],
      waitingReady: ['registered', 'waitingReady'],
    }
    let current = 'registered'
    for (const next of transitions[state] ?? []) {
      if (next === current) continue
      fixture.registry.transition(
        fixture.taskId,
        [current],
        next,
        next === 'detached' ? undefined : currentLease
      )
      current = next
    }
    const reservations = fixture.registry.reserveForReconciliation(
      [fixture.taskId],
      currentLease
    )

    expect(reservations).toStrictEqual([
      { lease: currentLease, previousState: state, taskId: fixture.taskId },
    ])
  })
  it('duplicate response settles once', () => {
    const fixture = registerTask()

    const first = fixture.registry.settle(fixture.taskId, {
      kind: 'resolved',
      value: 1,
    })
    const duplicate = fixture.registry.settle(fixture.taskId, {
      kind: 'resolved',
      value: 2,
    })

    expect(first.settled).toBe(true)
    expect(duplicate).toStrictEqual({ settled: false })
    expect(fixture.resolve).toHaveBeenCalledOnce()
    expect(fixture.resolve).toHaveBeenCalledWith(1)
    expect(fixture.emitDestroy).toHaveBeenCalledOnce()
  })

  it('abort then exit settles once and removes the listener', () => {
    const controller = new AbortController()
    const remove = vi.spyOn(controller.signal, 'removeEventListener')
    const fixture = registerTask({ abortSignal: controller.signal })
    fixture.registry.transition(
      fixture.taskId,
      ['registered'],
      'queued',
      selectedLease
    )
    const reason = new Error('cancelled')
    controller.abort(reason)

    const decision = fixture.registry.requestAbort(fixture.taskId)
    const abort = fixture.registry.settle(fixture.taskId, {
      error: decision.error,
      kind: 'rejected',
    })
    const exit = fixture.registry.settle(fixture.taskId, {
      error: new Error('exit'),
      kind: 'rejected',
    })

    expect(abort.settled).toBe(true)
    expect(exit.settled).toBe(false)
    expect(fixture.reject).toHaveBeenCalledWith(reason)
    expect(remove).toHaveBeenCalledOnce()
    expect(fixture.emitDestroy).toHaveBeenCalledOnce()
  })

  it('exit then response settles once', () => {
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
    const exitError = new Error('worker exited')

    const exit = fixture.registry.settle(fixture.taskId, {
      error: exitError,
      kind: 'rejected',
    })
    const response = fixture.registry.settle(fixture.taskId, {
      kind: 'resolved',
      value: 'late',
    })

    expect(exit.settled).toBe(true)
    expect(response.settled).toBe(false)
    expect(fixture.reject).toHaveBeenCalledWith(exitError)
    expect(fixture.resolve).not.toHaveBeenCalled()
    expect(fixture.emitDestroy).toHaveBeenCalledOnce()
  })

  it('reports active and historical lease accounting independently', () => {
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

    const result = fixture.registry.settle(fixture.taskId, {
      kind: 'resolved',
      value: 'ok',
    })

    expect(result.effect).toStrictEqual({
      activeLease: currentLease,
      executionStarted: true,
      outcome: 'executed',
      selectedLease,
      taskName: 'echo',
    })
  })

  it('omits active accounting for queued settlement', () => {
    const fixture = registerTask()
    fixture.registry.transition(
      fixture.taskId,
      ['registered'],
      'queued',
      currentLease
    )

    const result = fixture.registry.settle(fixture.taskId, {
      error: new Error('queued'),
      kind: 'rejected',
    })

    expect(result.effect).toStrictEqual({
      executionStarted: false,
      outcome: 'failed',
      selectedLease,
      taskName: 'echo',
    })
  })
})
