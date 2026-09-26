import { describe, expect, it, vi } from 'vitest'

import { PoolEventPublisher } from '../../../lib/pools/pool-event-publisher.mjs'

describe('PoolEventPublisher', () => {
  it('preserves configured callback receiver and defers thrown identity', () => {
    const publisher = new PoolEventPublisher('publisher-test', true)
    const receiver = { id: 7 }
    const callbackError = { source: 'message' }
    const queued = []
    const queueMicrotaskSpy = vi
      .spyOn(globalThis, 'queueMicrotask')
      .mockImplementation(callback => queued.push(callback))
    const callback = vi.fn(function (message) {
      expect(this).toBe(receiver)
      expect(message).toBe('payload')
      throw callbackError
    })

    publisher.invoke(callback, receiver, ['payload'])

    expect(callback).toHaveBeenCalledTimes(1)
    expect(queued).toHaveLength(1)
    expect(() => queued[0]()).toThrow(callbackError)
    queueMicrotaskSpy.mockRestore()
  })

  it('defers every internal task-finished boundary after emit commits', () => {
    const publisher = new PoolEventPublisher('publisher-test', true)
    const listenerError = new Error('taskFinished')
    const queued = []
    const queueMicrotaskSpy = vi
      .spyOn(globalThis, 'queueMicrotask')
      .mockImplementation(callback => queued.push(callback))
    publisher.emitter.on('taskFinished', () => {
      throw listenerError
    })

    publisher.publishInternal(publisher.emitter, 'taskFinished', 'task-id')

    expect(queued).toHaveLength(1)
    expect(() => queued[0]()).toThrow(listenerError)
    queueMicrotaskSpy.mockRestore()
  })

  it('preserves first-throw semantics and defers the original value once', async () => {
    const publisher = new PoolEventPublisher('publisher-test', true)
    const firstError = { source: 'first' }
    const laterListener = vi.fn()
    const queued = []
    const queueMicrotaskSpy = vi
      .spyOn(globalThis, 'queueMicrotask')
      .mockImplementation(callback => queued.push(callback))
    publisher.emitter.on('busy', () => {
      throw firstError
    })
    publisher.emitter.on('busy', laterListener)

    publisher.publish('busy', { busy: true })

    expect(laterListener).not.toHaveBeenCalled()
    expect(queued).toHaveLength(1)
    expect(() => queued[0]()).toThrow(firstError)
    queueMicrotaskSpy.mockRestore()
  })

  it('transfers nested lifecycle errors to destroy without double drain', () => {
    const publisher = new PoolEventPublisher('publisher-test', true)
    const lease = { generation: 1, id: 2 }
    const firstError = new Error('worker callback')
    const secondError = new Error('destroy callback')
    const queued = []
    const queueMicrotaskSpy = vi
      .spyOn(globalThis, 'queueMicrotask')
      .mockImplementation(callback => queued.push(callback))
    publisher.collect(lease, firstError)
    publisher.collect('pool-destroy', secondError)

    publisher.transfer(lease, 'pool-destroy')
    publisher.drain(lease)
    publisher.drain('pool-destroy')
    publisher.drain('pool-destroy')

    expect(queued).toHaveLength(2)
    expect(() => queued[0]()).toThrow(secondError)
    expect(() => queued[1]()).toThrow(firstError)
    queueMicrotaskSpy.mockRestore()
  })
})
