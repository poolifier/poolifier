import { afterEach, describe, expect, it } from 'vitest'

import {
  FixedClusterPool,
  FixedThreadPool,
  PoolEvents,
  WorkerCrashError,
  WorkerTerminationError,
} from '../../lib/index.mjs'
import { collectRejection, createPoolCleanup } from './crash-recovery-utils.mjs'

describe('Pool in-flight termination', () => {
  const { cleanupPools, trackPool } = createPoolCleanup()
  afterEach(cleanupPools)

  it.each([
    ['thread', FixedThreadPool, './tests/worker-files/thread/hangWorker.mjs'],
    [
      'cluster',
      FixedClusterPool,
      './tests/worker-files/cluster/hangWorker.cjs',
    ],
  ])(
    '%s pool.destroy() with hung task rejects in-flight with WorkerTerminationError',
    {
      retry: 0,
      timeout: 10_000,
    },
    async (_workerType, Pool, workerPath) => {
      const pool = trackPool(
        new Pool(1, workerPath, {
          enableTasksQueue: true,
          tasksQueueOptions: { tasksFinishedTimeout: 100 },
        })
      )
      if (!pool.info.ready) {
        await new Promise(resolve => {
          pool.emitter.once(PoolEvents.ready, resolve)
        })
      }
      const errorEvents = []
      pool.emitter.on(PoolEvents.error, error => {
        errorEvents.push(error)
      })
      const taskOutcome = Promise.allSettled([pool.execute()])
      expect(pool.info.executingTasks).toBe(1)
      expect(pool.workerNodes[0].usage.tasks.executing).toBe(1)
      await pool.destroy()
      const [result] = await taskOutcome
      expect(result.status).toBe('rejected')
      const rejected = result.reason
      expect(rejected).toBeInstanceOf(WorkerTerminationError)
      expect(rejected.name).toBe('WorkerTerminationError')
      expect(rejected.taskId).toBeDefined()
      expect(rejected.workerId).toBeDefined()
      expect(rejected).not.toBeInstanceOf(WorkerCrashError)
      expect(errorEvents.some(error => error instanceof WorkerCrashError)).toBe(
        false
      )
    }
  )

  it('destroy with one in-flight worker leaves idle worker promises unaffected', {
    retry: 0,
    timeout: 10_000,
  }, async () => {
    const pool = trackPool(
      new FixedThreadPool(2, './tests/worker-files/thread/hangWorker.mjs', {
        enableTasksQueue: true,
        tasksQueueOptions: { tasksFinishedTimeout: 200 },
      })
    )
    if (!pool.info.ready) {
      await new Promise(resolve => {
        pool.emitter.once(PoolEvents.ready, resolve)
      })
    }
    const rejections = []
    const promise = collectRejection(pool.execute(), rejections)
    expect(pool.info.executingTasks).toBe(1)
    expect(pool.workerNodes[0].usage.tasks.executing).toBe(1)
    await pool.destroy()
    await Promise.allSettled([promise])
    expect(rejections.length).toBe(1)
    expect(rejections[0]).toBeInstanceOf(WorkerTerminationError)
    expect(rejections[0].name).toBe('WorkerTerminationError')
  })

  it('tasksFinishedTimeout is honored as a ceiling for pre-existing in-flight tasks (no queue)', {
    retry: 0,
    timeout: 10_000,
  }, async () => {
    const ceiling = 1000
    const pool = trackPool(
      new FixedThreadPool(1, './tests/worker-files/thread/hangWorker.mjs', {
        enableTasksQueue: true,
        tasksQueueOptions: { tasksFinishedTimeout: ceiling },
      })
    )
    if (!pool.info.ready) {
      await new Promise(resolve => {
        pool.emitter.once(PoolEvents.ready, resolve)
      })
    }
    const taskOutcome = Promise.allSettled([pool.execute()])
    expect(pool.info.executingTasks).toBe(1)
    expect(pool.workerNodes[0].usage.tasks.executing).toBe(1)
    expect(pool.workerNodes[0].usage.tasks.executing).toBe(1)
    expect(pool.workerNodes[0].tasksQueueSize()).toBe(0)
    const start = Date.now()
    await pool.destroy()
    const elapsed = Date.now() - start
    const [result] = await taskOutcome
    expect(result.status).toBe('rejected')
    const rejected = result.reason
    expect(rejected).toBeInstanceOf(WorkerTerminationError)
    expect(rejected.taskId).toBeDefined()
    expect(elapsed).toBeGreaterThanOrEqual(ceiling - 200)
    expect(elapsed).toBeLessThan(ceiling + 2000)
  })

  it('in-flight task settling before tasksFinishedTimeout keeps its normal outcome', {
    retry: 0,
    timeout: 10_000,
  }, async () => {
    const ceiling = 5000
    const payload = { nested: { value: 42 }, operation: 'termination-grace' }
    const pool = trackPool(
      new FixedThreadPool(1, './tests/worker-files/thread/asyncWorker.mjs', {
        enableTasksQueue: true,
        tasksQueueOptions: { tasksFinishedTimeout: ceiling },
      })
    )
    if (!pool.info.ready) {
      await new Promise(resolve => {
        pool.emitter.once(PoolEvents.ready, resolve)
      })
    }
    const errorEvents = []
    pool.emitter.on(PoolEvents.error, error => {
      errorEvents.push(error)
    })
    const workerNode = pool.workerNodes[0]
    let taskExecutionFinishedEvents = 0
    let taskFinishedEvents = 0
    workerNode.on('taskExecutionFinished', () => {
      ++taskExecutionFinishedEvents
    })
    workerNode.on('taskFinished', () => {
      ++taskFinishedEvents
    })
    const taskOutcome = pool.execute(payload)
    const taskOutcomeAssertion =
      expect(taskOutcome).resolves.toStrictEqual(payload)
    const taskOutcomeAssertionObserved = Promise.allSettled([
      taskOutcomeAssertion,
    ])
    expect(pool.info.executingTasks).toBe(1)
    expect(workerNode.usage.tasks.executing).toBe(1)
    const start = Date.now()
    await pool.destroy()
    const elapsed = Date.now() - start
    await taskOutcomeAssertionObserved
    await taskOutcomeAssertion
    expect(elapsed).toBeLessThan(ceiling - 1000)
    expect(errorEvents).toHaveLength(0)
    expect(taskExecutionFinishedEvents).toBe(1)
    expect(taskFinishedEvents).toBe(1)
    expect(pool.info.executingTasks).toBe(0)
    expect(workerNode.usage.tasks.executing).toBe(0)
    expect(workerNode.usage.tasks.executed).toBe(1)
    expect(workerNode.usage.tasks.failed).toBe(0)
  })

  it('fire-and-forget × N + destroy collects N WorkerTerminationError rejections, no Pool unhandled rejection', {
    retry: 0,
    timeout: 10_000,
  }, async () => {
    const pool = trackPool(
      new FixedThreadPool(2, './tests/worker-files/thread/hangWorker.mjs', {
        enableTasksQueue: true,
        tasksQueueOptions: { tasksFinishedTimeout: 200 },
      })
    )
    if (!pool.info.ready) {
      await new Promise(resolve => {
        pool.emitter.once(PoolEvents.ready, resolve)
      })
    }
    const N = 8
    const rejections = []
    const promises = []
    for (let i = 0; i < N; i++) {
      promises.push(collectRejection(pool.execute(), rejections))
    }
    expect(pool.info.executingTasks + pool.info.queuedTasks).toBe(N)
    expect(
      pool.workerNodes.reduce(
        (total, workerNode) => total + workerNode.usage.tasks.executing,
        0
      )
    ).toBe(2)
    expect(
      pool.workerNodes.reduce(
        (total, workerNode) => total + workerNode.tasksQueueSize(),
        0
      )
    ).toBe(N - 2)
    await pool.destroy()
    await Promise.allSettled(promises)
    expect(rejections.length).toBe(N)
    expect(
      rejections.every(error => error?.name === 'WorkerTerminationError')
    ).toBe(true)
    const taskIds = rejections
      .map(error => error.taskId)
      .filter(id => id != null)
    expect(new Set(taskIds).size).toBe(taskIds.length)
    expect(taskIds.length).toBe(N)
  })
})
