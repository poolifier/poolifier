import { AsyncResource } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'

import { TaskRegistry } from '../../../lib/pools/task-registry.mjs'
import { registerTask, selectedLease } from './task-registry-fixture.mjs'

const registrationFixture = (abortSignal = new AbortController().signal) => {
  const asyncResource = new AsyncResource('task-registry-registration-test', {
    requireManualDestroy: true,
  })
  const emitDestroy = vi.spyOn(asyncResource, 'emitDestroy')
  const onAbort = vi.fn()
  const registry = new TaskRegistry()
  const reject = vi.fn()
  const resolve = vi.fn()
  const taskId = randomUUID()
  return {
    emitDestroy,
    input: {
      abortSignal,
      asyncResource,
      onAbort,
      reject,
      resolve,
      selectedLease,
      task: { data: { taskId }, name: 'echo', taskId },
    },
    onAbort,
    registry,
    taskId,
  }
}

const captureThrown = (callback = () => {}) => {
  try {
    callback()
  } catch (error) {
    return error
  }
  throw new Error('Expected callback to throw')
}

describe('Task registry settlement', () => {
  it('returns typed failures for invalid transitions without mutation', () => {
    const fixture = registerTask()

    expect(
      fixture.registry.transition(fixture.taskId, ['queued'], 'running')
    ).toStrictEqual({ ok: false, reason: 'state_mismatch' })
    expect(
      fixture.registry.transition(fixture.taskId, ['registered'], 'running')
    ).toStrictEqual({ ok: false, reason: 'state_mismatch' })
    expect(fixture.registry.get(fixture.taskId)?.state).toBe('registered')
    expect(
      fixture.registry.transition(randomUUID(), ['registered'], 'queued')
    ).toStrictEqual({ ok: false, reason: 'missing' })
  })

  it('owns the detached task payload', () => {
    const fixture = registerTask()
    fixture.registry.transition(
      fixture.taskId,
      ['registered'],
      'queued',
      selectedLease
    )

    const result = fixture.registry.transition(
      fixture.taskId,
      ['queued'],
      'detached'
    )

    expect(result.ok).toBe(true)
    expect(fixture.registry.get(fixture.taskId)?.task).toStrictEqual({
      data: { taskId: fixture.taskId },
      name: 'echo',
      taskId: fixture.taskId,
    })
  })

  it('preserves non-Error rejection identity', () => {
    const fixture = registerTask()
    const reason = { code: 'identity' }

    fixture.registry.settle(fixture.taskId, { error: reason, kind: 'rejected' })

    expect(fixture.reject).toHaveBeenCalledWith(reason)
  })

  it.each([new Error('pre-aborted'), null])(
    'synchronously requests a pre-aborted task without settling it',
    reason => {
      const controller = new AbortController()
      controller.abort(reason)
      const fixture = registerTask({ abortSignal: controller.signal })

      expect(fixture.onAbort).not.toHaveBeenCalled()
      expect(fixture.registry.size).toBe(1)
      const decision = fixture.registry.requestAbort(fixture.taskId)
      expect(decision.kind).toBe('settle-local')
      if (reason != null) {
        expect(decision.error).toBe(reason)
      } else {
        expect(decision.error).toStrictEqual(
          new Error(`Task 'echo' id '${fixture.taskId}' aborted`)
        )
      }
    }
  )

  it('uses the exact fallback for an undefined pre-abort reason', () => {
    const signal = {
      aborted: true,
      addEventListener: vi.fn(),
      reason: undefined,
      removeEventListener: vi.fn(),
    }
    const fixture = registerTask({ abortSignal: signal })

    expect(fixture.registry.requestAbort(fixture.taskId).error).toStrictEqual(
      new Error(`Task 'echo' id '${fixture.taskId}' aborted`)
    )
  })

  it('rolls back the exact record when abort listener installation throws before attachment', () => {
    const installFailure = { source: 'install-before-attachment' }
    const controller = new AbortController()
    vi.spyOn(controller.signal, 'addEventListener').mockImplementation(() => {
      throw installFailure
    })
    const subject = registrationFixture(controller.signal)

    const thrown = captureThrown(() => subject.registry.register(subject.input))

    expect(thrown).toBe(installFailure)
    expect(subject.registry.size).toBe(0)
    expect(subject.registry.get(subject.taskId)).toBeUndefined()
    expect(subject.onAbort).not.toHaveBeenCalled()
    expect(subject.emitDestroy).toHaveBeenCalledOnce()
  })

  it('removes an attached abort listener when installation then throws', () => {
    const installFailure = { source: 'install-after-attachment' }
    const controller = new AbortController()
    const addEventListener = controller.signal.addEventListener.bind(
      controller.signal
    )
    vi.spyOn(controller.signal, 'addEventListener').mockImplementation(
      (...arguments_) => {
        addEventListener(...arguments_)
        throw installFailure
      }
    )
    const removeEventListener = vi.spyOn(
      controller.signal,
      'removeEventListener'
    )
    const subject = registrationFixture(controller.signal)

    const thrown = captureThrown(() => subject.registry.register(subject.input))

    expect(thrown).toBe(installFailure)
    expect(removeEventListener).toHaveBeenCalledOnce()
    expect(subject.registry.size).toBe(0)
    expect(subject.registry.get(subject.taskId)).toBeUndefined()
    expect(subject.emitDestroy).toHaveBeenCalledOnce()
  })

  it('does not double-clean a record settled during listener reentry', () => {
    const installFailure = { source: 'install-after-abort' }
    const abortReason = { source: 'reentrant-abort' }
    const controller = new AbortController()
    const registry = new TaskRegistry()
    const reject = vi.fn()
    const resolve = vi.fn()
    const onAbort = vi.fn(taskId => {
      expect(registry.requestAbort(taskId)).toStrictEqual({
        error: abortReason,
        kind: 'settle-local',
        state: 'registered',
      })
      registry.settle(taskId, { error: abortReason, kind: 'rejected' })
    })
    const addEventListener = controller.signal.addEventListener.bind(
      controller.signal
    )
    vi.spyOn(controller.signal, 'addEventListener').mockImplementation(
      (...arguments_) => {
        addEventListener(...arguments_)
        controller.abort(abortReason)
        throw installFailure
      }
    )
    const removeEventListener = vi.spyOn(
      controller.signal,
      'removeEventListener'
    )
    const asyncResource = new AsyncResource('task-registry-registration-test', {
      requireManualDestroy: true,
    })
    const emitDestroy = vi.spyOn(asyncResource, 'emitDestroy')
    const taskId = randomUUID()

    const thrown = captureThrown(() =>
      registry.register({
        abortSignal: controller.signal,
        asyncResource,
        onAbort,
        reject,
        resolve,
        selectedLease,
        task: { data: { taskId }, name: 'echo', taskId },
      })
    )

    expect(thrown).toBe(installFailure)
    expect(onAbort).toHaveBeenCalledExactlyOnceWith(taskId)
    expect(reject).toHaveBeenCalledExactlyOnceWith(abortReason)
    expect(resolve).not.toHaveBeenCalled()
    expect(removeEventListener).toHaveBeenCalledOnce()
    expect(emitDestroy).toHaveBeenCalledOnce()
    expect(registry.size).toBe(0)
  })

  it('preserves listener installation failure when rollback cleanup also throws', () => {
    const installFailure = { source: 'install' }
    const removeFailure = { source: 'remove' }
    const destroyFailure = { source: 'destroy' }
    const controller = new AbortController()
    const addEventListener = controller.signal.addEventListener.bind(
      controller.signal
    )
    const removeEventListener = controller.signal.removeEventListener.bind(
      controller.signal
    )
    vi.spyOn(controller.signal, 'addEventListener').mockImplementation(
      (...arguments_) => {
        addEventListener(...arguments_)
        throw installFailure
      }
    )
    const removeEventListenerSpy = vi
      .spyOn(controller.signal, 'removeEventListener')
      .mockImplementation((...arguments_) => {
        removeEventListener(...arguments_)
        throw removeFailure
      })
    const subject = registrationFixture(controller.signal)
    subject.emitDestroy.mockImplementation(() => {
      throw destroyFailure
    })

    const thrown = captureThrown(() => subject.registry.register(subject.input))

    expect(thrown).toBe(installFailure)
    expect(removeEventListenerSpy).toHaveBeenCalledOnce()
    expect(subject.emitDestroy).toHaveBeenCalledOnce()
    expect(removeEventListenerSpy).toHaveBeenCalledBefore(subject.emitDestroy)
    expect(subject.registry.size).toBe(0)
    expect(subject.registry.get(subject.taskId)).toBeUndefined()
  })

  it('rejects duplicate registration without replacing the first record', () => {
    const fixture = registerTask()
    const secondReject = vi.fn()

    expect(() =>
      fixture.registry.register({
        asyncResource: new AsyncResource('duplicate'),
        onAbort: vi.fn(),
        reject: secondReject,
        resolve: vi.fn(),
        selectedLease,
        task: { name: 'duplicate', taskId: fixture.taskId },
      })
    ).toThrowError('Task already registered')
    fixture.registry.settle(fixture.taskId, {
      kind: 'resolved',
      value: 'first',
    })
    expect(fixture.resolve).toHaveBeenCalledWith('first')
    expect(secondReject).not.toHaveBeenCalled()
  })

  it('returns every settlement cleanup failure in operation order', () => {
    const callbackError = { source: 'callback' }
    const removeError = { source: 'remove' }
    const destroyError = { source: 'destroy' }
    const signal = {
      aborted: false,
      addEventListener: vi.fn(),
      reason: undefined,
      removeEventListener: vi.fn(() => {
        throw removeError
      }),
    }
    const fixture = registerTask({
      abortSignal: signal,
      resolve: vi.fn(() => {
        throw callbackError
      }),
    })
    fixture.emitDestroy.mockImplementation(() => {
      throw destroyError
    })

    const result = fixture.registry.settle(fixture.taskId, {
      kind: 'resolved',
      value: 1,
    })

    expect(result).toStrictEqual({
      effect: {
        executionStarted: false,
        outcome: 'executed',
        selectedLease,
        taskName: 'echo',
      },
      secondaryErrors: [callbackError, removeError, destroyError],
      settled: true,
    })
    expect(result.secondaryErrors[0]).toBe(callbackError)
    expect(result.secondaryErrors[1]).toBe(removeError)
    expect(result.secondaryErrors[2]).toBe(destroyError)
    expect(signal.removeEventListener).toHaveBeenCalledOnce()
    expect(fixture.emitDestroy).toHaveBeenCalledOnce()
    expect(fixture.registry.size).toBe(0)
  })
})
