import {
  describe,
  expect,
  FixedClusterPool,
  FixedThreadPool,
  it,
  numberOfWorkers,
  PoolEvents,
  ready,
  vi,
  WorkerNode,
} from './abstract-pool-test-support.mjs'

describe('Abstract pool test suite', () => {
  it('Verify that pool statuses are checked at start or destroy', async () => {
    const pool = new FixedThreadPool(
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.mjs'
    )
    await ready(pool)
    expect(pool.info.started).toBe(true)
    expect(pool.info.ready).toBe(true)
    expect(() => pool.start()).toThrow(
      new Error('Cannot start an already started pool')
    )
    await pool.destroy()
    expect(pool.info.started).toBe(false)
    expect(pool.info.ready).toBe(false)
    await expect(pool.destroy()).rejects.toThrow(
      new Error('Cannot destroy an already destroyed pool')
    )
  })

  it('Verify that pool can be started after initialization', async () => {
    const pool = new FixedClusterPool(
      numberOfWorkers,
      './tests/worker-files/cluster/testWorker.cjs',
      {
        startWorkers: false,
      }
    )
    expect(pool.info.started).toBe(false)
    expect(pool.info.ready).toBe(false)
    expect(pool.workerNodes).toStrictEqual([])
    const readyEvent = new Promise(resolve =>
      pool.emitter.once(PoolEvents.ready, resolve)
    )
    pool.start()
    expect(pool.info.started).toBe(true)
    await readyEvent
    expect(pool.info.ready).toBe(true)
    expect(pool.workerNodes.length).toBe(numberOfWorkers)
    for (const workerNode of pool.workerNodes) {
      expect(workerNode).toBeInstanceOf(WorkerNode)
    }
    await pool.destroy()
  })

  it('rolls back an Nth-worker synchronous start failure and permits retry', async () => {
    const pool = new FixedThreadPool(
      3,
      './tests/worker-files/thread/testWorker.mjs',
      { startWorkers: false }
    )
    const startError = new Error('second worker startup failed')
    const sendStartupMessageToWorker =
      pool.sendStartupMessageToWorker.bind(pool)
    let startupMessages = 0
    pool.sendStartupMessageToWorker = workerNodeKey => {
      ++startupMessages
      if (startupMessages === 2) throw startError
      sendStartupMessageToWorker(workerNodeKey)
    }

    expect(() => pool.start()).toThrow(startError)
    expect(pool.info.started).toBe(false)
    expect(pool.workerNodes).toHaveLength(0)

    pool.sendStartupMessageToWorker = sendStartupMessageToWorker
    pool.start()
    await ready(pool)
    expect(await pool.execute({ ok: 1 })).toStrictEqual({ ok: 1 })
    await pool.destroy()
  })

  it('does not admit or dispatch to a worker before catalog replay finishes', async () => {
    const pool = new FixedThreadPool(
      1,
      './tests/worker-files/thread/testWorker.mjs',
      { startWorkers: false }
    )
    await pool.addTaskFunction('runtime', data => ({ ...data, replayed: true }))
    const manager = pool.taskFunctionTransactionManager
    const synchronize = manager.synchronize.bind(manager)
    let releaseReplay
    const replayBlocked = new Promise(resolve => {
      releaseReplay = resolve
    })
    let notifyReplayStarted
    const replayStarted = new Promise(resolve => {
      notifyReplayStarted = resolve
    })
    manager.synchronize = vi.fn(async handle => {
      notifyReplayStarted()
      await replayBlocked
      return await synchronize(handle)
    })
    const sendToWorker = pool.sendToWorker.bind(pool)
    const dispatchedTaskIds = []
    pool.sendToWorker = (workerNodeKey, message, transferList) => {
      if (message.taskId != null) dispatchedTaskIds.push(message.taskId)
      sendToWorker(workerNodeKey, message, transferList)
    }

    pool.start()
    await replayStarted
    const execution = pool.execute({ value: 1 }, 'runtime')
    await new Promise(resolve => setImmediate(resolve))

    expect(pool.workerNodes[0].info.ready).toBe(false)
    expect(pool.info.ready).toBe(false)
    expect(dispatchedTaskIds).toStrictEqual([])

    releaseReplay()
    await expect(execution).resolves.toStrictEqual({ replayed: true, value: 1 })
    expect(pool.workerNodes[0].info.ready).toBe(true)
    await pool.destroy()
  })

  it('observes replay rejection and replaces the worker without admitting it', async () => {
    const pool = new FixedThreadPool(
      1,
      './tests/worker-files/thread/testWorker.mjs',
      { startWorkers: false }
    )
    const manager = pool.taskFunctionTransactionManager
    const synchronize = manager.synchronize.bind(manager)
    const replayError = new Error('catalog replay failed')
    let failedWorker
    manager.synchronize = vi.fn(async handle => {
      if (failedWorker == null) {
        failedWorker = handle.worker
        throw replayError
      }
      return await synchronize(handle)
    })
    let notifyErrorObserved
    const errorObserved = new Promise(resolve => {
      notifyErrorObserved = resolve
    })
    pool.publishPoolError = error => {
      notifyErrorObserved(error)
    }

    pool.start()

    await expect(errorObserved).resolves.toBe(replayError)
    await ready(pool)
    expect(pool.workerNodes).not.toContain(failedWorker)
    expect(pool.workerNodes[0].info.ready).toBe(true)
    await pool.destroy()
  })
})
