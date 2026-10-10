import { describe, expect, it, vi } from 'vitest'

import { WorkerCrashError } from '../../../lib/index.mjs'
import { WorkerTerminalController } from '../../../lib/pools/worker-terminal-controller.mjs'

const createWorker = (drain, id = 1) => ({
  info: { dynamic: false, id },
  usage: { tasks: { executing: 1 } },
  waitForTransportDrain: () => drain.promise,
})

const createFixture = () => {
  const callbacks = {
    isAbnormalExit: vi.fn((code, signal) => code !== 0 || signal != null),
    rejectOwnedTasks: vi.fn((_handle, error) => error),
    rejectTaskFunctionRequests: vi.fn(),
    track: vi.fn(),
  }
  const result = {
    cause: undefined,
    classification: 'faulted',
    committed: true,
    lease: { generation: 1, id: 1 },
  }
  const coordinator = {
    classification: vi.fn(() => 'draining'),
    exit: vi.fn(async () => result),
    promoteTerminalFault: vi.fn(() => true),
    quarantine: vi.fn(),
    reconcileTerminal: vi.fn(async () => result),
  }
  return {
    callbacks,
    controller: new WorkerTerminalController(coordinator, callbacks),
    coordinator,
  }
}

const createHandle = (worker, generation = 1) => ({
  lease: { generation, id: worker.info.id },
  worker,
})

describe('WorkerTerminalController', () => {
  it('treats an exit during awaited physical termination as expected', async () => {
    const { callbacks, controller, coordinator } = createFixture()
    const drain = Promise.withResolvers()
    const physicalTermination = Promise.withResolvers()
    const handle = createHandle(createWorker(drain))

    const termination = controller.terminate(
      handle,
      async () => await physicalTermination.promise
    )
    controller.exit(handle, 0, null)
    physicalTermination.resolve()
    await termination

    expect(callbacks.rejectOwnedTasks).not.toHaveBeenCalled()
    expect(callbacks.rejectTaskFunctionRequests).not.toHaveBeenCalled()
    expect(coordinator.promoteTerminalFault).not.toHaveBeenCalled()
    expect(coordinator.exit).toHaveBeenCalledExactlyOnceWith(handle, {
      code: 0,
      signal: null,
    })
  })

  it('does not suppress an error emitted during physical termination', async () => {
    const { callbacks, controller, coordinator } = createFixture()
    const drain = Promise.withResolvers()
    const physicalTermination = Promise.withResolvers()
    const handle = createHandle(createWorker(drain))
    const cause = new Error('crashed while terminating')
    const taskError = new WorkerCrashError('Worker node crashed', {
      taskId: '00000000-0000-0000-0000-000000000f00',
      workerId: handle.lease.id,
    })
    callbacks.rejectOwnedTasks.mockReturnValue(taskError)

    const termination = controller.terminate(
      handle,
      async () => await physicalTermination.promise
    )
    controller.error(handle, cause)
    drain.resolve()
    physicalTermination.resolve()
    await termination
    await callbacks.track.mock.calls[0][1]

    const poolError = callbacks.rejectOwnedTasks.mock.calls[0][1]
    const managementError =
      callbacks.rejectTaskFunctionRequests.mock.calls[0][1]
    expect(poolError).toBeInstanceOf(WorkerCrashError)
    expect(poolError.message).toBe(
      'Worker node crashed: crashed while terminating'
    )
    expect(poolError.cause).toBe(cause)
    expect(poolError.taskId).toBeUndefined()
    expect(poolError.workerId).toBe(handle.lease.id)
    expect(poolError.exitCode).toBeNull()
    expect(poolError.signal).toBeNull()
    expect(taskError).not.toBe(poolError)

    expect(managementError).toBeInstanceOf(WorkerCrashError)
    expect(managementError).not.toBe(poolError)
    expect(managementError.message).toBe('Worker node crashed')
    expect(Object.hasOwn(managementError, 'cause')).toBe(false)
    expect(managementError.message).not.toContain('crashed while terminating')
    expect(managementError.stack).not.toContain('crashed while terminating')
    expect(managementError.taskId).toBeUndefined()
    expect(managementError.workerId).toBe(poolError.workerId)
    expect(managementError.exitCode).toBe(poolError.exitCode)
    expect(managementError.signal).toBe(poolError.signal)

    expect(callbacks.rejectOwnedTasks).toHaveBeenCalledExactlyOnceWith(
      handle,
      poolError
    )
    expect(
      callbacks.rejectTaskFunctionRequests
    ).toHaveBeenCalledExactlyOnceWith(handle, managementError)
    expect(coordinator.promoteTerminalFault).toHaveBeenCalledExactlyOnceWith(
      handle,
      poolError
    )
    expect(coordinator.reconcileTerminal).toHaveBeenCalledOnce()
    expect(coordinator.reconcileTerminal.mock.calls[0][1].cause).toBe(poolError)
  })

  it.each(['draining', 'exited'])(
    'keeps the raw error without a task authoritative after %s promotion',
    async classification => {
      const { callbacks, controller, coordinator } = createFixture()
      const drain = Promise.withResolvers()
      const handle = createHandle(createWorker(drain))
      const rawCause = new Error('promoted crash raw sentinel')
      const taskError = new WorkerCrashError('Worker node crashed', {
        taskId: '00000000-0000-0000-0000-000000000f01',
        workerId: handle.lease.id,
      })
      coordinator.classification.mockReturnValue(classification)
      callbacks.rejectOwnedTasks.mockReturnValue(taskError)

      controller.error(handle, rawCause)
      drain.resolve()
      await callbacks.track.mock.calls[0][1]

      const poolError = callbacks.rejectOwnedTasks.mock.calls[0][1]
      const managementError =
        callbacks.rejectTaskFunctionRequests.mock.calls[0][1]
      expect(poolError).toBeInstanceOf(WorkerCrashError)
      expect(poolError).not.toBe(taskError)
      expect(poolError.message).toBe(
        'Worker node crashed: promoted crash raw sentinel'
      )
      expect(poolError.cause).toBe(rawCause)
      expect(poolError.taskId).toBeUndefined()
      expect(poolError.workerId).toBe(handle.lease.id)
      expect(poolError.exitCode).toBeNull()
      expect(poolError.signal).toBeNull()

      expect(managementError).toBeInstanceOf(WorkerCrashError)
      expect(managementError).not.toBe(poolError)
      expect(managementError.message).toBe('Worker node crashed')
      expect(Object.hasOwn(managementError, 'cause')).toBe(false)
      expect(managementError.message).not.toContain(
        'promoted crash raw sentinel'
      )
      expect(managementError.stack).not.toContain('promoted crash raw sentinel')
      expect(managementError.taskId).toBeUndefined()
      expect(managementError.workerId).toBe(poolError.workerId)
      expect(managementError.exitCode).toBe(poolError.exitCode)
      expect(managementError.signal).toBe(poolError.signal)

      expect(callbacks.rejectOwnedTasks).toHaveBeenCalledExactlyOnceWith(
        handle,
        poolError
      )
      expect(
        callbacks.rejectTaskFunctionRequests
      ).toHaveBeenCalledExactlyOnceWith(handle, managementError)
      expect(coordinator.promoteTerminalFault).toHaveBeenCalledExactlyOnceWith(
        handle,
        poolError
      )
      expect(coordinator.reconcileTerminal).toHaveBeenCalledOnce()
      expect(coordinator.reconcileTerminal.mock.calls[0][1].cause).toBe(
        poolError
      )
    }
  )

  it.each([
    [
      'error then exit',
      (controller, handle, cause) => {
        controller.error(handle, cause)
        controller.exit(handle, 9, 'SIGKILL')
      },
    ],
    [
      'exit then error',
      (controller, handle, cause) => {
        controller.exit(handle, 9, 'SIGKILL')
        controller.error(handle, cause)
      },
    ],
  ])(
    'deduplicates %s into one representative and reconciliation',
    async (_order, signal) => {
      const { callbacks, controller, coordinator } = createFixture()
      const drain = Promise.withResolvers()
      const handle = createHandle(createWorker(drain))

      signal(controller, handle, new Error('terminal error'))
      expect(callbacks.track).toHaveBeenCalledTimes(2)
      expect(callbacks.track.mock.calls[1][1]).toBe(
        callbacks.track.mock.calls[0][1]
      )
      drain.resolve()
      await callbacks.track.mock.calls[0][1]

      const representative = callbacks.rejectOwnedTasks.mock.results[0].value
      expect(representative).toBeInstanceOf(WorkerCrashError)
      expect(callbacks.rejectOwnedTasks).toHaveBeenCalledOnce()
      expect(callbacks.rejectTaskFunctionRequests).toHaveBeenCalledOnce()
      expect(coordinator.promoteTerminalFault).toHaveBeenCalledOnce()
      expect(coordinator.promoteTerminalFault.mock.calls[0][1]).toBe(
        representative
      )
      expect(coordinator.reconcileTerminal).toHaveBeenCalledOnce()
    }
  )

  it('keeps terminal state independent for worker objects sharing an ID', async () => {
    const { callbacks, controller, coordinator } = createFixture()
    const firstDrain = Promise.withResolvers()
    const secondDrain = Promise.withResolvers()
    const first = createHandle(createWorker(firstDrain, 7), 1)
    const second = createHandle(createWorker(secondDrain, 7), 2)

    controller.error(first, new Error('first crash'))
    controller.error(second, new Error('second crash'))

    expect(callbacks.rejectOwnedTasks).toHaveBeenCalledTimes(2)
    expect(callbacks.rejectTaskFunctionRequests).toHaveBeenCalledTimes(2)
    expect(callbacks.rejectOwnedTasks.mock.results[0].value).not.toBe(
      callbacks.rejectOwnedTasks.mock.results[1].value
    )
    expect(callbacks.track.mock.calls[0][1]).not.toBe(
      callbacks.track.mock.calls[1][1]
    )
    firstDrain.resolve()
    secondDrain.resolve()
    await Promise.all(callbacks.track.mock.calls.map(([, promise]) => promise))
    expect(coordinator.reconcileTerminal).toHaveBeenCalledTimes(2)
  })
})
