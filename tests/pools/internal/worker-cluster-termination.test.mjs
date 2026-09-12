import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { WorkerTerminationError } from '../../../lib/index.mjs'
import { terminateWorker } from '../../../lib/pools/worker-termination.mjs'
import { WorkerTypes } from '../../../lib/pools/worker.mjs'

class FakeClusterWorker extends EventEmitter {
  disconnect = vi.fn()
  id = 17
  kill = vi.fn()
}

const observeSettlement = promise => {
  const fulfilled = vi.fn()
  const rejected = vi.fn()
  promise.then(fulfilled, rejected).catch(() => undefined)
  return { fulfilled, rejected }
}

const flushMicrotasks = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

describe('Cluster worker two-phase termination', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('treats disconnect as escalation rather than successful termination', async () => {
    // Given
    vi.useFakeTimers()
    const worker = new FakeClusterWorker()

    // When
    const termination = terminateWorker(worker, WorkerTypes.cluster, false)
    const settlement = observeSettlement(termination)
    worker.emit('disconnect')
    await flushMicrotasks()

    // Then
    expect(worker.kill).toHaveBeenCalledExactlyOnceWith('SIGKILL')
    expect(settlement.fulfilled).not.toHaveBeenCalled()
    expect(settlement.rejected).not.toHaveBeenCalled()
    worker.emit('exit', null, 'SIGKILL')
    await expect(termination).resolves.toBeUndefined()
  })

  it('starts a fresh 5000ms grace after requesting the hard stop', async () => {
    // Given
    vi.useFakeTimers()
    const worker = new FakeClusterWorker()

    // When
    const termination = terminateWorker(worker, WorkerTypes.cluster, false)
    const settlement = observeSettlement(termination)
    await vi.advanceTimersByTimeAsync(5000)

    // Then
    expect(worker.kill).toHaveBeenCalledTimes(1)
    expect(settlement.fulfilled).not.toHaveBeenCalled()
    expect(settlement.rejected).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(4999)
    expect(settlement.fulfilled).not.toHaveBeenCalled()
    expect(settlement.rejected).not.toHaveBeenCalled()
    worker.emit('exit', null, 'SIGKILL')
    await expect(termination).resolves.toBeUndefined()
  })

  it('resolves only after the hard-stopped worker emits exit', async () => {
    // Given
    vi.useFakeTimers()
    const worker = new FakeClusterWorker()

    // When
    const termination = terminateWorker(worker, WorkerTypes.cluster, false)
    const settlement = observeSettlement(termination)
    worker.emit('disconnect')
    await flushMicrotasks()

    // Then
    expect(settlement.fulfilled).not.toHaveBeenCalled()
    expect(settlement.rejected).not.toHaveBeenCalled()
    worker.emit('exit', null, 'SIGKILL')
    await expect(termination).resolves.toBeUndefined()
    expect(settlement.fulfilled).toHaveBeenCalledTimes(1)
    expect(settlement.rejected).not.toHaveBeenCalled()
  })

  it('preserves the graceful request failure after confirmed hard-stop exit', async () => {
    // Given
    const worker = new FakeClusterWorker()
    const gracefulError = { marker: 'graceful-request' }
    worker.disconnect.mockImplementation(() => {
      throw gracefulError
    })
    worker.kill.mockImplementation(() => {
      worker.emit('exit', null, 'SIGKILL')
    })

    // When
    const termination = terminateWorker(worker, WorkerTypes.cluster, false)

    // Then
    await expect(termination).rejects.toBe(gracefulError)
    expect(worker.kill).toHaveBeenCalledExactlyOnceWith('SIGKILL')
  })

  it('preserves the hard-stop request failure by identity', async () => {
    // Given
    const worker = new FakeClusterWorker()
    const hardStopError = { marker: 'hard-stop-request' }
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

  it('rejects when the hard-stop grace expires without an observed exit', async () => {
    // Given
    vi.useFakeTimers()
    const worker = new FakeClusterWorker()

    // When
    const termination = terminateWorker(worker, WorkerTypes.cluster, false)
    const terminationError = termination.catch(error => error)
    await vi.advanceTimersByTimeAsync(5000)
    await vi.advanceTimersByTimeAsync(5000)

    // Then
    const error = await terminationError
    expect(error).toBeInstanceOf(WorkerTerminationError)
    expect(error.workerId).toBe(17)
    expect(worker.kill).toHaveBeenCalledExactlyOnceWith('SIGKILL')
  })

  it('rejects ESRCH without an observed exit as unconfirmed termination', async () => {
    // Given
    vi.useFakeTimers()
    const worker = new FakeClusterWorker()
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
})
