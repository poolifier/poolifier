import { describe, expect, it, vi } from 'vitest'

import { createFixture } from './task-scheduler-fixture.mjs'

describe('Task scheduler compensation', () => {
  it('settles a pre-aborted task before dispatch, enqueue, or waiting-ready', () => {
    const fixture = createFixture()
    const controller = new AbortController()
    const abortReason = new Error('pre-aborted')
    controller.abort(abortReason)
    const { reject } = fixture.register('pre-aborted', controller.signal)

    const result = fixture.scheduler.schedule(
      'pre-aborted',
      fixture.permit,
      false
    )

    expect(result.kind).toBe('settled')
    expect(reject).toHaveBeenCalledWith(abortReason)
    expect(fixture.send).not.toHaveBeenCalled()
    expect(fixture.queue).toHaveLength(0)
    expect(fixture.registry.size).toBe(0)
  })

  it('rolls physical enqueue back when registry commit loses ownership', () => {
    const fixture = createFixture({ acquire: false })
    fixture.register('enqueue-rollback')
    fixture.registry.settle('enqueue-rollback', { kind: 'resolved', value: 1 })

    const result = fixture.scheduler.enqueue('enqueue-rollback', fixture.handle)

    expect(result.kind).toBe('settled')
    expect(fixture.queue).toHaveLength(0)
  })

  it('settles a dispatch when transport throws without leaving ownership', () => {
    const fixture = createFixture()
    const { reject } = fixture.register('send-throw')
    const transportError = new Error('transport')
    fixture.send.mockImplementation(() => {
      throw transportError
    })

    const result = fixture.scheduler.dispatch('send-throw', fixture.permit)

    expect(result.kind).toBe('settled')
    expect(reject).toHaveBeenCalledWith(transportError)
    expect(fixture.registry.size).toBe(0)
    expect(result.settlement?.settled).toBe(true)
  })

  it('removes queued ownership before local abort settlement', () => {
    const fixture = createFixture()
    const controller = new AbortController()
    const { reject } = fixture.register('queued-abort', controller.signal)
    fixture.scheduler.enqueue('queued-abort', fixture.handle)
    const reason = new Error('abort')
    controller.abort(reason)

    const result = fixture.scheduler.abort('queued-abort')

    expect(result.kind).toBe('settled')
    expect(fixture.queue).toHaveLength(0)
    expect(reject).toHaveBeenCalledWith(reason)
    expect(fixture.registry.size).toBe(0)
  })

  it('defers a synchronous dispatch abort until send commits running', () => {
    const fixture = createFixture()
    const controller = new AbortController()
    fixture.register('dispatch-abort', controller.signal)
    fixture.send.mockImplementation(() => controller.abort('during-send'))

    const result = fixture.scheduler.dispatch('dispatch-abort', fixture.permit)

    expect(result).toMatchObject({ kind: 'committed', state: 'cancelling' })
    expect(fixture.sendAbort).toHaveBeenCalledTimes(1)
    expect(fixture.registry.get('dispatch-abort')?.state).toBe('cancelling')
  })

  it('rolls cancelling back to running when abort transport throws', () => {
    const fixture = createFixture()
    const controller = new AbortController()
    fixture.register('abort-send-throw', controller.signal)
    fixture.scheduler.dispatch('abort-send-throw', fixture.permit)
    const abortError = new Error('abort transport')
    fixture.sendAbort.mockImplementation(() => {
      throw abortError
    })
    controller.abort('abort')

    const result = fixture.scheduler.abort('abort-send-throw')

    expect(result).toStrictEqual({ error: abortError, kind: 'retry' })
    expect(fixture.registry.get('abort-send-throw')?.state).toBe('running')
  })

  it('restores queued ownership when permit acquisition fails', () => {
    const fixture = createFixture({ acquire: false })
    fixture.register('acquire-fail')
    fixture.scheduler.enqueue('acquire-fail', fixture.handle)

    const result = fixture.scheduler.dequeueAndDispatch(fixture.handle)

    expect(result.kind).toBe('retry')
    expect(fixture.registry.get('acquire-fail')?.state).toBe('queued')
    expect(fixture.queue).toHaveLength(1)
  })

  it('settles when enqueue throws before ownership commit', () => {
    const fixture = createFixture()
    const enqueueError = new Error('enqueue')
    fixture.register('enqueue-throw')
    vi.spyOn(fixture.worker, 'enqueueTask').mockImplementation(() => {
      throw enqueueError
    })

    const result = fixture.scheduler.enqueue('enqueue-throw', fixture.handle)

    expect(result.kind).toBe('settled')
    expect(fixture.registry.size).toBe(0)
  })

  it('settles when queue delete compensation returns false', () => {
    const fixture = createFixture()
    fixture.register('delete-false')
    fixture.registry.transition(
      'delete-false',
      ['registered'],
      'assigned',
      fixture.handle.lease
    )
    fixture.registry.transition(
      'delete-false',
      ['assigned'],
      'dispatching',
      fixture.handle.lease
    )
    vi.spyOn(fixture.worker, 'deleteTask').mockReturnValue(false)

    const result = fixture.scheduler.enqueue('delete-false', fixture.handle)

    expect(result.kind).toBe('settled')
    expect(fixture.registry.size).toBe(0)
  })

  it('returns the original dequeue error without changing queued ownership', () => {
    const fixture = createFixture()
    fixture.register('dequeue-throw')
    fixture.scheduler.enqueue('dequeue-throw', fixture.handle)
    const dequeueError = new Error('dequeue')
    vi.spyOn(fixture.worker, 'dequeueTask').mockImplementation(() => {
      throw dequeueError
    })

    const result = fixture.scheduler.dequeueAndDispatch(fixture.handle)

    expect(result).toStrictEqual({ error: dequeueError, kind: 'retry' })
    expect(fixture.registry.get('dequeue-throw')?.state).toBe('queued')
  })

  it('settles every failed restore placement and continues later task ids', () => {
    const fixture = createFixture({ acquire: false })
    const first = fixture.register('restore-first')
    const second = fixture.register('restore-second')
    const firstError = new Error('first restore enqueue')
    const secondError = new Error('second restore enqueue')
    fixture.registry.transition('restore-first', ['registered'], 'detached')
    fixture.registry.transition('restore-second', ['registered'], 'detached')
    vi.spyOn(fixture.scheduler, 'enqueue')
      .mockReturnValueOnce({ error: firstError, kind: 'retry' })
      .mockReturnValueOnce({ error: secondError, kind: 'retry' })

    const results = fixture.scheduler.restore(
      ['restore-first', 'restore-second'],
      [fixture.handle]
    )

    expect(results.map(result => result.kind)).toStrictEqual([
      'settled',
      'settled',
    ])
    expect(first.reject).toHaveBeenCalledWith(firstError)
    expect(second.reject).toHaveBeenCalledWith(secondError)
    expect(
      results.every(
        result =>
          result.kind === 'settled' &&
          result.settlement?.effect?.executionStarted === false
      )
    ).toBe(true)
    expect(fixture.registry.size).toBe(0)
    expect(fixture.queue).toHaveLength(0)
  })

  it('settles enqueue failures during redistribution and continues', () => {
    const fixture = createFixture({ acquire: false })
    const first = fixture.register('redistribute-enqueue-first')
    const second = fixture.register('redistribute-enqueue-second')
    fixture.scheduler.enqueue('redistribute-enqueue-first', fixture.handle)
    fixture.scheduler.enqueue('redistribute-enqueue-second', fixture.handle)
    const firstError = new Error('first redistribution enqueue')
    const secondError = new Error('second redistribution enqueue')
    vi.spyOn(fixture.worker, 'enqueueTask')
      .mockImplementationOnce(() => {
        throw firstError
      })
      .mockImplementationOnce(() => {
        throw secondError
      })

    const results = fixture.scheduler.redistribute(fixture.handle)

    expect(results).toHaveLength(2)
    expect(first.reject).toHaveBeenCalledWith(firstError)
    expect(second.reject).toHaveBeenCalledWith(secondError)
    expect(
      results.every(
        result =>
          result.kind === 'settled' &&
          result.settlement?.effect?.executionStarted === false
      )
    ).toBe(true)
    expect(fixture.registry.size).toBe(0)
    expect(fixture.queue).toHaveLength(0)
  })

  it('settles transition failures during redistribution and continues', () => {
    const fixture = createFixture()
    const first = fixture.register('redistribute-first')
    const second = fixture.register('redistribute-second')
    fixture.scheduler.enqueue('redistribute-first', fixture.handle)
    fixture.scheduler.enqueue('redistribute-second', fixture.handle)
    const transitionError = new Error('detached transition')
    vi.spyOn(fixture.registry, 'transition').mockImplementation(
      (taskId, expected, next, lease) =>
        next === 'detached'
          ? (() => {
              throw transitionError
            })()
          : Object.getPrototypeOf(fixture.registry).transition.call(
            fixture.registry,
            taskId,
            expected,
            next,
            lease
          )
    )

    const results = fixture.scheduler.redistribute(fixture.handle)

    expect(results).toHaveLength(2)
    expect(results.every(result => result.kind === 'settled')).toBe(true)
    expect(first.reject).toHaveBeenCalledWith(transitionError)
    expect(second.reject).toHaveBeenCalledWith(transitionError)
    expect(
      results.every(
        result =>
          result.kind === 'settled' &&
          result.settlement?.effect?.executionStarted === false
      )
    ).toBe(true)
    expect(fixture.registry.size).toBe(0)
    expect(fixture.queue).toHaveLength(0)
  })
})
