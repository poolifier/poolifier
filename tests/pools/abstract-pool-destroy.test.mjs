import {
  describe,
  expect,
  FixedClusterPool,
  FixedThreadPool,
  it,
  numberOfWorkers,
  ready,
  WorkerTerminationError,
  WorkerTypes,
} from './abstract-pool-test-support.mjs'

describe('Abstract pool test suite', () => {
  it('Verify that destroy() waits for queued tasks to finish', async () => {
    const tasksFinishedTimeout = 2500
    const pool = new FixedThreadPool(
      numberOfWorkers,
      './tests/worker-files/thread/asyncWorker.mjs',
      {
        enableTasksQueue: true,
        tasksQueueOptions: { tasksFinishedTimeout },
      }
    )
    await ready(pool)
    const maxMultiplier = 4
    let tasksFinished = 0
    for (const workerNode of pool.workerNodes) {
      workerNode.on('taskFinished', () => {
        ++tasksFinished
      })
    }
    // .catch collection: pool.destroy() may reject in-flight task promises
    // with WorkerTerminationError when tasksFinishedTimeout elapses.
    // Tasks that finish before destroy() returns resolve normally; only
    // the in-flight ones at the timeout boundary reject.
    const rejections = []
    const promises = []
    for (let i = 0; i < numberOfWorkers * maxMultiplier; i++) {
      promises.push(
        pool.execute().catch(e => {
          rejections.push(e)
          return undefined
        })
      )
    }
    expect(pool.info.queuedTasks).toBeGreaterThan(0)
    const startTime = performance.now()
    await pool.destroy()
    await Promise.allSettled(promises)
    const elapsedTime = performance.now() - startTime
    expect(tasksFinished).toBeLessThanOrEqual(numberOfWorkers * maxMultiplier)
    expect(elapsedTime).toBeGreaterThanOrEqual(2000)
    // Worker kill message response timeout is 1000ms
    expect(elapsedTime).toBeLessThanOrEqual(
      tasksFinishedTimeout + 1000 * tasksFinished + 1000
    )
    expect(rejections.every(e => e?.name === 'WorkerTerminationError')).toBe(
      true
    )
  })

  for (const { PoolClass, workerFilePath, workerType } of [
    {
      PoolClass: FixedClusterPool,
      workerFilePath: './tests/worker-files/cluster/asyncWorker.cjs',
      workerType: WorkerTypes.cluster,
    },
    {
      PoolClass: FixedThreadPool,
      workerFilePath: './tests/worker-files/thread/asyncWorker.mjs',
      workerType: WorkerTypes.thread,
    },
  ]) {
    it(`Verify that destroy() waits until the tasks finished timeout is reached in a ${workerType} pool`, async () => {
      const tasksFinishedTimeout = 1000
      const pool = new PoolClass(numberOfWorkers, workerFilePath, {
        enableTasksQueue: true,
        tasksQueueOptions: { tasksFinishedTimeout },
      })
      await ready(pool)
      const maxMultiplier = 4
      let tasksFinished = 0
      for (const workerNode of pool.workerNodes) {
        workerNode.on('taskFinished', () => {
          ++tasksFinished
        })
      }
      // .catch collection — see preceding test for rationale.
      const rejections = []
      const promises = []
      for (let i = 0; i < numberOfWorkers * maxMultiplier; i++) {
        promises.push(
          pool.execute().catch(e => {
            rejections.push(e)
            return undefined
          })
        )
      }
      expect(pool.info.queuedTasks).toBeGreaterThan(0)
      const startTime = performance.now()
      await pool.destroy()
      await Promise.allSettled(promises)
      const elapsedTime = performance.now() - startTime
      // taskFinished tracks work whose worker execution started. Queued
      // submissions still reject on destroy, but are not failed executions.
      expect(tasksFinished).toBe(numberOfWorkers)
      // Allow task timeout, 1000ms per kill response, and 100ms scheduling slack.
      expect(elapsedTime).toBeLessThanOrEqual(
        tasksFinishedTimeout + 1000 * tasksFinished + 1100
      )
      expect(rejections.length).toBeGreaterThan(0)
      expect(rejections.every(e => e instanceof WorkerTerminationError)).toBe(
        true
      )
      expect(rejections.every(e => e.name === 'WorkerTerminationError')).toBe(
        true
      )
    })
  }
})
