import {
  createHook,
  describe,
  executionAsyncId,
  expect,
  FixedThreadPool,
  it,
  numberOfWorkers,
  PoolEvents,
} from './abstract-pool-test-support.mjs'

describe('Abstract pool test suite', () => {
  it('Verify that pool asynchronous resource track tasks execution', async () => {
    let taskAsyncId
    let initCalls = 0
    let beforeCalls = 0
    let afterCalls = 0
    let resolveCalls = 0
    const hook = createHook({
      after (asyncId) {
        if (asyncId === taskAsyncId) afterCalls++
      },
      before (asyncId) {
        if (asyncId === taskAsyncId) beforeCalls++
      },
      init (asyncId, type) {
        if (type === 'poolifier:task') {
          initCalls++
          taskAsyncId = asyncId
        }
      },
      promiseResolve () {
        if (executionAsyncId() === taskAsyncId) resolveCalls++
      },
    })
    const pool = new FixedThreadPool(
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.mjs'
    )
    hook.enable()
    await pool.execute()
    hook.disable()
    expect(initCalls).toBe(1)
    expect(beforeCalls).toBe(1)
    expect(afterCalls).toBe(1)
    expect(resolveCalls).toBe(1)
    await pool.destroy()
  })

  it('keeps the pool event async resource alive across restart cycles', async () => {
    let poolAsyncId
    const destroyedAsyncIds = new Set()
    const executionsAfterDestroy = []
    const hook = createHook({
      before (asyncId) {
        if (destroyedAsyncIds.has(asyncId)) executionsAfterDestroy.push(asyncId)
      },
      destroy (asyncId) {
        destroyedAsyncIds.add(asyncId)
      },
      init (asyncId, type) {
        if (type === 'poolifier:pool') poolAsyncId = asyncId
      },
    })
    hook.enable()
    const pool = new FixedThreadPool(
      1,
      './tests/worker-files/thread/testWorker.mjs',
      { startWorkers: false }
    )
    const emitter = pool.emitter
    let destroyEvents = 0
    emitter.on(PoolEvents.destroy, () => ++destroyEvents)

    for (let cycle = 0; cycle < 2; cycle++) {
      pool.start()
      await new Promise(resolve => emitter.once(PoolEvents.ready, resolve))
      await pool.destroy()
      expect(pool.emitter).toBe(emitter)
      expect(emitter.listenerCount(PoolEvents.destroy)).toBe(1)
    }
    hook.disable()

    expect(poolAsyncId).toBeTypeOf('number')
    expect(destroyedAsyncIds.has(poolAsyncId)).toBe(false)
    expect(executionsAfterDestroy).toStrictEqual([])
    expect(destroyEvents).toBe(2)
  })
})
