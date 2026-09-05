import { describe, expect, it } from 'vitest'

import { FixedThreadPool } from '../../lib/index.mjs'

const workerPath = './tests/worker-files/thread/testWorker.mjs'

describe('Pool options contract', () => {
  it('leaves nested caller options unchanged when validation fails', () => {
    const tasksQueueOptions = Object.freeze({
      concurrency: 2,
      tasksFinishedTimeout: -1,
    })
    const options = {
      enableTasksQueue: true,
      tasksQueueOptions,
      workerChoiceStrategyOptions: { measurement: 'runTime' },
    }
    const snapshot = structuredClone(options)

    expect(() => new FixedThreadPool(1, workerPath, options)).toThrow(
      RangeError
    )
    expect(options).toStrictEqual(snapshot)
    expect(options.tasksQueueOptions).toBe(tasksQueueOptions)
  })
})
