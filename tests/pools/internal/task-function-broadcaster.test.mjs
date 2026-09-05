import { describe, expect, it, vi } from 'vitest'

import { WorkerTerminationError } from '../../../lib/index.mjs'
import { TaskFunctionBroadcaster } from '../../../lib/pools/task-function-broadcaster.mjs'

const createFixture = () => {
  const listeners = new Map()
  const calls = []
  const transport = {
    admit: vi.fn(() => true),
    deregister: (handle, listener) => {
      calls.push(['deregister', handle])
      listeners.get(handle)?.delete(listener)
    },
    isCurrent: vi.fn(() => true),
    register: (handle, listener) => {
      calls.push(['register', handle])
      const registered = listeners.get(handle) ?? new Set()
      registered.add(listener)
      listeners.set(handle, registered)
    },
    send: (handle, message) => calls.push(['send', handle, message]),
    snapshot: () => [],
  }
  const emit = (handle, message) => {
    for (const listener of listeners.get(handle) ?? []) listener(message)
  }
  return {
    broadcaster: new TaskFunctionBroadcaster(transport),
    calls,
    emit,
    listeners,
    transport,
  }
}

const operation = (overrides = {}) => ({
  taskFunctionOperation: 'add',
  taskFunctionOperationId: 'operation-1',
  taskFunctionProperties: { name: 'fn' },
  ...overrides,
})

const response = (workerId, overrides = {}) => ({
  ...operation(),
  taskFunctionOperationStatus: true,
  workerId,
  ...overrides,
})

describe('TaskFunctionBroadcaster', () => {
  it('registers before sending and cleans up after an exact response', async () => {
    const fixture = createFixture()
    const handle = { lease: { generation: 0, id: 7 }, worker: {} }
    const message = operation()

    const result = fixture.broadcaster.sendToWorker(handle, message)
    expect(fixture.calls.map(call => call[0])).toStrictEqual([
      'register',
      'send',
    ])
    fixture.emit(handle, response(7))

    await expect(result).resolves.toBe(true)
    expect(fixture.calls.at(-1)?.[0]).toBe('deregister')
    expect(fixture.listeners.get(handle)?.size).toBe(0)
  })

  it('rejects an inadmissible worker before registering request ownership', async () => {
    const fixture = createFixture()
    const handle = { lease: { generation: 0, id: 7 }, worker: {} }
    const controller = new AbortController()
    const addAbortListener = vi.spyOn(controller.signal, 'addEventListener')
    const removeAbortListener = vi.spyOn(
      controller.signal,
      'removeEventListener'
    )
    const cleanupError = new Error('red cleanup')
    fixture.transport.admit.mockReturnValue(false)
    const result = fixture.broadcaster
      .sendToWorker(handle, operation(), controller.signal)
      .then(
        value => value,
        error => error
      )
    const callsBeforeCleanup = [...fixture.calls]

    fixture.broadcaster.reject(handle, cleanupError)
    const outcome = await result
    const callsAfterCleanup = [...fixture.calls]

    expect(fixture.transport.admit).toHaveBeenCalledExactlyOnceWith(handle)
    expect(callsBeforeCleanup).toStrictEqual([])
    expect(callsAfterCleanup).toStrictEqual([])
    expect(addAbortListener).not.toHaveBeenCalled()
    expect(removeAbortListener).not.toHaveBeenCalled()
    expect(fixture.listeners.get(handle)?.size ?? 0).toBe(0)
    expect(outcome).toBeInstanceOf(WorkerTerminationError)
    expect(outcome.workerId).toBe(handle.lease.id)
    expect(outcome).not.toBe(cleanupError)
  })

  it('correlates reversed responses to their exact one-lease requests', async () => {
    const fixture = createFixture()
    const first = { lease: { generation: 0, id: 1 }, worker: {} }
    const second = { lease: { generation: 0, id: 2 }, worker: {} }
    fixture.transport.snapshot = () => [first, second]
    const result = fixture.broadcaster.sendToWorkers(operation())

    fixture.emit(second, response(2))
    fixture.emit(first, response(1))

    await expect(result).resolves.toBe(true)
    expect(fixture.calls.filter(call => call[0] === 'deregister')).toHaveLength(
      2
    )
  })

  it.each([
    ['missing operation id', { taskFunctionOperationId: undefined }],
    ['wrong operation id', { taskFunctionOperationId: 'operation-2' }],
    ['wrong operation', { taskFunctionOperation: 'remove' }],
    ['wrong function name', { taskFunctionProperties: { name: 'other' } }],
    ['wrong worker id', { workerId: 8 }],
  ])('ignores a response with %s', async (_label, mismatch) => {
    const fixture = createFixture()
    const handle = { lease: { generation: 0, id: 7 }, worker: {} }
    const result = fixture.broadcaster.sendToWorker(handle, operation())

    fixture.emit(handle, response(7, mismatch))
    expect(fixture.listeners.get(handle)?.size).toBe(1)
    fixture.emit(handle, response(7))

    await expect(result).resolves.toBe(true)
  })

  it('ignores duplicate and stale-generation responses', async () => {
    const fixture = createFixture()
    const stale = { lease: { generation: 0, id: 7 }, worker: {} }
    const current = { lease: { generation: 1, id: 7 }, worker: {} }
    fixture.transport.isCurrent.mockImplementation(handle => handle === current)
    const staleResult = fixture.broadcaster.sendToWorker(stale, operation())
    const currentResult = fixture.broadcaster.sendToWorker(current, operation())

    fixture.emit(stale, response(7))
    fixture.emit(current, response(7))
    fixture.emit(current, response(7))

    await expect(currentResult).resolves.toBe(true)
    expect(fixture.listeners.get(current)?.size).toBe(0)
    const failure = new Error('stale worker crashed')
    fixture.broadcaster.reject(stale, failure)
    await expect(staleResult).rejects.toBe(failure)
  })

  it('keeps legacy requests compatible without requiring an operation id', async () => {
    const fixture = createFixture()
    const handle = { lease: { generation: 0, id: 7 }, worker: {} }
    const legacyOperation = operation({ taskFunctionOperationId: undefined })
    const result = fixture.broadcaster.sendToWorker(handle, legacyOperation)

    fixture.emit(handle, response(7, { taskFunctionOperationId: undefined }))

    await expect(result).resolves.toBe(true)
  })

  it('rejects immediately and cleans up when aborted', async () => {
    const fixture = createFixture()
    const handle = { lease: { generation: 0, id: 7 }, worker: {} }
    const controller = new AbortController()
    const failure = new Error('topology changed')
    const result = fixture.broadcaster.sendToWorker(
      handle,
      operation(),
      controller.signal
    )

    controller.abort(failure)

    await expect(result).rejects.toBe(failure)
    expect(fixture.listeners.get(handle)?.size).toBe(0)
  })

  it('rejects every request for the exact crashed generation with the same error', async () => {
    const fixture = createFixture()
    const crashed = { lease: { generation: 4, id: 3 }, worker: {} }
    const replacement = { lease: { generation: 5, id: 3 }, worker: {} }
    const response = fixture.broadcaster.sendToWorker(crashed, {
      ...operation({ taskFunctionOperation: 'default' }),
    })
    const failure = new Error('worker crashed')

    fixture.broadcaster.reject(replacement, failure)
    expect(fixture.listeners.get(crashed)?.size).toBe(1)
    fixture.broadcaster.reject(crashed, failure)

    await expect(response).rejects.toBe(failure)
    expect(fixture.listeners.get(crashed)?.size).toBe(0)
  })

  it('reports a protocol NACK and removes all listeners', async () => {
    const fixture = createFixture()
    const handle = { lease: { generation: 0, id: 5 }, worker: {} }
    const result = fixture.broadcaster.sendToWorker(handle, {
      ...operation({ taskFunctionOperation: 'remove' }),
    })

    fixture.emit(handle, {
      ...operation({ taskFunctionOperation: 'remove' }),
      taskFunctionOperationStatus: false,
      workerError: { message: 'missing' },
      workerId: 5,
    })

    await expect(result).resolves.toBe(false)
    expect(fixture.listeners.get(handle)?.size).toBe(0)
  })

  it('reports a protocol NACK carrying a worker error', async () => {
    const fixture = createFixture()
    const handle = { lease: { generation: 0, id: 6 }, worker: {} }
    const result = fixture.broadcaster.sendToWorker(handle, operation())
    const failure = new TypeError('invalid task function')

    fixture.emit(handle, {
      ...operation(),
      taskFunctionOperationStatus: false,
      workerError: { error: failure, message: failure.message },
      workerId: 6,
    })

    await expect(result).resolves.toBe(false)
  })

  it('cleans up and preserves a synchronous transport failure', async () => {
    const fixture = createFixture()
    const handle = { lease: { generation: 0, id: 8 }, worker: {} }
    const failure = new Error('send failed')
    fixture.transport.send = () => {
      throw failure
    }

    const response = fixture.broadcaster.sendToWorker(handle, {
      ...operation({ taskFunctionOperation: 'remove' }),
    })

    await expect(response).rejects.toBe(failure)
    expect(fixture.listeners.get(handle)?.size).toBe(0)
  })
})
