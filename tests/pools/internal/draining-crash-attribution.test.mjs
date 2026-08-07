import { AsyncResource } from 'node:async_hooks'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { FixedThreadPool, WorkerCrashError } from '../../../lib/index.mjs'
import { TerminalSignalAggregator } from '../../../lib/pools/terminal-signal-aggregator.mjs'
import { createPoolCleanup } from '../crash-recovery-utils.mjs'

const taskIds = {
  active: '00000000-0000-4000-8000-000000000301',
  activeB: '00000000-0000-4000-8000-000000000302',
  queued: '00000000-0000-4000-8000-000000000303',
}

describe('Draining crash attribution', () => {
  const { cleanupPools, trackPool } = createPoolCleanup()

  afterEach(() => {
    vi.restoreAllMocks()
    return cleanupPools()
  })

  const exerciseCrash = ({
    activeIds,
    ids,
    message = 'Worker node crashed',
    reservations,
  }) => {
    const pool = trackPool(
      new FixedThreadPool(1, './tests/worker-files/thread/hangWorker.mjs', {
        errorHandler: () => undefined,
        restartWorkerOnError: false,
      })
    )
    const workerNode = pool.workerNodes[0]
    const handle = pool.workerLifecycleCoordinator.handle(workerNode)
    const rawCause = new Error('raw crash sentinel')
    const baseError = new WorkerCrashError(message, {
      cause: rawCause,
      exitCode: 9,
      workerId: handle.lease.id,
    })
    vi.spyOn(pool.taskRegistry, 'snapshotByLease').mockReturnValue(ids)
    const activeSnapshot = vi.fn().mockReturnValue(activeIds)
    pool.taskRegistry.snapshotActiveReconciliationTaskIds = activeSnapshot
    const reserve = vi
      .spyOn(pool.taskScheduler, 'reserveForReconciliation')
      .mockReturnValue(reservations)
    const settle = vi.spyOn(pool, 'rejectTaskPromise').mockReturnValue(true)

    const representative = pool.rejectOwnedTasks(handle, baseError)

    return {
      activeSnapshot,
      baseError,
      handle,
      rawCause,
      representative,
      reserve,
      settle,
    }
  }

  it('reserves owned tasks exactly once before snapshotting attribution', () => {
    const result = exerciseCrash({
      activeIds: [taskIds.active],
      ids: [taskIds.active],
      reservations: [
        {
          lease: { generation: 0, id: 0 },
          previousState: 'running',
          taskId: taskIds.active,
        },
      ],
    })

    expect(result.reserve).toHaveBeenCalledOnce()
    expect(result.activeSnapshot).toHaveBeenCalledOnce()
    expect(result.reserve.mock.invocationCallOrder[0]).toBeLessThan(
      result.activeSnapshot.mock.invocationCallOrder[0]
    )
  })

  it('preserves raw cause when crash reservation begins from executing state', () => {
    const result = exerciseCrash({
      activeIds: [taskIds.active],
      ids: [taskIds.active],
      reservations: [
        {
          lease: { generation: 0, id: 0 },
          previousState: 'running',
          taskId: taskIds.active,
        },
      ],
    })

    expect(result.settle.mock.calls[0][2].cause).toBe(result.rawCause)
  })

  it('preserves raw cause for one active task reserved before worker error', () => {
    const result = exerciseCrash({
      activeIds: [taskIds.active],
      ids: [taskIds.active],
      reservations: [],
    })

    expect(result.settle.mock.calls[0][2].cause).toBe(result.rawCause)
  })

  it('preserves raw exit description for one active task reserved before worker exit', () => {
    const message = 'Worker node exited unexpectedly (code 9)'
    const result = exerciseCrash({
      activeIds: [taskIds.active],
      ids: [taskIds.active],
      message,
      reservations: [],
    })

    expect(result.settle.mock.calls[0][2].message).toBe(message)
  })

  it('sanitizes queued work while settling active first', () => {
    const result = exerciseCrash({
      activeIds: [taskIds.active],
      ids: [taskIds.queued, taskIds.active],
      reservations: [],
    })

    expect(result.settle.mock.calls.map(([taskId]) => taskId)).toStrictEqual([
      taskIds.active,
      taskIds.queued,
    ])
    expect(result.settle.mock.calls[0][2].cause).toBe(result.rawCause)
    expect(Object.hasOwn(result.settle.mock.calls[1][2], 'cause')).toBe(false)
  })

  it('sanitizes every task when multiple active tasks are owned', () => {
    const result = exerciseCrash({
      activeIds: [taskIds.active, taskIds.activeB],
      ids: [taskIds.active, taskIds.activeB],
      reservations: [
        {
          lease: { generation: 0, id: 0 },
          previousState: 'running',
          taskId: taskIds.active,
        },
        {
          lease: { generation: 0, id: 0 },
          previousState: 'cancelling',
          taskId: taskIds.activeB,
        },
      ],
    })

    expect(
      result.settle.mock.calls.every(
        ([, , error]) => !Object.hasOwn(error, 'cause')
      )
    ).toBe(true)
  })

  it('sanitizes queued-only work', () => {
    const result = exerciseCrash({
      activeIds: [],
      ids: [taskIds.queued],
      reservations: [
        {
          lease: { generation: 0, id: 0 },
          previousState: 'queued',
          taskId: taskIds.queued,
        },
      ],
    })

    expect(Object.hasOwn(result.settle.mock.calls[0][2], 'cause')).toBe(false)
  })

  it('attributes cancelling work and cleans abort ownership once', async () => {
    const pool = trackPool(
      new FixedThreadPool(1, './tests/worker-files/thread/hangWorker.mjs', {
        errorHandler: () => undefined,
        restartWorkerOnError: false,
      })
    )
    const workerNode = pool.workerNodes[0]
    const handle = pool.workerLifecycleCoordinator.handle(workerNode)
    const controller = new AbortController()
    const removeAbortListener = vi.spyOn(
      controller.signal,
      'removeEventListener'
    )
    const resource = new AsyncResource('cancelling-attribution-test', {
      requireManualDestroy: true,
    })
    const emitDestroy = vi.spyOn(resource, 'emitDestroy')
    const outcome = Promise.withResolvers()
    const reject = vi.fn(outcome.reject)
    let abortDecision
    const onAbort = vi.fn(taskId => {
      abortDecision = pool.taskRegistry.requestAbort(taskId)
    })
    pool.taskRegistry.register({
      abortSignal: controller.signal,
      asyncResource: resource,
      onAbort,
      reject,
      resolve: outcome.resolve,
      selectedLease: handle.lease,
      task: { data: {}, name: 'echo', taskId: taskIds.active },
    })
    pool.taskRegistry.transition(
      taskIds.active,
      ['registered'],
      'assigned',
      handle.lease
    )
    pool.taskRegistry.transition(
      taskIds.active,
      ['assigned'],
      'dispatching',
      handle.lease
    )
    pool.taskRegistry.transition(
      taskIds.active,
      ['dispatching'],
      'running',
      handle.lease
    )
    const rawCause = new Error('cancelling raw crash sentinel')
    controller.abort(rawCause)
    expect(abortDecision?.kind).toBe('send-running-abort')
    expect(onAbort).toHaveBeenCalledExactlyOnceWith(taskIds.active)
    expect(pool.taskRegistry.get(taskIds.active)?.state).toBe('cancelling')
    const reserved = pool.taskRegistry.reserveForReconciliation(
      [taskIds.active],
      handle.lease
    )
    expect(reserved).toMatchObject([
      { previousState: 'cancelling', taskId: taskIds.active },
    ])

    pool.rejectOwnedTasks(
      handle,
      new WorkerCrashError('Worker node crashed', {
        cause: rawCause,
        workerId: handle.lease.id,
      })
    )
    const rejected = await outcome.promise.catch(error => error)

    expect(reject).toHaveBeenCalledOnce()
    expect(removeAbortListener).toHaveBeenCalledOnce()
    expect(emitDestroy).toHaveBeenCalledOnce()
    expect(pool.taskRegistry.get(taskIds.active)).toBeUndefined()
    expect(rejected.cause).toBe(rawCause)
  })

  const deduplicate = async order => {
    const drain = Promise.withResolvers()
    const reconciliations = []
    const aggregator = new TerminalSignalAggregator({
      quarantine: vi.fn(),
      reconcile: async observation => {
        reconciliations.push(observation)
        return {
          ...observation,
          committed: true,
          lease: { generation: 1, id: 1 },
        }
      },
      waitForTransportDrain: () => drain.promise,
    })
    const error = new Error('worker error')
    const first =
      order === 'error'
        ? aggregator.error(error)
        : aggregator.exit({ code: 9 }, true, error)
    const second =
      order === 'error'
        ? aggregator.exit({ code: 9 }, true, error)
        : aggregator.error(error)
    drain.resolve()
    const outcomes = await Promise.all([first, second])
    return { outcomes, reconciliations }
  }

  it('deduplicates error then exit', async () => {
    const result = await deduplicate('error')
    expect(result.outcomes[0]).toBe(result.outcomes[1])
    expect(result.reconciliations).toHaveLength(1)
  })

  it('deduplicates exit then error', async () => {
    const result = await deduplicate('exit')
    expect(result.outcomes[0]).toBe(result.outcomes[1])
    expect(result.reconciliations).toHaveLength(1)
  })

  it('shares one destroy result across reentry', async () => {
    const pool = trackPool(
      new FixedThreadPool(1, './tests/worker-files/thread/hangWorker.mjs')
    )

    const first = pool.destroy()
    const second = pool.destroy()

    expect(second).toBe(first)
    await first
  })
})
