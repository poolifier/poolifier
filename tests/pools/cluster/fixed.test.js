const { expect } = require('expect')
const { FixedClusterPool, PoolEvents } = require('../../../lib')
const { TaskFunctions } = require('../../test-types')
const { waitPoolEvents, waitWorkerEvents } = require('../../test-utils')

describe('Fixed cluster pool test suite', () => {
  const numberOfWorkers = 6
  const tasksConcurrency = 2
  const pool = new FixedClusterPool(
    numberOfWorkers,
    './tests/worker-files/cluster/testWorker.js',
    {
      errorHandler: (e) => console.error(e)
    }
  )
  const queuePool = new FixedClusterPool(
    numberOfWorkers,
    './tests/worker-files/cluster/testWorker.js',
    {
      enableTasksQueue: true,
      tasksQueueOptions: {
        concurrency: tasksConcurrency
      },
      errorHandler: (e) => console.error(e)
    }
  )
  const emptyPool = new FixedClusterPool(
    numberOfWorkers,
    './tests/worker-files/cluster/emptyWorker.js',
    { exitHandler: () => console.info('empty pool worker exited') }
  )
  const echoPool = new FixedClusterPool(
    numberOfWorkers,
    './tests/worker-files/cluster/echoWorker.js'
  )
  const errorPool = new FixedClusterPool(
    numberOfWorkers,
    './tests/worker-files/cluster/errorWorker.js',
    {
      errorHandler: (e) => console.error(e)
    }
  )
  const asyncErrorPool = new FixedClusterPool(
    numberOfWorkers,
    './tests/worker-files/cluster/asyncErrorWorker.js',
    {
      errorHandler: (e) => console.error(e)
    }
  )
  const asyncPool = new FixedClusterPool(
    numberOfWorkers,
    './tests/worker-files/cluster/asyncWorker.js'
  )

  after('Destroy all pools', async () => {
    // We need to clean up the resources after our test
    await echoPool.destroy()
    await asyncPool.destroy()
    await errorPool.destroy()
    await asyncErrorPool.destroy()
    await emptyPool.destroy()
    await queuePool.destroy()
  })

  it('Verify that the function is executed in a worker cluster', async () => {
    let result = await pool.execute({
      function: TaskFunctions.fibonacci
    })
    expect(result).toBe(75025)
    result = await pool.execute({
      function: TaskFunctions.factorial
    })
    expect(result).toBe(9.33262154439441e157)
  })

  it('Verify that is possible to invoke the execute() method without input', async () => {
    const result = await pool.execute()
    expect(result).toStrictEqual({ ok: 1 })
  })

  it("Verify that 'ready' event is emitted", async () => {
    const pool1 = new FixedClusterPool(
      numberOfWorkers,
      './tests/worker-files/cluster/testWorker.js',
      {
        errorHandler: (e) => console.error(e)
      }
    )
    let poolReady = 0
    pool1.emitter.on(PoolEvents.ready, () => ++poolReady)
    await waitPoolEvents(pool1, PoolEvents.ready, 1)
    expect(poolReady).toBe(1)
  })

  it("Verify that 'busy' event is emitted", () => {
    let poolBusy = 0
    pool.emitter.on(PoolEvents.busy, () => ++poolBusy)
    for (let i = 0; i < numberOfWorkers * 2; i++) {
      pool.execute()
    }
    // The `busy` event is triggered when the number of submitted tasks at once reach the number of fixed pool workers.
    // So in total numberOfWorkers + 1 times for a loop submitting up to numberOfWorkers * 2 tasks to the fixed pool.
    expect(poolBusy).toBe(numberOfWorkers + 1)
  })

  it('Verify that tasks queuing is working', async () => {
    const promises = new Set()
    const maxMultiplier = 3 // Must be greater than tasksConcurrency
    for (let i = 0; i < numberOfWorkers * maxMultiplier; i++) {
      promises.add(queuePool.execute())
    }
    expect(promises.size).toBe(numberOfWorkers * maxMultiplier)
    for (const workerNode of queuePool.workerNodes) {
      expect(workerNode.usage.tasks.executing).toBeGreaterThanOrEqual(0)
      expect(workerNode.usage.tasks.executing).toBeLessThanOrEqual(
        queuePool.opts.tasksQueueOptions.concurrency
      )
      expect(workerNode.usage.tasks.executed).toBe(0)
      expect(workerNode.usage.tasks.queued).toBe(
        maxMultiplier - queuePool.opts.tasksQueueOptions.concurrency
      )
      expect(workerNode.usage.tasks.maxQueued).toBe(
        maxMultiplier - queuePool.opts.tasksQueueOptions.concurrency
      )
    }
    expect(queuePool.info.executingTasks).toBe(
      numberOfWorkers * queuePool.opts.tasksQueueOptions.concurrency
    )
    expect(queuePool.info.queuedTasks).toBe(
      numberOfWorkers *
        (maxMultiplier - queuePool.opts.tasksQueueOptions.concurrency)
    )
    expect(queuePool.info.maxQueuedTasks).toBe(
      numberOfWorkers *
        (maxMultiplier - queuePool.opts.tasksQueueOptions.concurrency)
    )
    expect(queuePool.info.backPressure).toBe(false)
    await Promise.all(promises)
    for (const workerNode of queuePool.workerNodes) {
      expect(workerNode.usage.tasks.executing).toBe(0)
      expect(workerNode.usage.tasks.executed).toBe(maxMultiplier)
      expect(workerNode.usage.tasks.queued).toBe(0)
      expect(workerNode.usage.tasks.maxQueued).toBe(
        maxMultiplier - queuePool.opts.tasksQueueOptions.concurrency
      )
    }
  })

  it('Verify that is possible to have a worker that return undefined', async () => {
    const result = await emptyPool.execute()
    expect(result).toBeUndefined()
  })

  it('Verify that data are sent to the worker correctly', async () => {
    const data = { f: 10 }
    const result = await echoPool.execute(data)
    expect(result).toStrictEqual(data)
  })

  it('Verify that error handling is working properly:sync', async () => {
    const data = { f: 10 }
    let taskError
    errorPool.emitter.on(PoolEvents.taskError, (e) => {
      taskError = e
    })
    let inError
    try {
      await errorPool.execute(data)
    } catch (e) {
      inError = e
    }
    expect(inError).toBeDefined()
    expect(typeof inError === 'string').toBe(true)
    expect(inError).toBe('Error Message from ClusterWorker')
    expect(taskError).toStrictEqual({
      name: 'default',
      message: 'Error Message from ClusterWorker',
      data
    })
    expect(
      errorPool.workerNodes.some(
        (workerNode) => workerNode.usage.tasks.failed === 1
      )
    ).toBe(true)
  })

  it('Verify that error handling is working properly:async', async () => {
    const data = { f: 10 }
    let taskError
    asyncErrorPool.emitter.on(PoolEvents.taskError, (e) => {
      taskError = e
    })
    let inError
    try {
      await asyncErrorPool.execute(data)
    } catch (e) {
      inError = e
    }
    expect(inError).toBeDefined()
    expect(typeof inError === 'string').toBe(true)
    expect(inError).toBe('Error Message from ClusterWorker:async')
    expect(taskError).toStrictEqual({
      name: 'default',
      message: 'Error Message from ClusterWorker:async',
      data
    })
    expect(
      asyncErrorPool.workerNodes.some(
        (workerNode) => workerNode.usage.tasks.failed === 1
      )
    ).toBe(true)
  })

  it('Verify that async function is working properly', async () => {
    const data = { f: 10 }
    const startTime = performance.now()
    const result = await asyncPool.execute(data)
    const usedTime = performance.now() - startTime
    expect(result).toStrictEqual(data)
    expect(usedTime).toBeGreaterThanOrEqual(2000)
  })

  it('Shutdown test', async () => {
    const exitPromise = waitWorkerEvents(pool, 'exit', numberOfWorkers)
    let poolDestroy = 0
    pool.emitter.on(PoolEvents.destroy, () => ++poolDestroy)
    await pool.destroy()
    const numberOfExitEvents = await exitPromise
    expect(numberOfExitEvents).toBe(numberOfWorkers)
    expect(poolDestroy).toBe(1)
  })

  it('Verify that cluster pool options are checked', async () => {
    const workerFilePath = './tests/worker-files/cluster/testWorker.js'
    let pool1 = new FixedClusterPool(numberOfWorkers, workerFilePath)
    expect(pool1.opts.env).toBeUndefined()
    expect(pool1.opts.settings).toBeUndefined()
    await pool1.destroy()
    pool1 = new FixedClusterPool(numberOfWorkers, workerFilePath, {
      env: { TEST: 'test' },
      settings: { args: ['--use', 'http'], silent: true }
    })
    expect(pool1.opts.env).toStrictEqual({ TEST: 'test' })
    expect(pool1.opts.settings).toStrictEqual({
      args: ['--use', 'http'],
      silent: true
    })
    expect({ ...pool1.opts.settings, exec: workerFilePath }).toStrictEqual({
      args: ['--use', 'http'],
      silent: true,
      exec: workerFilePath
    })
    await pool1.destroy()
  })

  it('Should work even without opts in input', async () => {
    const pool1 = new FixedClusterPool(
      numberOfWorkers,
      './tests/worker-files/cluster/testWorker.js'
    )
    const res = await pool1.execute()
    expect(res).toStrictEqual({ ok: 1 })
    // We need to clean up the resources after our test
    await pool1.destroy()
  })

  it('Verify that a pool with zero worker fails', async () => {
    expect(
      () =>
        new FixedClusterPool(0, './tests/worker-files/cluster/testWorker.js')
    ).toThrowError('Cannot instantiate a fixed pool with zero worker')
  })
})
