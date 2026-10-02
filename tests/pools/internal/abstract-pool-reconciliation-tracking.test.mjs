import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  FixedThreadPool,
  PoolEvents,
  WorkerCrashError,
} from '../../../lib/index.mjs'
import { createPoolCleanup } from '../crash-recovery-utils.mjs'

describe('Abstract pool reconciliation tracking', () => {
  const { cleanupPools, trackPool } = createPoolCleanup()

  afterEach(() => {
    vi.restoreAllMocks()
    return cleanupPools()
  })

  it('publishes one reconciliation failure when error then exit share its promise', async () => {
    const pool = trackPool(
      new FixedThreadPool(1, './tests/worker-files/thread/hangWorker.mjs', {
        errorHandler: () => undefined,
        restartWorkerOnError: false,
      })
    )
    const workerNode = pool.workerNodes[0]
    const handle = pool.workerLifecycleCoordinator.handle(workerNode)
    const failure = new AggregateError([new Error('replace')], 'reconcile')
    const reconciliation = Promise.withResolvers()
    const events = []
    pool.emitter.on(PoolEvents.error, error => events.push(error))
    const drainSpy = vi.spyOn(pool, 'drainWorkerListenerErrors')
    const errorSpy = vi
      .spyOn(pool.workerTerminalController, 'error')
      .mockImplementation(currentHandle => {
        pool.trackWorkerReconciliation(
          currentHandle.lease,
          reconciliation.promise
        )
      })
    const exitSpy = vi
      .spyOn(pool.workerTerminalController, 'exit')
      .mockImplementation(currentHandle => {
        pool.trackWorkerReconciliation(
          currentHandle.lease,
          reconciliation.promise
        )
      })

    pool.startWorkerNodeCrashHandling(handle, new Error('crash'))
    pool.startWorkerNodeExitHandling(handle, 1)
    expect(pool.poolLifecycle.trackedPromiseCount).toBe(1)
    errorSpy.mockRestore()
    exitSpy.mockRestore()
    reconciliation.reject(failure)
    await reconciliation.promise.catch(() => undefined)
    await Promise.resolve()

    expect(events).toStrictEqual([failure])
    expect(drainSpy).toHaveBeenCalledOnce()
    expect(pool.poolLifecycle.trackedPromiseCount).toBe(0)
  })

  it('publishes each distinct reconciliation generation once', async () => {
    const pool = trackPool(
      new FixedThreadPool(1, './tests/worker-files/thread/hangWorker.mjs', {
        errorHandler: () => undefined,
        restartWorkerOnError: false,
      })
    )
    const workerNode = pool.workerNodes[0]
    const handle = pool.workerLifecycleCoordinator.handle(workerNode)
    const failures = [
      new AggregateError([new Error('first')], 'first reconciliation'),
      new AggregateError([new Error('second')], 'second reconciliation'),
    ]
    const reconciliations = failures.map(failure => Promise.reject(failure))
    const events = []
    pool.emitter.on(PoolEvents.error, error => events.push(error))
    const drainSpy = vi.spyOn(pool, 'drainWorkerListenerErrors')

    for (const reconciliation of reconciliations) {
      pool.trackWorkerReconciliation(handle.lease, reconciliation)
      pool.trackWorkerReconciliation(handle.lease, reconciliation)
    }
    await Promise.all(
      reconciliations.map(reconciliation =>
        reconciliation.catch(() => undefined)
      )
    )
    await Promise.resolve()

    expect(events).toStrictEqual(failures)
    expect(drainSpy).toHaveBeenCalledTimes(2)
    expect(pool.poolLifecycle.trackedPromiseCount).toBe(0)
  })

  it('sanitizes ambiguous active crash attribution without changing active-first settlement', () => {
    const pool = trackPool(
      new FixedThreadPool(1, './tests/worker-files/thread/hangWorker.mjs', {
        errorHandler: () => undefined,
        restartWorkerOnError: false,
      })
    )
    const workerNode = pool.workerNodes[0]
    const handle = pool.workerLifecycleCoordinator.handle(workerNode)
    const queued = '00000000-0000-4000-8000-000000000101'
    const activeA = '00000000-0000-4000-8000-000000000102'
    const activeB = '00000000-0000-4000-8000-000000000103'
    const snapshot = [queued, activeA, activeB]
    const activeAError = new WorkerCrashError('Worker node crashed', {
      taskId: activeA,
      workerId: handle.lease.id,
    })
    const activeBError = new WorkerCrashError('Worker node crashed', {
      taskId: activeB,
      workerId: handle.lease.id,
    })
    const queuedError = new WorkerCrashError('Worker node crashed', {
      taskId: queued,
      workerId: handle.lease.id,
    })
    const errors = new Map([
      [activeA, activeAError],
      [activeB, activeBError],
      [queued, queuedError],
    ])
    const snapshotSpy = vi
      .spyOn(pool.taskRegistry, 'snapshotByLease')
      .mockReturnValue(snapshot)
    const reserveSpy = vi
      .spyOn(pool.taskScheduler, 'reserveForReconciliation')
      .mockReturnValue([
        { lease: handle.lease, previousState: 'running', taskId: activeA },
        { lease: handle.lease, previousState: 'running', taskId: activeB },
      ])
    const activeSnapshotSpy = vi
      .spyOn(pool.taskRegistry, 'snapshotActiveReconciliationTaskIds')
      .mockReturnValue([activeA, activeB])
    const buildSpy = vi
      .spyOn(pool.workerReconciliationPolicy, 'buildTaskCrashError')
      .mockImplementation((_cause, _worker, taskId) => errors.get(taskId))
    const settleSpy = vi.spyOn(pool, 'rejectTaskPromise').mockReturnValue(true)

    const representative = pool.rejectOwnedTasks(
      handle,
      new WorkerCrashError('Worker node crashed: raw sentinel', {
        cause: new Error('raw sentinel'),
        workerId: handle.lease.id,
      })
    )

    expect(snapshotSpy).toHaveBeenCalledExactlyOnceWith(handle.lease)
    expect(reserveSpy).toHaveBeenCalledExactlyOnceWith(snapshot, handle.lease)
    expect(activeSnapshotSpy).toHaveBeenCalledExactlyOnceWith(
      snapshot,
      handle.lease
    )
    expect(reserveSpy).toHaveBeenCalledBefore(activeSnapshotSpy)
    expect(reserveSpy).toHaveBeenCalledBefore(buildSpy)
    expect(buildSpy.mock.calls.map(([, , taskId]) => taskId)).toStrictEqual([
      activeA,
      activeB,
      queued,
    ])
    expect(settleSpy.mock.calls.map(([taskId]) => taskId)).toStrictEqual([
      activeA,
      activeB,
      queued,
    ])
    expect(settleSpy).toHaveBeenCalledTimes(3)
    expect(
      settleSpy.mock.calls.every(([, , , lease]) => lease === handle.lease)
    ).toBe(true)
    expect(
      buildSpy.mock.calls.map(([, , , attributed]) => attributed)
    ).toStrictEqual([false, false, false])
    expect(representative).toBe(activeAError)
    expect(activeAError).not.toBe(activeBError)
    expect(Object.hasOwn(activeAError, 'cause')).toBe(false)
  })
})
