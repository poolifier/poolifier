import {
  createHook,
  describe,
  expect,
  FixedThreadPool,
  getEventListeners,
  it,
  nativeQueueMicrotask,
  numberOfWorkers,
  PoolEvents,
  PoolTypes,
  ready,
  version,
  vi,
  WorkerChoiceStrategies,
  WorkerTypes,
} from './abstract-pool-test-support.mjs'

describe('Abstract pool test suite', () => {
  it("Verify that pool event emitter 'backPressure' and 'backPressureEnd' events can register a callback", async () => {
    const pool = new FixedThreadPool(
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.mjs',
      {
        enableTasksQueue: true,
      }
    )
    await ready(pool)
    expect(pool.emitter.eventNames()).toStrictEqual([])
    const promises = new Set()
    let poolBackPressure = 0
    let poolBackPressureInfo
    pool.emitter.on(PoolEvents.backPressure, info => {
      ++poolBackPressure
      poolBackPressureInfo = info
    })
    let poolBackPressureEnd = 0
    let poolBackPressureEndInfo
    pool.emitter.on(PoolEvents.backPressureEnd, info => {
      ++poolBackPressureEnd
      poolBackPressureEndInfo = info
    })
    expect(pool.emitter.eventNames()).toStrictEqual([
      PoolEvents.backPressure,
      PoolEvents.backPressureEnd,
    ])
    for (let i = 0; i < numberOfWorkers * 10; i++) {
      promises.add(pool.execute())
    }
    await Promise.all(promises)
    expect(poolBackPressure).toBe(1)
    expect(poolBackPressureInfo).toStrictEqual({
      backPressure: true,
      backPressureWorkerNodes: numberOfWorkers,
      busyWorkerNodes: expect.any(Number),
      defaultStrategy: WorkerChoiceStrategies.LEAST_USED,
      executedTasks: expect.any(Number),
      executingTasks: expect.any(Number),
      failedTasks: expect.any(Number),
      idleWorkerNodes: expect.any(Number),
      maxQueuedTasks: expect.any(Number),
      maxSize: numberOfWorkers,
      minSize: numberOfWorkers,
      queuedTasks: expect.any(Number),
      ready: true,
      started: true,
      stealingWorkerNodes: expect.any(Number),
      stolenTasks: expect.any(Number),
      strategyRetries: expect.any(Number),
      type: PoolTypes.fixed,
      version,
      worker: WorkerTypes.thread,
      workerNodes: numberOfWorkers,
    })
    expect(poolBackPressureEnd).toBe(1)
    expect(poolBackPressureEndInfo).toStrictEqual({
      backPressure: false,
      backPressureWorkerNodes: expect.any(Number),
      busyWorkerNodes: expect.any(Number),
      defaultStrategy: WorkerChoiceStrategies.LEAST_USED,
      executedTasks: expect.any(Number),
      executingTasks: expect.any(Number),
      failedTasks: expect.any(Number),
      idleWorkerNodes: expect.any(Number),
      maxQueuedTasks: expect.any(Number),
      maxSize: numberOfWorkers,
      minSize: numberOfWorkers,
      queuedTasks: expect.any(Number),
      ready: true,
      started: true,
      stealingWorkerNodes: expect.any(Number),
      stolenTasks: expect.any(Number),
      strategyRetries: expect.any(Number),
      type: PoolTypes.fixed,
      version,
      worker: WorkerTypes.thread,
      workerNodes: numberOfWorkers,
    })
    expect(poolBackPressureEndInfo.backPressureWorkerNodes).toBeLessThan(
      numberOfWorkers
    )
    await pool.destroy()
  })

  for (const eventSurface of ['worker node', 'pool']) {
    it(`Verify that queued submission commits before a ${eventSurface} back pressure listener failure is deferred`, async () => {
      const activeTaskAsyncIds = new Set()
      const hook = createHook({
        destroy (asyncId) {
          activeTaskAsyncIds.delete(asyncId)
        },
        init (asyncId, type) {
          if (type === 'poolifier:task') activeTaskAsyncIds.add(asyncId)
        },
      })
      const pool = new FixedThreadPool(
        1,
        './tests/worker-files/thread/testWorker.mjs',
        {
          enableTasksQueue: true,
          tasksQueueOptions: {
            concurrency: 1,
            size: 1,
            tasksStealingOnBackPressure: false,
            taskStealing: false,
          },
        }
      )
      await new Promise(resolve => pool.emitter.once(PoolEvents.ready, resolve))
      await pool.addTaskFunction('waitForRelease', data => {
        const view = new Int32Array(data)
        Atomics.wait(view, 0, 0)
        return Atomics.load(view, 0)
      })
      await pool.addTaskFunction('recordExecution', data => {
        const view = new Int32Array(data)
        Atomics.add(view, 0, 1)
        Atomics.notify(view, 0)
      })
      const releaseBuffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT)
      const executionBuffer = new SharedArrayBuffer(
        Int32Array.BYTES_PER_ELEMENT
      )
      const release = new Int32Array(releaseBuffer)
      const executions = new Int32Array(executionBuffer)
      const abortController = new AbortController()
      const workerNode = pool.workerNodes[0]
      const snapshot = () => ({
        abortListeners: getEventListeners(abortController.signal, 'abort')
          .length,
        activeTaskAsyncResources: activeTaskAsyncIds.size,
        backPressure: pool.info.backPressure,
        backPressureWorkerNodes: pool.info.backPressureWorkerNodes,
        executingTasks: pool.info.executingTasks,
        maxQueuedTasks: pool.info.maxQueuedTasks,
        queuedTasks: pool.info.queuedTasks,
        recordExecutingTasks:
          workerNode.getTaskFunctionWorkerUsage('recordExecution').tasks
            .executing,
        strategyRetries: pool.info.strategyRetries,
        waitExecutingTasks:
          workerNode.getTaskFunctionWorkerUsage('waitForRelease').tasks
            .executing,
        workerBackPressure: workerNode.info.backPressure,
      })

      hook.enable()
      const blockingTask = pool.execute(releaseBuffer, 'waitForRelease')
      const beforeSubmission = snapshot()
      const thrownValue = Object.freeze({ eventSurface })
      const deferredValues = []
      vi.spyOn(globalThis, 'queueMicrotask').mockImplementation(callback => {
        nativeQueueMicrotask(() => {
          try {
            callback()
          } catch (error) {
            deferredValues.push(error)
          }
        })
      })
      const throwingListener = () => {
        throw thrownValue
      }
      if (eventSurface === 'worker node') {
        workerNode.once('backPressure', throwingListener)
      } else {
        pool.emitter.once(PoolEvents.backPressure, throwingListener)
      }

      const submissionResultPromise = Promise.allSettled([
        pool.execute(
          executionBuffer,
          'recordExecution',
          abortController.signal
        ),
      ])
      await new Promise(resolve => setImmediate(resolve))
      const afterSubmission = snapshot()
      Atomics.store(release, 0, 1)
      Atomics.notify(release, 0)
      await blockingTask
      const submissionResult = await submissionResultPromise
      if (Atomics.load(executions, 0) === 0) {
        await Atomics.waitAsync(executions, 0, 0, 500).value
      }
      await new Promise(resolve => setImmediate(resolve))
      const beforeDestroy = snapshot()
      await pool.destroy()
      await new Promise(resolve => setImmediate(resolve))
      const afterDestroy = {
        abortListeners: getEventListeners(abortController.signal, 'abort')
          .length,
        activeTaskAsyncResources: activeTaskAsyncIds.size,
        workerNodes: pool.workerNodes.length,
      }
      hook.disable()

      expect(submissionResult).toStrictEqual([
        { status: 'fulfilled', value: undefined },
      ])
      expect(afterSubmission.queuedTasks).toBeGreaterThan(
        beforeSubmission.queuedTasks
      )
      expect(deferredValues).toStrictEqual([thrownValue])
      expect(Atomics.load(executions, 0)).toBe(1)
      expect(beforeDestroy).toStrictEqual({
        ...beforeSubmission,
        activeTaskAsyncResources: 0,
        executingTasks: 0,
        maxQueuedTasks: afterSubmission.maxQueuedTasks,
        waitExecutingTasks: 0,
      })
      expect(afterDestroy).toStrictEqual({
        abortListeners: 0,
        activeTaskAsyncResources: 0,
        workerNodes: 0,
      })
      await new Promise(resolve => setImmediate(resolve))
      expect(deferredValues).toStrictEqual([thrownValue])
      vi.restoreAllMocks()
    })
  }
})
