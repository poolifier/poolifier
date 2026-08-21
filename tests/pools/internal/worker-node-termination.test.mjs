import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { WorkerTerminationError } from '../../../lib/index.mjs'
import { terminateWorker } from '../../../lib/pools/worker-termination.mjs'
import { WorkerTypes } from '../../../lib/pools/worker.mjs'

class FakeWorker extends EventEmitter {
  disconnect = vi.fn()
  id = 17
  kill = vi.fn(() => {
    this.emit('exit', 0)
  })

  terminate = vi.fn(() => Promise.resolve(0))
  unref = vi.fn()
}

const flushMicrotasks = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

describe('Worker termination operation', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('returns immediately when the worker already exited', async () => {
    // Given
    const worker = new FakeWorker()

    // When
    await terminateWorker(worker, WorkerTypes.thread, true)

    // Then
    expect(worker.unref).not.toHaveBeenCalled()
    expect(worker.terminate).not.toHaveBeenCalled()
    expect(worker.listenerCount('exit')).toBe(0)
  })

  it('completes a graceful thread termination and cleans its listener and timer', async () => {
    // Given
    vi.useFakeTimers()
    const worker = new FakeWorker()

    // When
    const termination = terminateWorker(worker, WorkerTypes.thread, false)
    await termination

    // Then
    expect(worker.unref).toHaveBeenCalledTimes(1)
    expect(worker.terminate).toHaveBeenCalledTimes(1)
    expect(worker.listenerCount('exit')).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('preserves a synchronous graceful request throw by identity and hard-stops once', async () => {
    // Given
    const worker = new FakeWorker()
    const gracefulError = { marker: 'graceful' }
    worker.disconnect.mockImplementation(() => {
      throw gracefulError
    })

    // When
    const termination = terminateWorker(worker, WorkerTypes.cluster, false)

    // Then
    await expect(termination).rejects.toBe(gracefulError)
    expect(worker.kill).toHaveBeenCalledExactlyOnceWith('SIGKILL')
  })

  it('preserves a non-Error hard-stop failure by identity', async () => {
    // Given
    const worker = new FakeWorker()
    const hardStopError = { marker: 'hard-stop' }
    worker.kill.mockImplementation(() => {
      throw hardStopError
    })

    // When
    const termination = terminateWorker(worker, WorkerTypes.cluster, false)
    worker.emit('disconnect')

    // Then
    await expect(termination).rejects.toBe(hardStopError)
    expect(worker.kill).toHaveBeenCalledExactlyOnceWith('SIGKILL')
  })

  it('reports unconfirmed cluster termination when ESRCH is not followed by exit', async () => {
    // Given
    vi.useFakeTimers()
    const worker = new FakeWorker()
    const alreadyGone = Object.assign(new Error('worker already exited'), {
      code: 'ESRCH',
    })
    worker.kill.mockImplementation(() => {
      throw alreadyGone
    })

    // When
    const termination = terminateWorker(worker, WorkerTypes.cluster, false)
    const terminationError = termination.catch(error => error)
    worker.emit('disconnect')
    await vi.advanceTimersByTimeAsync(5000)

    // Then
    const error = await terminationError
    expect(error).toBeInstanceOf(WorkerTerminationError)
    expect(error.workerId).toBe(17)
    expect(worker.kill).toHaveBeenCalledExactlyOnceWith('SIGKILL')
  })

  it('bounds a wedged thread termination with the referenced 5000ms grace timer', async () => {
    // Given
    vi.useFakeTimers()
    const worker = new FakeWorker()
    worker.terminate.mockReturnValue(new Promise(() => undefined))

    // When
    const termination = terminateWorker(worker, WorkerTypes.thread, false)
    await vi.advanceTimersByTimeAsync(5000)

    // Then
    await expect(termination).resolves.toBeUndefined()
    expect(worker.terminate).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('hard-stops a cluster worker once when grace expires', async () => {
    // Given
    vi.useFakeTimers()
    const worker = new FakeWorker()

    // When
    const termination = terminateWorker(worker, WorkerTypes.cluster, false)
    await vi.advanceTimersByTimeAsync(5000)
    await termination

    // Then
    expect(worker.kill).toHaveBeenCalledExactlyOnceWith('SIGKILL')
    expect(worker.listenerCount('disconnect')).toBe(0)
    expect(worker.listenerCount('exit')).toBe(0)
  })

  it('selects exit once when disconnect and duplicate exits race', async () => {
    // Given
    const worker = new FakeWorker()

    // When
    const termination = terminateWorker(worker, WorkerTypes.cluster, false)
    worker.emit('exit', 0)
    worker.emit('disconnect')
    worker.emit('exit', 0)
    await termination

    // Then
    expect(worker.kill).not.toHaveBeenCalled()
    expect(worker.listenerCount('disconnect')).toBe(0)
    expect(worker.listenerCount('exit')).toBe(0)
  })

  it('observes a late losing rejection after timeout without a second public error', async () => {
    // Given
    vi.useFakeTimers()
    const worker = new FakeWorker()
    const lateError = { marker: 'late-timeout-loser' }
    let rejectTermination
    worker.terminate.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectTermination = reject
      })
    )
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)

    try {
      // When
      const termination = terminateWorker(worker, WorkerTypes.thread, false)
      await vi.advanceTimersByTimeAsync(5000)
      await expect(termination).resolves.toBeUndefined()
      rejectTermination(lateError)
      await flushMicrotasks()

      // Then
      expect(unhandled).not.toHaveBeenCalled()
      await expect(termination).resolves.toBeUndefined()
    } finally {
      process.off('unhandledRejection', unhandled)
    }
  })

  it('observes a late losing rejection after exit without superseding exit', async () => {
    // Given
    const worker = new FakeWorker()
    const lateError = { marker: 'late-exit-loser' }
    let rejectTermination
    worker.terminate.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectTermination = reject
      })
    )
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)

    try {
      // When
      const termination = terminateWorker(worker, WorkerTypes.thread, false)
      worker.emit('exit', 0)
      await expect(termination).resolves.toBeUndefined()
      rejectTermination(lateError)
      await flushMicrotasks()

      // Then
      expect(unhandled).not.toHaveBeenCalled()
      await expect(termination).resolves.toBeUndefined()
    } finally {
      process.off('unhandledRejection', unhandled)
    }
  })

  it('keeps the first selected failure when cleanup observes a later exit', async () => {
    // Given
    const worker = new FakeWorker()
    const selectedError = { marker: 'selected' }
    worker.terminate.mockRejectedValue(selectedError)

    // When
    const termination = terminateWorker(worker, WorkerTypes.thread, false)
    await flushMicrotasks()
    worker.emit('exit', 1)

    // Then
    await expect(termination).rejects.toBe(selectedError)
    expect(worker.terminate).toHaveBeenCalledTimes(1)
  })
})
