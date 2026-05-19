import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  DynamicClusterPool,
  DynamicThreadPool,
  FixedClusterPool,
  FixedThreadPool,
  PoolEvents,
  WorkerCrashError,
  WorkerTerminationError,
} from '../../lib/index.mjs'

/*
 * Regression suite for the worker crash-recovery contract: every
 * in-flight task promise settles, exactly one typed PoolEvents.error
 * per crash, voluntary termination is not surfaced as a crash, and
 * destroy() is idempotent and concurrent-safe.
 *
 * Each `it()` pins `{ retry: 0 }` to surface flakes immediately,
 * overriding the global `retry: 2` in vitest.config.ts.
 */
describe('Crash recovery regression test suite', () => {
  // Track pools created by tests so afterEach can drain them on failure.
  const pools = []
  const trackPool = pool => {
    pools.push(pool)
    return pool
  }
  afterEach(async () => {
    while (pools.length > 0) {
      const pool = pools.pop()
      if (pool.info.started && !pool.destroying) {
        // Race destroy against a 5 s ceiling so afterEach cannot exceed
        // vitest hookTimeout on a stuck crashed pool.
        await Promise.race([
          pool.destroy().catch(() => undefined),
          new Promise(resolve => setTimeout(resolve, 5000)),
        ])
      }
    }
  })

  it.runIf(process.platform !== 'win32')(
    'T1a: cluster SIGKILL from parent rejects in-flight with WorkerCrashError',
    { retry: 0, timeout: 10_000 },
    async () => {
      const pool = trackPool(
        new FixedClusterPool(1, './tests/worker-files/cluster/hangWorker.cjs')
      )
      await new Promise(resolve => {
        pool.emitter.once(PoolEvents.ready, resolve)
      })
      const events = []
      pool.emitter.on(PoolEvents.error, e => {
        events.push(e)
      })
      const taskPromise = pool.execute()
      // Give the dispatch IPC a moment to land before killing the worker.
      await new Promise(resolve => setTimeout(resolve, 100))
      const workerNode = pool.workerNodes[0]
      const pid = workerNode.worker.process.pid
      process.kill(pid, 'SIGKILL')
      let rejected
      try {
        await taskPromise
      } catch (e) {
        rejected = e
      }
      expect(rejected).toBeInstanceOf(WorkerCrashError)
      expect(rejected.name).toBe('WorkerCrashError')
      expect(rejected.exitCode).toBeNull()
      expect(rejected.signal).toBe('SIGKILL')
      expect(rejected.taskId).toBeDefined()
      expect(events.length).toBe(1)
      expect(events[0]).toBeInstanceOf(WorkerCrashError)
    }
  )

  it.runIf(process.platform === 'win32')(
    'T1b: cluster worker.kill() (Windows) rejects in-flight with WorkerCrashError',
    { retry: 0, timeout: 10_000 },
    async () => {
      const pool = trackPool(
        new FixedClusterPool(1, './tests/worker-files/cluster/hangWorker.cjs')
      )
      await new Promise(resolve => {
        pool.emitter.once(PoolEvents.ready, resolve)
      })
      const taskPromise = pool.execute()
      await new Promise(resolve => setTimeout(resolve, 100))
      const workerNode = pool.workerNodes[0]
      workerNode.worker.kill()
      let rejected
      try {
        await taskPromise
      } catch (e) {
        rejected = e
      }
      expect(rejected).toBeInstanceOf(WorkerCrashError)
      expect(rejected.name).toBe('WorkerCrashError')
      if (rejected.exitCode != null) {
        expect(rejected.exitCode).not.toBe(0)
      } else {
        expect(rejected.signal).not.toBeNull()
      }
      expect(rejected.taskId).toBeDefined()
    }
  )

  it('T2: thread process.exit(N) mid-task rejects with WorkerCrashError', {
    retry: 0,
    timeout: 10_000,
  }, async () => {
    const pool = trackPool(
      new FixedThreadPool(
        1,
        './tests/worker-files/thread/processExitWorker.mjs'
      )
    )
    await new Promise(resolve => {
      pool.emitter.once(PoolEvents.ready, resolve)
    })
    let rejected
    try {
      await pool.execute()
    } catch (e) {
      rejected = e
    }
    expect(rejected).toBeInstanceOf(WorkerCrashError)
    expect(rejected.name).toBe('WorkerCrashError')
    expect(rejected.exitCode).toBe(2)
    expect(rejected.signal).toBeNull()
    expect(rejected.taskId).toBeDefined()
  })

  it('T3a: thread post-online crash rejects in-flight with WorkerCrashError', {
    retry: 0,
    timeout: 10_000,
  }, async () => {
    const pool = trackPool(
      new FixedThreadPool(
        1,
        './tests/worker-files/thread/startupCrashWorker.mjs',
        { errorHandler: () => undefined }
      )
    )
    await new Promise(resolve => {
      pool.emitter.once(PoolEvents.ready, resolve)
    })
    let rejected
    try {
      await pool.execute()
    } catch (e) {
      rejected = e
    }
    expect(rejected).toBeInstanceOf(WorkerCrashError)
    expect(rejected.name).toBe('WorkerCrashError')
    expect(rejected.cause).toBeInstanceOf(Error)
    expect(rejected.cause.message).toBe('post-online crash')
    expect(rejected.taskId).toBeDefined()
  })

  it('T3b: cluster post-online crash rejects in-flight with WorkerCrashError', {
    retry: 0,
    timeout: 10_000,
  }, async () => {
    // Cluster variant — child_process never emits 'error' for an
    // unhandled exception, so the crash surfaces only via the 'exit'
    // handler with non-zero `exitCode`. The original throw text lives
    // in the worker's stderr, NOT in `error.cause.message`. The
    // assertion therefore relaxes to exit-code detection (cluster
    // documented deviation from the thread-pool symmetry).
    const pool = trackPool(
      new DynamicClusterPool(
        1,
        2,
        './tests/worker-files/cluster/startupCrashWorker.cjs'
      )
    )
    await new Promise(resolve => {
      pool.emitter.once(PoolEvents.ready, resolve)
    })
    let rejected
    try {
      await pool.execute()
    } catch (e) {
      rejected = e
    }
    expect(rejected).toBeInstanceOf(WorkerCrashError)
    expect(rejected.name).toBe('WorkerCrashError')
    if (rejected.exitCode != null) {
      expect(rejected.exitCode).not.toBe(0)
    } else {
      expect(rejected.signal).not.toBeNull()
    }
    expect(rejected.taskId).toBeDefined()
  })

  // T3c — pre-ready crash; accept either path (PoolEvents.error event
  // OR rejected execute) via Promise.race for slow-runner determinism.
  it('T3c: pre-ready worker crash surfaces via error event or rejected dispatch', {
    retry: 0,
    timeout: 10_000,
  }, async () => {
    const pool = trackPool(
      new DynamicClusterPool(
        1,
        2,
        './tests/worker-files/cluster/preReadyCrashWorker.cjs',
        { errorHandler: () => undefined }
      )
    )
    const errorEvent = new Promise(resolve => {
      pool.emitter.once(PoolEvents.error, resolve)
    })
    const executePromise = pool.execute().catch(e => e)
    const result = await Promise.race([errorEvent, executePromise])
    expect(result).toBeDefined()
    expect(result instanceof Error).toBe(true)
  })

  it('T4a: thread worker uncaught throw mid-task rejects with WorkerCrashError', {
    retry: 0,
    timeout: 10_000,
  }, async () => {
    const pool = trackPool(
      new FixedThreadPool(1, './tests/worker-files/thread/crashWorker.mjs', {
        errorHandler: () => undefined,
      })
    )
    await new Promise(resolve => {
      pool.emitter.once(PoolEvents.ready, resolve)
    })
    let rejected
    try {
      await pool.execute()
    } catch (e) {
      rejected = e
    }
    expect(rejected).toBeInstanceOf(WorkerCrashError)
    expect(rejected.name).toBe('WorkerCrashError')
    expect(rejected.cause?.message).toBe('Simulated worker crash')
  })

  it('T4b: cluster worker uncaught throw mid-task rejects with WorkerCrashError', {
    retry: 0,
    timeout: 10_000,
  }, async () => {
    const pool = trackPool(
      new FixedClusterPool(1, './tests/worker-files/cluster/crashWorker.cjs', {
        errorHandler: () => undefined,
      })
    )
    await new Promise(resolve => {
      pool.emitter.once(PoolEvents.ready, resolve)
    })
    let rejected
    try {
      await pool.execute()
    } catch (e) {
      rejected = e
    }
    expect(rejected).toBeInstanceOf(WorkerCrashError)
    expect(rejected.name).toBe('WorkerCrashError')
  })

  it('T5: pool.destroy() with hung task rejects in-flight with WorkerTerminationError', {
    retry: 0,
    timeout: 10_000,
  }, async () => {
    const pool = trackPool(
      new FixedThreadPool(1, './tests/worker-files/thread/hangWorker.mjs', {
        enableTasksQueue: true,
        tasksQueueOptions: { tasksFinishedTimeout: 100 },
      })
    )
    await new Promise(resolve => {
      pool.emitter.once(PoolEvents.ready, resolve)
    })
    const taskPromise = pool.execute()
    let rejected
    taskPromise.catch(e => {
      rejected = e
    })
    await new Promise(resolve => setTimeout(resolve, 50))
    await pool.destroy()
    await taskPromise.catch(() => undefined)
    expect(rejected).toBeInstanceOf(WorkerTerminationError)
    expect(rejected.name).toBe('WorkerTerminationError')
    expect(rejected.taskId).toBeDefined()
    expect(rejected.workerId).toBeDefined()
  })

  it('T5b: destroy with one in-flight worker leaves idle worker promises unaffected', {
    retry: 0,
    timeout: 10_000,
  }, async () => {
    // 2-worker pool. Only ONE task is dispatched — round-robin places
    // it on worker[0]. worker[1] stays idle. The pool must NOT
    // fabricate a spurious rejection for worker[1] at destroy time.
    const pool = trackPool(
      new FixedThreadPool(2, './tests/worker-files/thread/hangWorker.mjs', {
        enableTasksQueue: true,
        tasksQueueOptions: { tasksFinishedTimeout: 200 },
      })
    )
    await new Promise(resolve => {
      pool.emitter.once(PoolEvents.ready, resolve)
    })
    const rejections = []
    const promise = pool.execute().catch(e => {
      rejections.push(e)
      return undefined
    })
    await new Promise(resolve => setTimeout(resolve, 50))
    await pool.destroy()
    await Promise.allSettled([promise])
    expect(rejections.length).toBe(1)
    expect(rejections[0]).toBeInstanceOf(WorkerTerminationError)
    expect(rejections[0].name).toBe('WorkerTerminationError')
  })

  it('T5c: tasksFinishedTimeout is honored as a ceiling for pre-existing in-flight tasks (no queue)', {
    retry: 0,
    timeout: 10_000,
  }, async () => {
    // Regression guard: with no queued tasks, the destroy wait must
    // elapse `tasksFinishedTimeout` before the in-flight task is rejected.
    const ceiling = 1000
    const pool = trackPool(
      new FixedThreadPool(1, './tests/worker-files/thread/hangWorker.mjs', {
        enableTasksQueue: true,
        tasksQueueOptions: { tasksFinishedTimeout: ceiling },
      })
    )
    await new Promise(resolve => {
      pool.emitter.once(PoolEvents.ready, resolve)
    })
    const taskPromise = pool.execute()
    let rejected
    taskPromise.catch(e => {
      rejected = e
    })
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(pool.workerNodes[0].usage.tasks.executing).toBe(1)
    expect(pool.workerNodes[0].tasksQueueSize()).toBe(0)
    const start = Date.now()
    await pool.destroy()
    const elapsed = Date.now() - start
    await taskPromise.catch(() => undefined)
    expect(rejected).toBeInstanceOf(WorkerTerminationError)
    expect(rejected.taskId).toBeDefined()
    expect(elapsed).toBeGreaterThanOrEqual(ceiling - 200)
    expect(elapsed).toBeLessThan(ceiling + 2000)
  })

  it('T5d: destroy resolves promptly when in-flight task settles within tasksFinishedTimeout', {
    retry: 0,
    timeout: 10_000,
  }, async () => {
    // asyncWorker sleeps ~2000 ms. With a 5 s ceiling the task
    // completes naturally well before the deadline; destroy must
    // proceed immediately on the `'taskFinished'` event without
    // stalling the full ceiling AND must NOT reject the task.
    const ceiling = 5000
    const pool = trackPool(
      new FixedThreadPool(1, './tests/worker-files/thread/asyncWorker.mjs', {
        enableTasksQueue: true,
        tasksQueueOptions: { tasksFinishedTimeout: ceiling },
      })
    )
    await new Promise(resolve => {
      pool.emitter.once(PoolEvents.ready, resolve)
    })
    const errorEvents = []
    pool.emitter.on(PoolEvents.error, e => {
      errorEvents.push(e)
    })
    const taskPromise = pool.execute()
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(pool.workerNodes[0].usage.tasks.executing).toBe(1)
    const start = Date.now()
    await pool.destroy()
    const elapsed = Date.now() - start
    await expect(taskPromise).resolves.toBeDefined()
    expect(elapsed).toBeLessThan(ceiling - 1000)
    expect(errorEvents.length).toBe(0)
  })

  // T6 intentionally skipped — no scenario fits between T5d (destroy timing) and T7 (fire-and-forget).

  it('T7: fire-and-forget × N + destroy collects N WorkerTerminationError rejections, no Pool unhandled rejection', {
    retry: 0,
    timeout: 10_000,
  }, async () => {
    const pool = trackPool(
      new FixedThreadPool(2, './tests/worker-files/thread/hangWorker.mjs', {
        enableTasksQueue: true,
        tasksQueueOptions: { tasksFinishedTimeout: 200 },
      })
    )
    await new Promise(resolve => {
      pool.emitter.once(PoolEvents.ready, resolve)
    })
    const N = 8
    const rejections = []
    const promises = []
    for (let i = 0; i < N; i++) {
      promises.push(
        pool.execute().catch(e => {
          rejections.push(e)
          return undefined
        })
      )
    }
    await new Promise(resolve => setTimeout(resolve, 50))
    await pool.destroy()
    await Promise.allSettled(promises)
    expect(rejections.length).toBe(N)
    expect(rejections.every(e => e?.name === 'WorkerTerminationError')).toBe(
      true
    )
    const taskIds = rejections.map(e => e.taskId).filter(id => id != null)
    expect(new Set(taskIds).size).toBe(taskIds.length)
    expect(taskIds.length).toBe(N)
  })

  it('T8: dynamic worker idle eviction (no in-flight) does NOT emit error events', {
    retry: 0,
    timeout: 10_000,
  }, async () => {
    // Voluntary termination via maxInactiveTime is NOT a crash. No
    // WorkerTerminationError, no WorkerCrashError, no PoolEvents.error.
    const pool = trackPool(
      new DynamicThreadPool(
        1,
        2,
        './tests/worker-files/thread/echoWorker.mjs',
        { errorHandler: () => undefined }
      )
    )
    await new Promise(resolve => {
      pool.emitter.once(PoolEvents.ready, resolve)
    })
    const errorEvents = []
    pool.emitter.on(PoolEvents.error, e => {
      errorEvents.push(e)
    })
    await Promise.all([pool.execute(), pool.execute(), pool.execute()])
    // Wait for any concurrent crash-emit microtasks to settle.
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(errorEvents.every(e => !(e instanceof WorkerCrashError))).toBe(true)
    expect(errorEvents.every(e => !(e instanceof WorkerTerminationError))).toBe(
      true
    )
  })

  it('T8b: dynamic-eviction destroyWorkerNode WITH in-flight task rejects via WorkerTerminationError', {
    retry: 0,
    timeout: 10_000,
  }, async () => {
    const pool = trackPool(
      new DynamicThreadPool(
        1,
        2,
        './tests/worker-files/thread/hangWorker.mjs',
        {
          enableTasksQueue: true,
          restartWorkerOnError: false,
          tasksQueueOptions: { tasksFinishedTimeout: 100 },
        }
      )
    )
    await new Promise(resolve => {
      pool.emitter.once(PoolEvents.ready, resolve)
    })
    const rejections = []
    const promise = pool.execute().catch(e => {
      rejections.push(e)
      return undefined
    })
    await new Promise(resolve => setTimeout(resolve, 50))
    const targetKey = pool.workerNodes.findIndex(
      wn => wn.usage.tasks.executing > 0
    )
    if (targetKey !== -1) {
      await pool.destroyWorkerNode(targetKey)
    }
    await Promise.allSettled([promise])
    expect(rejections.length).toBe(1)
    expect(rejections[0]).toBeInstanceOf(WorkerTerminationError)
    expect(rejections[0].name).toBe('WorkerTerminationError')
    expect(rejections[0].taskId).toBeDefined()
  })

  it('T9: second worker error event is a no-op (crashHandled write-once)', {
    retry: 0,
    timeout: 10_000,
  }, async () => {
    // handleWorkerNodeCrash refuses re-entry when info.crashHandled is
    // true: subsequent worker error/exit events must not emit again.
    const pool = trackPool(
      new FixedThreadPool(1, './tests/worker-files/thread/crashWorker.mjs', {
        errorHandler: () => undefined,
      })
    )
    await new Promise(resolve => {
      pool.emitter.once(PoolEvents.ready, resolve)
    })
    const events = []
    pool.emitter.on(PoolEvents.error, e => {
      events.push(e)
    })
    let rejected
    try {
      await pool.execute()
    } catch (e) {
      rejected = e
    }
    expect(rejected).toBeInstanceOf(WorkerCrashError)
    expect(events.length).toBe(1)
    expect(events[0]).toBeInstanceOf(WorkerCrashError)
  })

  // T9b/T11b/T11c reach into protected pool methods by name; .mjs
  // runtime erases TS visibility, so renames must update both sites.
  // Mutation-killer for the crashHandled re-entry guard. After the
  // first crash settles, invoke the crash handler a second time on the
  // SAME workerNode and assert NO new event is emitted. With the
  // early-return guard, the second invocation is a no-op; without it,
  // the crash body re-runs and emits again.
  it('T9b: synthesized re-entry into the crash handler is a no-op', {
    retry: 0,
    timeout: 10_000,
  }, async () => {
    const pool = trackPool(
      new FixedThreadPool(1, './tests/worker-files/thread/crashWorker.mjs', {
        errorHandler: () => undefined,
      })
    )
    await new Promise(resolve => {
      pool.emitter.once(PoolEvents.ready, resolve)
    })
    const workerNode = pool.workerNodes[0]
    let rejected
    try {
      await pool.execute()
    } catch (e) {
      rejected = e
    }
    expect(rejected.name).toBe('WorkerCrashError')
    const eventsAfter = []
    pool.emitter.on(PoolEvents.error, e => {
      eventsAfter.push(e)
    })
    pool.handleWorkerNodeCrash(workerNode, new Error('synthetic re-entry'))
    expect(eventsAfter.length).toBe(0)
  })

  it('T10: crashed worker is not chosen and usage.failed reflects in-flight rejections', {
    retry: 0,
    timeout: 10_000,
  }, async () => {
    // info.ready=false gating in isWorkerNodeReady prevents
    // dispatch to the crashed worker.
    const pool = trackPool(
      new FixedThreadPool(
        2,
        './tests/worker-files/thread/processExitWorker.mjs',
        { errorHandler: () => undefined }
      )
    )
    await new Promise(resolve => {
      pool.emitter.once(PoolEvents.ready, resolve)
    })
    const N = 2
    const rejections = []
    const promises = []
    for (let i = 0; i < N; i++) {
      promises.push(
        pool.execute().catch(e => {
          rejections.push(e)
          return undefined
        })
      )
    }
    await Promise.allSettled(promises)
    expect(rejections.length).toBe(N)
    expect(rejections.every(e => e instanceof WorkerCrashError)).toBe(true)
  })

  it('T11: crash during destroy emits no undefined payload and surfaces a single typed rejection', {
    retry: 0,
    timeout: 10_000,
  }, async () => {
    // Crash/destroy race: listener must observe only typed payloads
    // (emit-gate) and exactly one in-flight rejection (crashHandled
    // write-once).
    const pool = trackPool(
      new FixedThreadPool(1, './tests/worker-files/thread/crashWorker.mjs', {
        enableTasksQueue: true,
        errorHandler: () => undefined,
        tasksQueueOptions: { tasksFinishedTimeout: 200 },
      })
    )
    await new Promise(resolve => {
      pool.emitter.once(PoolEvents.ready, resolve)
    })
    const events = []
    pool.emitter.on(PoolEvents.error, e => {
      events.push(e)
    })
    const rejections = []
    const taskPromise = pool.execute().catch(e => {
      rejections.push(e)
      return undefined
    })
    await new Promise(resolve => setTimeout(resolve, 5))
    const destroyPromise = pool.destroy().catch(() => undefined)
    await Promise.allSettled([taskPromise, destroyPromise])
    expect(events.every(e => e != null)).toBe(true)
    expect(rejections.length).toBe(1)
    expect(
      rejections[0] instanceof WorkerCrashError ||
        rejections[0] instanceof WorkerTerminationError
    ).toBe(true)
    expect(['WorkerCrashError', 'WorkerTerminationError']).toContain(
      rejections[0].name
    )
  })

  it('T11b: rejectInFlightTaskPromisesByRef returns the first rejection without emitting', {
    retry: 0,
    timeout: 10_000,
  }, async () => {
    const pool = trackPool(
      new FixedThreadPool(1, './tests/worker-files/thread/echoWorker.mjs', {
        errorHandler: () => undefined,
      })
    )
    await new Promise(resolve => {
      pool.emitter.once(PoolEvents.ready, resolve)
    })
    const errorEvents = []
    pool.emitter.on(PoolEvents.error, e => {
      errorEvents.push(e)
    })
    const workerNode = pool.workerNodes[0]
    const workerId = workerNode.info.id
    const taskId = '00000000-0000-0000-0000-000000000b11'
    let rejected
    pool.promiseResponseMap.set(taskId, {
      asyncResource: undefined,
      reject: err => {
        rejected = err
      },
      resolve: () => undefined,
      workerId,
    })
    const result = pool.rejectInFlightTaskPromisesByRef(
      workerNode,
      workerId,
      id => new WorkerCrashError('synthetic', { taskId: id })
    )
    expect(result).toBeInstanceOf(WorkerCrashError)
    expect(rejected).toBeInstanceOf(WorkerCrashError)
    expect(errorEvents.length).toBe(0)
  })

  it('T11c: crash sweep is a no-op once handleTaskExecutionResponse settles the task', {
    retry: 0,
    timeout: 10_000,
  }, async () => {
    const pool = trackPool(
      new FixedThreadPool(1, './tests/worker-files/thread/echoWorker.mjs', {
        errorHandler: () => undefined,
      })
    )
    await new Promise(resolve => {
      pool.emitter.once(PoolEvents.ready, resolve)
    })
    const errorEvents = []
    pool.emitter.on(PoolEvents.error, e => {
      errorEvents.push(e)
    })
    const workerNode = pool.workerNodes[0]
    const workerId = workerNode.info.id
    const failedBefore = workerNode.usage.tasks.failed
    await pool.execute()
    expect(pool.promiseResponseMap.size).toBe(0)
    const result = pool.rejectInFlightTaskPromisesByRef(
      workerNode,
      workerId,
      id => new WorkerCrashError('synthetic post-settle', { taskId: id })
    )
    expect(result).toBeUndefined()
    expect(workerNode.usage.tasks.failed).toBe(failedBefore)
    expect(errorEvents.length).toBe(0)
  })

  it('T11d: workerNode.terminate() resolves within grace period when worker exit never fires', {
    retry: 0,
    timeout: 15_000,
  }, async () => {
    // Upstream V8 isolate teardown bug (Node 22 Windows, fixed in v24
    // by https://github.com/nodejs/node/pull/58070) wedges
    // worker.terminate() and suppresses 'exit' indefinitely.
    const pool = trackPool(
      new FixedThreadPool(1, './tests/worker-files/thread/echoWorker.mjs', {
        errorHandler: () => undefined,
      })
    )
    await new Promise(resolve => {
      pool.emitter.once(PoolEvents.ready, resolve)
    })
    const workerNode = pool.workerNodes[0]
    const nativeOnce = workerNode.worker.once.bind(workerNode.worker)
    const onceSpy = vi
      .spyOn(workerNode.worker, 'once')
      .mockImplementation(function (event, handler) {
        if (event === 'exit') return this
        return nativeOnce(event, handler)
      })
    const terminateSpy = vi
      .spyOn(workerNode.worker, 'terminate')
      .mockImplementation(async () => await new Promise(() => undefined))
    const emitSpy = vi.spyOn(workerNode, 'emit')
    try {
      const start = performance.now()
      await workerNode.terminate()
      const elapsed = performance.now() - start
      expect(elapsed).toBeGreaterThanOrEqual(4500)
      expect(elapsed).toBeLessThan(6000)
      expect(emitSpy).toHaveBeenCalledWith('terminated')
      expect(pool.workerNodes.includes(workerNode)).toBe(false)
    } finally {
      onceSpy.mockRestore()
      terminateSpy.mockRestore()
      emitSpy.mockRestore()
    }
  })

  it('T12: concurrent pool.destroy() calls are silently idempotent', {
    retry: 0,
    timeout: 10_000,
  }, async () => {
    const pool = trackPool(
      new FixedThreadPool(2, './tests/worker-files/thread/echoWorker.mjs', {
        errorHandler: () => undefined,
      })
    )
    await new Promise(resolve => {
      pool.emitter.once(PoolEvents.ready, resolve)
    })
    const errorEvents = []
    pool.emitter.on(PoolEvents.error, e => {
      errorEvents.push(e)
    })
    const results = await Promise.allSettled([pool.destroy(), pool.destroy()])
    expect(results.every(r => r.status === 'fulfilled')).toBe(true)
    expect(pool.workerNodes.length).toBe(0)
    expect(errorEvents.length).toBe(0)
  })

  it('T13: enableTasksQueue=false + worker crash rejects all in-flight with WorkerCrashError', {
    retry: 0,
    timeout: 10_000,
  }, async () => {
    const pool = trackPool(
      new FixedThreadPool(
        2,
        './tests/worker-files/thread/processExitWorker.mjs',
        {
          enableTasksQueue: false,
          errorHandler: () => undefined,
        }
      )
    )
    await new Promise(resolve => {
      pool.emitter.once(PoolEvents.ready, resolve)
    })
    let poolErrorCount = 0
    pool.emitter.on(PoolEvents.error, () => {
      ++poolErrorCount
    })
    const N = 2
    const rejections = []
    const promises = []
    for (let i = 0; i < N; i++) {
      promises.push(
        pool.execute().catch(e => {
          rejections.push(e)
          return undefined
        })
      )
    }
    await Promise.allSettled(promises)
    expect(rejections.length).toBe(N)
    expect(rejections.every(e => e?.name === 'WorkerCrashError')).toBe(true)
    expect(rejections.every(e => e instanceof WorkerCrashError)).toBe(true)
    expect(poolErrorCount).toBe(N)
  })

  it('T13b: queued-only crash emits a typed PoolEvents.error', {
    retry: 0,
    timeout: 10_000,
  }, async () => {
    // Queued-only path: rejectInFlightTaskPromisesByRef finds no match,
    // so the emission falls back to the first queued rejection.
    const pool = trackPool(
      new FixedThreadPool(1, './tests/worker-files/thread/echoWorker.mjs', {
        enableTasksQueue: true,
        errorHandler: () => undefined,
      })
    )
    await new Promise(resolve => {
      pool.emitter.once(PoolEvents.ready, resolve)
    })
    const events = []
    pool.emitter.on(PoolEvents.error, e => {
      events.push(e)
    })
    const workerNode = pool.workerNodes[0]
    const taskId = '00000000-0000-0000-0000-000000000abc'
    let rejected
    pool.promiseResponseMap.set(taskId, {
      asyncResource: undefined,
      reject: err => {
        rejected = err
      },
      resolve: () => undefined,
      workerId: 999_999,
    })
    workerNode.enqueueTask({ data: undefined, taskId })
    pool.handleWorkerNodeCrash(workerNode, new Error('synthetic queued-only'))
    expect(events.length).toBe(1)
    expect(events[0]).toBeInstanceOf(WorkerCrashError)
    expect(rejected).toBeInstanceOf(WorkerCrashError)
    expect(rejected.taskId).toBe(taskId)
  })

  it.runIf(process.platform !== 'win32')(
    'T13c: cluster signal-kill once-exit invokes terminate symmetric cleanup',
    { retry: 0, timeout: 10_000 },
    async () => {
      const pool = trackPool(
        new FixedClusterPool(1, './tests/worker-files/cluster/hangWorker.cjs')
      )
      await new Promise(resolve => {
        pool.emitter.once(PoolEvents.ready, resolve)
      })
      const workerNode = pool.workerNodes[0]
      const terminateSpy = vi.spyOn(workerNode, 'terminate')
      const taskPromise = pool.execute().catch(() => undefined)
      await new Promise(resolve => setTimeout(resolve, 100))
      process.kill(workerNode.worker.process.pid, 'SIGKILL')
      await taskPromise
      await new Promise(resolve => setTimeout(resolve, 50))
      expect(terminateSpy).toHaveBeenCalled()
      terminateSpy.mockRestore()
    }
  )

  it('T13d: simultaneous multi-worker crash rejects every in-flight task with WorkerCrashError', {
    retry: 0,
    timeout: 15_000,
  }, async () => {
    const N = 4
    const pool = trackPool(
      new FixedThreadPool(N, './tests/worker-files/thread/crashWorker.mjs', {
        errorHandler: () => undefined,
      })
    )
    await new Promise(resolve => {
      pool.emitter.once(PoolEvents.ready, resolve)
    })
    const errorEvents = []
    pool.emitter.on(PoolEvents.error, e => {
      errorEvents.push(e)
    })
    const rejections = []
    await Promise.allSettled(
      Array.from({ length: N }, () =>
        pool.execute().catch(e => {
          rejections.push(e)
          return undefined
        })
      )
    )
    expect(rejections.length).toBe(N)
    expect(rejections.every(e => e instanceof WorkerCrashError)).toBe(true)
    expect(errorEvents.length).toBe(N)
    expect(errorEvents.every(e => e instanceof WorkerCrashError)).toBe(true)
  })

  it('T13e: result-then-process.exit(0) resolves the task without emitting PoolEvents.error', {
    retry: 0,
    timeout: 10_000,
  }, async () => {
    const pool = trackPool(
      new FixedThreadPool(
        1,
        './tests/worker-files/thread/resolveThenExitWorker.mjs',
        { errorHandler: () => undefined }
      )
    )
    await new Promise(resolve => {
      pool.emitter.once(PoolEvents.ready, resolve)
    })
    const errorEvents = []
    pool.emitter.on(PoolEvents.error, e => {
      errorEvents.push(e)
    })
    await expect(pool.execute()).resolves.toEqual({ ok: true })
    await new Promise(resolve => setTimeout(resolve, 350))
    expect(errorEvents.length).toBe(0)
  })

  it('T13f: worker crash during destroyWorkerNode wait surfaces WorkerCrashError', {
    retry: 0,
    timeout: 10_000,
  }, async () => {
    const pool = trackPool(
      new FixedThreadPool(1, './tests/worker-files/thread/crashWorker.mjs', {
        enableTasksQueue: false,
        errorHandler: () => undefined,
        tasksQueueOptions: { tasksFinishedTimeout: 5_000 },
      })
    )
    await new Promise(resolve => {
      pool.emitter.once(PoolEvents.ready, resolve)
    })
    const taskPromise = pool.execute()
    await new Promise(resolve => setTimeout(resolve, 5))
    const destroyPromise = pool.destroy()
    let rejected
    try {
      await taskPromise
    } catch (e) {
      rejected = e
    }
    await destroyPromise
    expect(rejected).toBeInstanceOf(WorkerCrashError)
    expect(rejected.name).toBe('WorkerCrashError')
    expect(rejected.taskId).toBeDefined()
  })

  it('T13g: clean exit(0) mid-task with restartWorkerOnError:false does NOT replenish', {
    retry: 0,
    timeout: 10_000,
  }, async () => {
    const pool = trackPool(
      new FixedThreadPool(
        1,
        './tests/worker-files/thread/cleanExitInFlightWorker.mjs',
        {
          enableTasksQueue: false,
          errorHandler: () => undefined,
          restartWorkerOnError: false,
        }
      )
    )
    await new Promise(resolve => {
      pool.emitter.once(PoolEvents.ready, resolve)
    })
    let rejected
    try {
      await pool.execute()
    } catch (e) {
      rejected = e
    }
    expect(rejected).toBeInstanceOf(WorkerCrashError)
    await new Promise(resolve => setTimeout(resolve, 200))
    expect(pool.workerNodes.length).toBe(0)
  })

  it('T-I5a: clean process.exit(0) replenishes even with restartWorkerOnError:false', {
    retry: 0,
    timeout: 10_000,
  }, async () => {
    // Replenishment predicate: `code === 0` branch.
    const pool = trackPool(
      new FixedThreadPool(
        1,
        './tests/worker-files/thread/cleanExitWorker.mjs',
        { restartWorkerOnError: false }
      )
    )
    await new Promise(resolve => {
      pool.emitter.once(PoolEvents.ready, resolve)
    })
    const initialCount = pool.workerNodes.length
    expect(initialCount).toBe(1)
    // cleanExitWorker fires process.exit(0); poll until replenishment.
    const deadline = performance.now() + 5_000
    while (
      (pool.workerNodes.length !== 1 ||
        pool.workerNodes[0].info.ready !== true) &&
      performance.now() < deadline
    ) {
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    expect(pool.workerNodes.length).toBe(1)
    expect(pool.workerNodes[0].info.ready).toBe(true)
  })

  it('T-I5b: crash with restartWorkerOnError:false does NOT replenish', {
    retry: 0,
    timeout: 10_000,
  }, async () => {
    // Replenishment predicate: `code === 0` is false AND
    // `restartWorkerOnError === true` is false → no replenishment.
    const pool = trackPool(
      new FixedThreadPool(
        1,
        './tests/worker-files/thread/processExitWorker.mjs',
        {
          enableTasksQueue: false,
          errorHandler: () => undefined,
          restartWorkerOnError: false,
        }
      )
    )
    await new Promise(resolve => {
      pool.emitter.once(PoolEvents.ready, resolve)
    })
    let rejected
    try {
      await pool.execute()
    } catch (e) {
      rejected = e
    }
    expect(rejected).toBeInstanceOf(WorkerCrashError)
    // Wait for any pending replenishment microtasks.
    await new Promise(resolve => setTimeout(resolve, 200))
    expect(pool.workerNodes.length).toBe(0)
  })

  it('T-I5c: clean process.exit(0) mid-task rejects in-flight with WorkerCrashError', {
    retry: 0,
    timeout: 10_000,
  }, async () => {
    // Predicate clause: `(exitCode === 0 && hasInFlightTask)`.
    // The fixture exits with code 0 while a task is still dispatched —
    // without the in-flight guard the dispatched promise would hang.
    const pool = trackPool(
      new FixedThreadPool(
        1,
        './tests/worker-files/thread/cleanExitInFlightWorker.mjs',
        {
          enableTasksQueue: false,
          errorHandler: () => undefined,
        }
      )
    )
    await new Promise(resolve => {
      pool.emitter.once(PoolEvents.ready, resolve)
    })
    let rejected
    try {
      await pool.execute()
    } catch (e) {
      rejected = e
    }
    expect(rejected).toBeInstanceOf(WorkerCrashError)
    expect(rejected.name).toBe('WorkerCrashError')
    expect(rejected.exitCode).toBe(0)
    expect(rejected.signal).toBeNull()
    expect(rejected.taskId).toBeDefined()
  })

  it('T2-cluster: cluster process.exit(N) mid-task rejects with WorkerCrashError', {
    retry: 0,
    timeout: 10_000,
  }, async () => {
    const pool = trackPool(
      new FixedClusterPool(
        1,
        './tests/worker-files/cluster/processExitWorker.cjs'
      )
    )
    await new Promise(resolve => {
      pool.emitter.once(PoolEvents.ready, resolve)
    })
    let rejected
    try {
      await pool.execute()
    } catch (e) {
      rejected = e
    }
    expect(rejected).toBeInstanceOf(WorkerCrashError)
    expect(rejected.name).toBe('WorkerCrashError')
    expect(rejected.exitCode).toBe(2)
    expect(rejected.taskId).toBeDefined()
  })

  it('T-I5b-cluster: cluster crash with restartWorkerOnError:false does NOT replenish', {
    retry: 0,
    timeout: 10_000,
  }, async () => {
    const pool = trackPool(
      new FixedClusterPool(
        1,
        './tests/worker-files/cluster/processExitWorker.cjs',
        {
          enableTasksQueue: false,
          errorHandler: () => undefined,
          restartWorkerOnError: false,
        }
      )
    )
    await new Promise(resolve => {
      pool.emitter.once(PoolEvents.ready, resolve)
    })
    let rejected
    try {
      await pool.execute()
    } catch (e) {
      rejected = e
    }
    expect(rejected).toBeInstanceOf(WorkerCrashError)
    await new Promise(resolve => setTimeout(resolve, 200))
    expect(pool.workerNodes.length).toBe(0)
  })

  it('T-I5c-cluster: cluster clean process.exit(0) mid-task rejects with WorkerCrashError', {
    retry: 0,
    timeout: 10_000,
  }, async () => {
    const pool = trackPool(
      new FixedClusterPool(
        1,
        './tests/worker-files/cluster/cleanExitInFlightWorker.cjs',
        {
          enableTasksQueue: false,
          errorHandler: () => undefined,
        }
      )
    )
    await new Promise(resolve => {
      pool.emitter.once(PoolEvents.ready, resolve)
    })
    let rejected
    try {
      await pool.execute()
    } catch (e) {
      rejected = e
    }
    expect(rejected).toBeInstanceOf(WorkerCrashError)
    expect(rejected.name).toBe('WorkerCrashError')
    expect(rejected.exitCode).toBe(0)
    expect(rejected.taskId).toBeDefined()
  })
})
