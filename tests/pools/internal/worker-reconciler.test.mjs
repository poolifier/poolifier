import { describe, expect, it, vi } from 'vitest'

import { WorkerReconciler } from '../../../lib/pools/worker-reconciler.mjs'
import { WorkerTaskRecovery } from '../../../lib/pools/worker-task-recovery.mjs'

const never = () => new Promise(() => {})
const signal = new AbortController().signal

const createInput = (callbacks, finalize = vi.fn()) => {
  const handle = {
    lease: { generation: 1, id: 1 },
    worker: { info: { dynamic: false, id: 1 } },
  }
  const transition = {
    cause: new Error('crash'),
    classification: 'faulted',
    handle,
    ownedTaskIds: [],
    previousState: 'ready',
  }
  return {
    callbacks,
    finalize,
    input: {
      baseTransition: transition,
      command: {
        allowReplacement: true,
        cause: transition.cause,
        classification: 'faulted',
        handle,
      },
      finalize,
      transition: () => transition,
    },
  }
}

describe('WorkerReconciler bounded fallbacks', () => {
  it('lets draining preparation honor a tasksFinishedTimeout longer than the generic phase timeout', async () => {
    vi.useFakeTimers()
    const task = Promise.withResolvers()
    const taskOutcome = task.promise.catch(reason => reason)
    const recovery = {
      finalizeResidual: vi.fn(),
      prepare: vi.fn(
        () =>
          new Promise(resolve => {
            setTimeout(() => {
              task.reject(new Error('tasks finished timeout'))
              resolve(undefined)
            }, 40_000)
          })
      ),
      prepareTimeoutMs: 40_000,
      restore: vi.fn(),
    }
    const callbacks = {
      complete: vi.fn(),
      drain: vi.fn(),
      exclude: vi.fn(),
      isPoolRunning: vi.fn(() => false),
      reconcile: vi.fn(() => recovery),
      remove: vi.fn(),
      replace: vi.fn(),
      shouldReplace: vi.fn(),
      snapshotOwnedWork: vi.fn(() => []),
      terminate: vi.fn(),
    }
    const fixture = createInput(callbacks)
    const reconciliation = new WorkerReconciler(callbacks).reconcile(
      fixture.input
    )
    let settled = false
    reconciliation
      .then(
        () => {
          settled = true
          return undefined
        },
        () => {
          settled = true
          return undefined
        }
      )
      .catch(() => undefined)
    setTimeout(() => task.resolve('completed'), 50_000)

    await vi.advanceTimersByTimeAsync(30_000)
    expect(settled).toBe(false)
    expect(callbacks.remove).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(10_000)
    await expect(reconciliation).resolves.toMatchObject({ committed: true })
    await expect(taskOutcome).resolves.toMatchObject({
      message: 'tasks finished timeout',
    })
    expect(recovery.prepare).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(1)

    await vi.runAllTimersAsync()
    expect(vi.getTimerCount()).toBe(0)
    vi.useRealTimers()
  })

  it.each([0, 10_000])(
    'keeps a %ims tasksFinishedTimeout authoritative',
    async tasksFinishedTimeout => {
      vi.useFakeTimers()
      const recovery = {
        finalizeResidual: vi.fn(),
        prepare: vi.fn(
          () =>
            new Promise(resolve => {
              setTimeout(resolve, tasksFinishedTimeout)
            })
        ),
        prepareTimeoutMs: tasksFinishedTimeout,
        restore: vi.fn(),
      }
      const callbacks = {
        complete: vi.fn(),
        drain: vi.fn(),
        exclude: vi.fn(),
        isPoolRunning: vi.fn(() => false),
        reconcile: vi.fn(() => recovery),
        remove: vi.fn(),
        replace: vi.fn(),
        shouldReplace: vi.fn(),
        snapshotOwnedWork: vi.fn(() => []),
        terminate: vi.fn(),
      }
      const fixture = createInput(callbacks)
      const reconciliation = new WorkerReconciler(callbacks).reconcile(
        fixture.input
      )

      await vi.advanceTimersByTimeAsync(tasksFinishedTimeout)

      await expect(reconciliation).resolves.toMatchObject({ committed: true })
      expect(recovery.prepare).toHaveBeenCalledOnce()
      expect(vi.getTimerCount()).toBe(0)
      vi.useRealTimers()
    }
  )

  it.each([
    'exclude',
    'prepare',
    'remove',
    'terminate',
    'complete',
    'isPoolRunning',
    'shouldReplace',
    'replace',
    'restore',
    'drain',
    'finalizeResidual',
    'finalize',
  ])(
    'attempts every phase and finalizes when %s never resolves',
    async stage => {
      vi.useFakeTimers()
      const calls = []
      const recovery = {
        finalizeResidual: vi.fn(() => {
          calls.push('finalizeResidual')
          return stage === 'finalizeResidual' ? never() : undefined
        }),
        prepare: vi.fn(() => {
          return Promise.resolve(undefined)
        }),
        restore: vi.fn(() => {
          calls.push('restore')
          return stage === 'restore' ? never() : undefined
        }),
      }
      const callbacks = {
        complete: vi.fn(async () => {
          calls.push('complete')
          if (stage === 'complete') await never()
        }),
        drain: vi.fn(async () => {
          calls.push('drain')
          if (stage === 'drain') await never()
        }),
        exclude: vi.fn(() => {
          calls.push('exclude')
          if (stage === 'exclude') return never()
        }),
        isPoolRunning: vi.fn(() => {
          calls.push('isPoolRunning')
          return stage === 'isPoolRunning' ? never() : true
        }),
        reconcile: vi.fn(() => {
          calls.push('prepare')
          return stage === 'prepare' ? never() : recovery
        }),
        remove: vi.fn(() => {
          calls.push('remove')
          if (stage === 'remove') return never()
        }),
        replace: vi.fn(async () => {
          calls.push('replace')
          if (stage === 'replace') await never()
        }),
        shouldReplace: vi.fn(() => {
          calls.push('shouldReplace')
          return stage === 'shouldReplace' ? never() : true
        }),
        snapshotOwnedWork: vi.fn(() => []),
        terminate: vi.fn(async () => {
          calls.push('terminate')
          if (stage === 'terminate') await never()
        }),
      }
      const finalize = vi.fn(() => {
        calls.push('finalize')
        return stage === 'finalize' ? never() : undefined
      })
      const fixture = createInput(callbacks, finalize)
      const reconciliation = new WorkerReconciler(callbacks, 10)
        .reconcile(fixture.input)
        .catch(reason => reason)

      await vi.runAllTimersAsync()
      const error = await reconciliation

      expect(error.failures.map(failure => failure.stage)).toContain(stage)
      const expectedCalls = [
        'exclude',
        'prepare',
        'remove',
        'terminate',
        'complete',
        'isPoolRunning',
        ...(stage === 'isPoolRunning' ? [] : ['shouldReplace']),
        ...(stage === 'isPoolRunning' || stage === 'shouldReplace'
          ? []
          : ['replace']),
        ...(stage === 'prepare' ? [] : ['restore']),
        'drain',
        ...(stage === 'prepare' ? [] : ['finalizeResidual']),
        'finalize',
      ]
      expect(calls).toStrictEqual(expectedCalls)
      expect(fixture.finalize).toHaveBeenCalledOnce()
      vi.useRealTimers()
    }
  )

  it.each(['terminate', 'complete', 'replace', 'drain'])(
    'aborts held %s work and prevents its late side effect',
    async stage => {
      vi.useFakeTimers()
      const gate = Promise.withResolvers()
      const lateSideEffect = vi.fn()
      const observedSignals = []
      const unhandledRejections = []
      const onUnhandledRejection = reason => unhandledRejections.push(reason)
      process.on('unhandledRejection', onUnhandledRejection)
      const held = async signal => {
        observedSignals.push(signal)
        await gate.promise
        if (!signal?.aborted) lateSideEffect()
      }
      const recovery = {
        finalizeResidual: vi.fn(),
        prepare: vi.fn(),
        restore: vi.fn(),
      }
      const callbacks = {
        complete:
          stage === 'complete'
            ? vi.fn(async (_input, signal) => held(signal))
            : vi.fn(),
        drain:
          stage === 'drain'
            ? vi.fn(async (_handle, signal) => held(signal))
            : vi.fn(),
        exclude: vi.fn(),
        isPoolRunning: vi.fn(() => true),
        reconcile: vi.fn(() => recovery),
        remove: vi.fn(),
        replace:
          stage === 'replace'
            ? vi.fn(async (_input, signal) => held(signal))
            : vi.fn(),
        shouldReplace: vi.fn(() => true),
        snapshotOwnedWork: vi.fn(() => []),
        terminate:
          stage === 'terminate'
            ? vi.fn(async (_input, signal) => held(signal))
            : vi.fn(),
      }
      const fixture = createInput(callbacks)
      const reconciliation = new WorkerReconciler(callbacks, 10)
        .reconcile(fixture.input)
        .catch(reason => reason)

      await vi.runAllTimersAsync()
      const error = await reconciliation
      gate.resolve()
      await vi.runAllTimersAsync()

      expect(error.failures.map(failure => failure.stage)).toContain(stage)
      expect(observedSignals).toHaveLength(1)
      expect(observedSignals[0]).toBeInstanceOf(AbortSignal)
      expect(observedSignals[0].aborted).toBe(true)
      expect(lateSideEffect).not.toHaveBeenCalled()
      expect(fixture.finalize).toHaveBeenCalledOnce()
      expect(recovery.finalizeResidual).toHaveBeenCalledOnce()
      expect(unhandledRejections).toStrictEqual([])
      process.off('unhandledRejection', onUnhandledRejection)
      vi.useRealTimers()
    }
  )

  it('observes a held phase rejection after its timeout', async () => {
    vi.useFakeTimers()
    const gate = Promise.withResolvers()
    const unhandledRejections = []
    const onUnhandledRejection = reason => unhandledRejections.push(reason)
    process.on('unhandledRejection', onUnhandledRejection)
    const callbacks = {
      complete: vi.fn(),
      drain: vi.fn(async (_handle, signal) => {
        await gate.promise
        signal.throwIfAborted()
      }),
      exclude: vi.fn(),
      isPoolRunning: vi.fn(() => false),
      reconcile: vi.fn(),
      remove: vi.fn(),
      replace: vi.fn(),
      shouldReplace: vi.fn(),
      snapshotOwnedWork: vi.fn(() => []),
      terminate: vi.fn(),
    }
    const fixture = createInput(callbacks)
    const reconciliation = new WorkerReconciler(callbacks, 10)
      .reconcile(fixture.input)
      .catch(reason => reason)

    await vi.runAllTimersAsync()
    const error = await reconciliation
    gate.reject(new Error('late drain failure'))
    await vi.runAllTimersAsync()

    expect(error.failures.map(failure => failure.stage)).toContain('drain')
    expect(fixture.finalize).toHaveBeenCalledOnce()
    expect(unhandledRejections).toStrictEqual([])
    process.off('unhandledRejection', onUnhandledRejection)
    vi.useRealTimers()
  })
})

describe('WorkerTaskRecovery state policy', () => {
  it.each([
    ['faulted', 'registered', 'restore'],
    ['faulted', 'waitingReady', 'restore'],
    ['faulted', 'queued', 'restore'],
    ['faulted', 'detached', 'restore'],
    ['faulted', 'assigned', 'reject'],
    ['faulted', 'dispatching', 'reject'],
    ['faulted', 'running', 'reject'],
    ['faulted', 'cancelling', 'reject'],
    ['draining', 'registered', 'restore'],
    ['draining', 'waitingReady', 'restore'],
    ['draining', 'queued', 'restore'],
    ['draining', 'detached', 'restore'],
    ['draining', 'assigned', 'reject'],
    ['draining', 'dispatching', 'reject'],
    ['draining', 'running', 'reject'],
    ['draining', 'cancelling', 'reject'],
  ])('%s %s tasks %s', async (classification, previousState, expected) => {
    const reservation = {
      lease: { generation: 1, id: 1 },
      previousState,
      taskId: `00000000-0000-0000-0000-${previousState.padEnd(12, '0')}`,
    }
    const restore = vi.fn(reservations =>
      reservations.map(item => ({
        handle: { lease: item.lease, worker: {} },
        kind: 'committed',
        state: 'queued',
        taskId: item.taskId,
      }))
    )
    const reject = vi.fn(() => true)
    const finalize = vi.fn()
    const recovery = new WorkerTaskRecovery(
      {
        classification,
        handle: {
          lease: reservation.lease,
          worker: { info: { dynamic: false } },
        },
        ownedTaskIds: [reservation.taskId],
        previousState: 'ready',
      },
      [reservation],
      {
        apply: vi.fn(),
        error: () => new Error('crash'),
        finalize,
        prepare: () => Promise.resolve(),
        reject,
        restore,
      }
    )

    await recovery.prepare(signal)
    expect(restore).not.toHaveBeenCalled()
    await recovery.restore(signal)
    recovery.finalizeResidual(signal)

    expect(restore).toHaveBeenCalledTimes(expected === 'restore' ? 1 : 0)
    expect(reject).toHaveBeenCalledTimes(expected === 'reject' ? 1 : 0)
    expect(finalize).toHaveBeenCalledOnce()
  })
})
