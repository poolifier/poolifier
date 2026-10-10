import {
  describe,
  EventEmitterAsyncResource,
  expect,
  FixedThreadPool,
  it,
  numberOfWorkers,
  ready,
  WorkerChoiceStrategies,
} from './abstract-pool-test-support.mjs'

describe('Abstract pool test suite', () => {
  it('Verify that pool options are checked', async () => {
    let pool = new FixedThreadPool(
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.mjs'
    )
    await ready(pool)
    expect(pool.emitter).toBeInstanceOf(EventEmitterAsyncResource)
    expect(pool.emitter.eventNames()).toStrictEqual([])
    expect(pool.opts).toStrictEqual({
      enableEvents: true,
      enableTasksQueue: false,
      restartWorkerOnError: true,
      startWorkers: true,
      workerChoiceStrategy: WorkerChoiceStrategies.LEAST_USED,
    })
    for (const [, workerChoiceStrategy] of pool.workerChoiceStrategiesContext
      .workerChoiceStrategies) {
      expect(workerChoiceStrategy.opts).toStrictEqual({
        elu: { median: false },
        runTime: { median: false },
        waitTime: { median: false },
        weights: expect.objectContaining({
          0: expect.any(Number),
          [pool.info.maxSize - 1]: expect.any(Number),
        }),
      })
    }
    await pool.destroy()
    const testHandler = () => console.info('test handler executed')
    pool = new FixedThreadPool(
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.mjs',
      {
        enableEvents: false,
        enableTasksQueue: true,
        errorHandler: testHandler,
        exitHandler: testHandler,
        messageHandler: testHandler,
        onlineHandler: testHandler,
        restartWorkerOnError: false,
        tasksQueueOptions: { concurrency: 2 },
        workerChoiceStrategy: WorkerChoiceStrategies.LEAST_USED,
        workerChoiceStrategyOptions: {
          runTime: { median: true },
          weights: { 0: 300, 1: 200 },
        },
      }
    )
    expect(pool.emitter).toBeUndefined()
    expect(pool.opts).toStrictEqual({
      enableEvents: false,
      enableTasksQueue: true,
      errorHandler: testHandler,
      exitHandler: testHandler,
      messageHandler: testHandler,
      onlineHandler: testHandler,
      restartWorkerOnError: false,
      startWorkers: true,
      tasksQueueOptions: {
        agingFactor: 0.001,
        concurrency: 2,
        loadExponent: 0.6666666666666666,
        size: numberOfWorkers ** 2,
        tasksFinishedTimeout: 2000,
        tasksStealingOnBackPressure: true,
        tasksStealingRatio: 0.6,
        taskStealing: true,
      },
      workerChoiceStrategy: WorkerChoiceStrategies.LEAST_USED,
      workerChoiceStrategyOptions: {
        runTime: { median: true },
        weights: { 0: 300, 1: 200 },
      },
    })
    for (const [, workerChoiceStrategy] of pool.workerChoiceStrategiesContext
      .workerChoiceStrategies) {
      expect(workerChoiceStrategy.opts).toStrictEqual({
        elu: { median: false },
        runTime: { median: true },
        waitTime: { median: false },
        weights: { 0: 300, 1: 200 },
      })
    }
    await pool.destroy()
  })
})
