import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { FixedThreadPool, PoolEvents } from '../../../lib/index.mjs'
import { DEFAULT_TASK_NAME } from '../../../lib/utils.mjs'
import { waitWorkerEvents } from '../../test-utils.cjs'

describe('Fixed thread pool error test suite', () => {
  const numberOfThreads = 6
  let asyncErrorPool, asyncPool, busyPool, crashPool, errorPool

  beforeAll(async () => {
    errorPool = new FixedThreadPool(
      numberOfThreads,
      './tests/worker-files/thread/errorWorker.mjs',
      {
        errorHandler: e => console.error(e),
      }
    )
    asyncErrorPool = new FixedThreadPool(
      numberOfThreads,
      './tests/worker-files/thread/asyncErrorWorker.mjs',
      {
        errorHandler: e => console.error(e),
      }
    )
    asyncPool = new FixedThreadPool(
      numberOfThreads,
      './tests/worker-files/thread/asyncWorker.mjs'
    )
    busyPool = new FixedThreadPool(
      1,
      './tests/worker-files/thread/asyncWorker.mjs',
      {
        enableTasksQueue: true,
        tasksQueueOptions: { concurrency: 1 },
      }
    )
    crashPool = new FixedThreadPool(
      1,
      './tests/worker-files/thread/crashWorker.mjs',
      {
        enableTasksQueue: true,
        restartWorkerOnError: false,
        tasksQueueOptions: { concurrency: 1 },
      }
    )
    await Promise.all(
      [errorPool, asyncErrorPool, asyncPool, busyPool].map(
        async currentPool => {
          if (!currentPool.info.ready) {
            await new Promise(resolve =>
              currentPool.emitter.once(PoolEvents.ready, resolve)
            )
          }
        }
      )
    )
  })

  afterAll(async () => {
    if (process.env.CI != null) return
    await asyncPool.destroy()
    await errorPool.destroy()
    await asyncErrorPool.destroy()
    await busyPool.destroy()
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
    expect(inError.message).toStrictEqual('Error Message from ThreadWorker')
    expect(typeof inError.stack === 'string').toBe(true)
    expect(taskError).toStrictEqual({
      aborted: false,
      data,
      error: inError,
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
      'Error Message from ThreadWorker:async'
    )
    expect(typeof inError.stack === 'string').toBe(true)
    expect(taskError).toStrictEqual({
      aborted: false,
      data,
      error: inError,
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
    const workerId = crashPool.workerNodes[0].info.id
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
    expect(error.cause).toBeInstanceOf(Error)
    expect(error.cause.message).toBe('Simulated worker crash')
    expect(error.taskId).toEqual(expect.any(String))
    expect(error.workerId).toBe(workerId)
    expect(error.signal).toBeNull()
    const poolError = await poolErrorPromise
    expect(poolError).toBeInstanceOf(Error)
    expect(poolError.name).toBe('WorkerCrashError')
    expect(poolError.cause.message).toBe('Simulated worker crash')
    expect(poolError.taskId).toBeUndefined()
    expect(poolError.workerId).toBe(workerId)
    expect(poolError.exitCode).toBe(1)
    expect(poolError.signal).toBeNull()
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

  it('rejects a pre-aborted task before queueing on a busy ready worker', async () => {
    const runningTask = busyPool.execute({ task: 'running' })
    const abortReason = new Error('Task pre-aborted')
    const abortController = new AbortController()
    abortController.abort(abortReason)

    const abortedTask = busyPool.execute(
      { task: 'aborted' },
      'default',
      abortController.signal
    )

    await expect(abortedTask).rejects.toBe(abortReason)
    expect(busyPool.info.queuedTasks).toBe(0)
    await runningTask
  })
})
