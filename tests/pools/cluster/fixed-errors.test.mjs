import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  FixedClusterPool,
  PoolEvents,
  WorkerCrashError,
} from '../../../lib/index.mjs'
import { DEFAULT_TASK_NAME } from '../../../lib/utils.mjs'
import { waitWorkerEvents } from '../../test-utils.cjs'

describe('Fixed cluster pool error test suite', () => {
  const numberOfWorkers = 8
  let asyncErrorPool, asyncPool, crashPool, errorPool

  beforeAll(async () => {
    errorPool = new FixedClusterPool(
      numberOfWorkers,
      './tests/worker-files/cluster/errorWorker.cjs',
      {
        errorHandler: e => console.error(e),
      }
    )
    asyncErrorPool = new FixedClusterPool(
      numberOfWorkers,
      './tests/worker-files/cluster/asyncErrorWorker.cjs',
      {
        errorHandler: e => console.error(e),
      }
    )
    asyncPool = new FixedClusterPool(
      numberOfWorkers,
      './tests/worker-files/cluster/asyncWorker.cjs'
    )
    crashPool = new FixedClusterPool(
      1,
      './tests/worker-files/cluster/crashWorker.cjs',
      {
        enableTasksQueue: true,
        restartWorkerOnError: false,
        tasksQueueOptions: { concurrency: 1 },
      }
    )
    await Promise.all(
      [errorPool, asyncErrorPool, asyncPool].map(async currentPool => {
        if (!currentPool.info.ready) {
          await new Promise(resolve =>
            currentPool.emitter.once(PoolEvents.ready, resolve)
          )
        }
      })
    )
  })

  afterAll(async () => {
    if (process.env.CI != null) return
    await asyncPool.destroy()
    await errorPool.destroy()
    await asyncErrorPool.destroy()
    await crashPool.destroy()
  })

  it('Verify that error handling is working properly:sync', async () => {
    const data = { f: 10 }
    expect(errorPool.emitter.eventNames()).toStrictEqual([])
    let taskError
    errorPool.emitter.on(PoolEvents.taskError, e => {
      taskError = e
    })
    expect(errorPool.emitter.eventNames()).toStrictEqual([PoolEvents.taskError])
    let inError
    try {
      await errorPool.execute(data)
    } catch (e) {
      inError = e
    }
    expect(inError).toBeInstanceOf(Error)
    expect(inError.message).toStrictEqual('Error Message from ClusterWorker')
    expect(typeof inError.stack === 'string').toBe(true)
    expect(taskError).toStrictEqual({
      aborted: false,
      data,
      message: inError.message,
      name: DEFAULT_TASK_NAME,
      stack: inError.stack,
    })
    expect(
      errorPool.workerNodes.some(
        workerNode => workerNode.usage.tasks.failed === 1
      )
    ).toBe(true)
  })

  it('Verify that error handling is working properly:async', async () => {
    const data = { f: 10 }
    expect(asyncErrorPool.emitter.eventNames()).toStrictEqual([])
    let taskError
    asyncErrorPool.emitter.on(PoolEvents.taskError, e => {
      taskError = e
    })
    expect(asyncErrorPool.emitter.eventNames()).toStrictEqual([
      PoolEvents.taskError,
    ])
    let inError
    try {
      await asyncErrorPool.execute(data)
    } catch (e) {
      inError = e
    }
    expect(inError).toBeInstanceOf(Error)
    expect(inError.message).toStrictEqual(
      'Error Message from ClusterWorker:async'
    )
    expect(typeof inError.stack === 'string').toBe(true)
    expect(taskError).toStrictEqual({
      aborted: false,
      data,
      message: inError.message,
      name: DEFAULT_TASK_NAME,
      stack: inError.stack,
    })
    expect(
      asyncErrorPool.workerNodes.some(
        workerNode => workerNode.usage.tasks.failed === 1
      )
    ).toBe(true)
  })

  // Discriminate via `error.name` (NOT instanceof — dual-package
  // safety). `{ retry: 0 }` because the test is deterministic.
  it('Verify that in-flight task promises reject on worker crash', {
    retry: 0,
  }, async () => {
    const poolErrorPromise = new Promise(resolve => {
      crashPool.emitter.once(PoolEvents.error, resolve)
    })
    const exitPromise = waitWorkerEvents(crashPool, 'exit', 1)
    let error
    try {
      await crashPool.execute()
    } catch (e) {
      error = e
    }
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('WorkerCrashError')
    if (error.exitCode != null) {
      expect(error.exitCode).not.toBe(0)
    } else {
      expect(error.signal).not.toBeNull()
    }
    expect(error.cause).toBeUndefined()
    const poolError = await poolErrorPromise
    expect(error).toBeInstanceOf(WorkerCrashError)
    expect(error.taskId).toBeDefined()
    expect(poolError).toBeInstanceOf(WorkerCrashError)
    expect(poolError.name).toBe('WorkerCrashError')
    expect(poolError).not.toBe(error)
    expect(poolError.taskId).toBeUndefined()
    expect(poolError.workerId).toBe(error.workerId)
    expect(poolError.exitCode).toBe(error.exitCode)
    expect(poolError.signal).toBe(error.signal)
    await exitPromise
  })

  it('Verify that async function is working properly', async () => {
    const data = { f: 10 }
    const startTime = performance.now()
    const result = await asyncPool.execute(data)
    const usedTime = performance.now() - startTime
    expect(result).toStrictEqual(data)
    expect(usedTime).toBeGreaterThanOrEqual(2000)
  })

  it('Verify that task can be aborted', async () => {
    let error

    try {
      await asyncErrorPool.execute({}, 'default', AbortSignal.timeout(500))
    } catch (e) {
      error = e
    }
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('TimeoutError')
    expect(error.message).toBe('The operation was aborted due to timeout')
    expect(error.stack).toBeDefined()

    const abortController = new AbortController()
    setTimeout(() => {
      abortController.abort(new Error('Task aborted'))
    }, 500)
    try {
      await asyncErrorPool.execute({}, 'default', abortController.signal)
    } catch (e) {
      error = e
    }
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe('Task aborted')
    expect(error.stack).toBeDefined()
  })
})
