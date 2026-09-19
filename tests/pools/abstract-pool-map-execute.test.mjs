import {
  describe,
  DynamicThreadPool,
  expect,
  it,
  numberOfWorkers,
} from './abstract-pool-test-support.mjs'

describe('Abstract pool test suite', () => {
  it('Verify that mapExecute() is working', async () => {
    const pool = new DynamicThreadPool(
      Math.floor(numberOfWorkers / 2),
      numberOfWorkers,
      './tests/worker-files/thread/testMultipleTaskFunctionsWorker.mjs'
    )
    await expect(pool.mapExecute()).rejects.toThrow(
      new TypeError('data argument must be a defined iterable')
    )
    await expect(pool.mapExecute(0)).rejects.toThrow(
      new TypeError('data argument must be an iterable')
    )
    await expect(pool.mapExecute([undefined], 0)).rejects.toThrow(
      new TypeError('name argument must be a string')
    )
    await expect(pool.mapExecute([undefined], '')).rejects.toThrow(
      new TypeError('name argument must not be an empty string')
    )
    await expect(pool.mapExecute([undefined], undefined, 0)).rejects.toThrow(
      new TypeError('abortSignals argument must be an iterable')
    )
    await expect(
      pool.mapExecute([undefined], undefined, [undefined])
    ).rejects.toThrow(
      new TypeError('abortSignals argument must be an iterable of AbortSignal')
    )
    await expect(
      pool.mapExecute([undefined], undefined, [
        new AbortController().signal,
        new AbortController().signal,
      ])
    ).rejects.toThrow(
      new Error('data and abortSignals arguments must have the same length')
    )
    await expect(
      pool.mapExecute(
        [undefined],
        undefined,
        [new AbortController().signal],
        {}
      )
    ).rejects.toThrow(new TypeError('transferList argument must be an array'))
    await expect(pool.mapExecute([undefined], 'unknown')).rejects.toThrow(
      new Error("Task function 'unknown' not found")
    )
    let results = await pool.mapExecute(
      Array(4).fill({}),
      'jsonIntegerSerialization',
      Array(4).fill(AbortSignal.timeout(1000))
    )
    expect(results).toStrictEqual([{ ok: 1 }, { ok: 1 }, { ok: 1 }, { ok: 1 }])
    expect(pool.info.executingTasks).toBe(0)
    expect(pool.info.executedTasks).toBe(4)
    results = await pool.mapExecute(
      [{ n: 10 }, { n: 20 }, { n: 30 }, { n: 40 }],
      'factorial',
      Array(4).fill(AbortSignal.timeout(1000))
    )
    expect(results).toStrictEqual([
      3628800, 2432902008176640000, 2.6525285981219103e32, 8.159152832478977e47,
    ])
    expect(pool.info.executingTasks).toBe(0)
    expect(pool.info.executedTasks).toBe(8)
    results = await pool.mapExecute(
      new Set([{ n: 10 }, { n: 20 }, { n: 30 }, { n: 40 }]),
      'factorial',
      new Set([
        AbortSignal.timeout(1000),
        AbortSignal.timeout(1500),
        AbortSignal.timeout(2000),
        AbortSignal.timeout(2500),
      ])
    )
    expect(results).toStrictEqual([
      3628800, 2432902008176640000, 2.6525285981219103e32, 8.159152832478977e47,
    ])
    expect(pool.info.executingTasks).toBe(0)
    expect(pool.info.executedTasks).toBe(12)
    await pool.destroy()
    await expect(pool.mapExecute()).rejects.toThrow(
      new Error('Cannot execute task(s) on not started pool')
    )
  })
})
