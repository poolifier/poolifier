import { describe, expect, it, vi } from 'vitest'

import { TaskFunctionBroadcaster } from '../../../lib/pools/task-function-broadcaster.mjs'

const operation = {
  taskFunctionOperation: 'add',
  taskFunctionOperationId: 'operation-1',
  taskFunctionProperties: { name: 'fn' },
}

const createFixture = ({ deregisterFailure, removeFailure } = {}) => {
  const handle = { lease: { generation: 0, id: 7 }, worker: {} }
  const listeners = new Set()
  const deregister = vi.fn((_handle, listener) => {
    if (deregisterFailure !== undefined) throw deregisterFailure
    listeners.delete(listener)
  })
  const transport = {
    admit: vi.fn(() => true),
    deregister,
    isCurrent: vi.fn(() => true),
    register: vi.fn((_handle, listener) => listeners.add(listener)),
    send: vi.fn(),
    snapshot: () => [],
  }
  const controller = new AbortController()
  const removeEventListener = vi.fn(() => {
    if (removeFailure !== undefined) throw removeFailure
  })
  controller.signal.removeEventListener = removeEventListener
  const emit = message => {
    for (const listener of listeners) listener(message)
  }
  return {
    broadcaster: new TaskFunctionBroadcaster(transport),
    controller,
    deregister,
    emit,
    handle,
    listeners,
    removeEventListener,
    transport,
  }
}

const response = (status, workerId = 7) => ({
  ...operation,
  taskFunctionOperationStatus: status,
  workerId,
})

describe('TaskFunctionBroadcaster exception-safe cleanup', () => {
  it('preserves an operation Error and attempts both cleanup steps when both throw', async () => {
    const operationError = new Error('send failed')
    const fixture = createFixture({
      deregisterFailure: new Error('deregister failed'),
      removeFailure: new Error('remove failed'),
    })
    fixture.transport.send.mockImplementation(() => {
      throw operationError
    })

    const result = fixture.broadcaster.sendToWorker(
      fixture.handle,
      operation,
      fixture.controller.signal
    )

    await expect(result).rejects.toBe(operationError)
    expect(fixture.removeEventListener).toHaveBeenCalledOnce()
    expect(fixture.deregister).toHaveBeenCalledOnce()
  })

  it('rejects the first cleanup Error for a true response without emission throwing', async () => {
    const removeError = new Error('remove failed')
    const fixture = createFixture({
      deregisterFailure: new Error('deregister failed'),
      removeFailure: removeError,
    })
    const result = fixture.broadcaster.sendToWorker(
      fixture.handle,
      operation,
      fixture.controller.signal
    )

    expect(() => fixture.emit(response(true))).not.toThrow()
    await expect(result).rejects.toBe(removeError)
    expect(fixture.removeEventListener).toHaveBeenCalledOnce()
    expect(fixture.deregister).toHaveBeenCalledOnce()
  })

  it('rejects the first cleanup Error for a false response without emission throwing', async () => {
    const removeError = new Error('remove failed')
    const fixture = createFixture({
      deregisterFailure: new Error('deregister failed'),
      removeFailure: removeError,
    })
    const result = fixture.broadcaster.sendToWorker(
      fixture.handle,
      operation,
      fixture.controller.signal
    )

    expect(() => fixture.emit(response(false))).not.toThrow()
    await expect(result).rejects.toBe(removeError)
    expect(fixture.removeEventListener).toHaveBeenCalledOnce()
    expect(fixture.deregister).toHaveBeenCalledOnce()
  })

  it('normalizes a non-Error first cleanup failure and still deregisters', async () => {
    const fixture = createFixture({ removeFailure: 'remove failed' })
    const result = fixture.broadcaster.sendToWorker(
      fixture.handle,
      operation,
      fixture.controller.signal
    )

    expect(() => fixture.emit(response(true))).not.toThrow()
    await expect(result).rejects.toEqual(new Error('remove failed'))
    expect(fixture.removeEventListener).toHaveBeenCalledOnce()
    expect(fixture.deregister).toHaveBeenCalledOnce()
    expect(fixture.listeners.size).toBe(0)
  })
})
