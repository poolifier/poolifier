import { once } from 'node:events'
import { describe, expect, it } from 'vitest'

import {
  FixedThreadPool,
  PoolEvents,
  WorkerTerminationError,
} from '../../lib/index.mjs'
import {
  checkValidTasksQueueOptions,
  DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS,
  getDefaultTasksQueueOptions,
} from '../../lib/pools/utils.mjs'

const asyncWorkerFilePath = './tests/worker-files/thread/asyncWorker.mjs'
const testWorkerFilePath = './tests/worker-files/thread/testWorker.mjs'

const createInactivePool = tasksQueueOptions =>
  new FixedThreadPool(1, testWorkerFilePath, {
    enableTasksQueue: true,
    startWorkers: false,
    tasksQueueOptions,
  })

const validTasksFinishedTimeouts = [
  { label: 'zero', value: 0 },
  { label: 'one millisecond', value: 1 },
  { label: 'the default', value: 2000 },
  { label: 'the Node.js timer maximum', value: 2_147_483_647 },
]

const invalidTasksFinishedTimeouts = [
  {
    error: new TypeError(
      'Invalid worker node tasks finished timeout: must be an integer'
    ),
    label: 'null',
    value: null,
  },
  {
    error: new TypeError(
      'Invalid worker node tasks finished timeout: must be an integer'
    ),
    label: 'a fraction',
    value: 0.5,
  },
  {
    error: new TypeError(
      'Invalid worker node tasks finished timeout: must be an integer'
    ),
    label: 'NaN',
    value: Number.NaN,
  },
  {
    error: new TypeError(
      'Invalid worker node tasks finished timeout: must be an integer'
    ),
    label: 'positive infinity',
    value: Number.POSITIVE_INFINITY,
  },
  {
    error: new TypeError(
      'Invalid worker node tasks finished timeout: must be an integer'
    ),
    label: 'negative infinity',
    value: Number.NEGATIVE_INFINITY,
  },
  {
    error: new TypeError(
      'Invalid worker node tasks finished timeout: must be an integer'
    ),
    label: 'a positive unsafe integer',
    value: Number.MAX_SAFE_INTEGER + 1,
  },
  {
    error: new TypeError(
      'Invalid worker node tasks finished timeout: must be an integer'
    ),
    label: 'a negative unsafe integer',
    value: Number.MIN_SAFE_INTEGER - 1,
  },
  {
    error: new TypeError(
      'Invalid worker node tasks finished timeout: must be an integer'
    ),
    label: 'a string',
    value: '2000',
  },
  {
    error: new TypeError(
      'Invalid worker node tasks finished timeout: must be an integer'
    ),
    label: 'a boolean',
    value: true,
  },
  {
    error: new TypeError(
      'Invalid worker node tasks finished timeout: must be an integer'
    ),
    label: 'an object',
    value: {},
  },
  {
    error: new RangeError(
      'Invalid worker node tasks finished timeout: -1 is a negative integer'
    ),
    label: 'a negative safe integer',
    value: -1,
  },
  {
    error: new RangeError(
      `Invalid worker node tasks finished timeout: ${Number.MIN_SAFE_INTEGER.toString()} is a negative integer`
    ),
    label: 'the minimum safe integer',
    value: Number.MIN_SAFE_INTEGER,
  },
  {
    error: new RangeError(
      'Invalid worker node tasks finished timeout: 2147483648 is greater than 2147483647'
    ),
    label: 'one above the Node.js timer maximum',
    value: 2_147_483_648,
  },
  {
    error: new RangeError(
      `Invalid worker node tasks finished timeout: ${Number.MAX_SAFE_INTEGER.toString()} is greater than 2147483647`
    ),
    label: 'the maximum safe integer',
    value: Number.MAX_SAFE_INTEGER,
  },
]

describe('Pool tasks queue options test suite', () => {
  it('Verify DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS values', () => {
    expect(DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS).toStrictEqual({
      aggregate: false,
      average: false,
      median: false,
    })
  })

  it('Verify getDefaultTasksQueueOptions() behavior', () => {
    const poolMaxSize = 4
    expect(getDefaultTasksQueueOptions(poolMaxSize)).toStrictEqual({
      agingFactor: 0.001,
      concurrency: 1,
      loadExponent: 0.6666666666666666,
      size: poolMaxSize ** 2,
      tasksFinishedTimeout: 2000,
      tasksStealingOnBackPressure: true,
      tasksStealingRatio: 0.6,
      taskStealing: true,
    })
  })

  describe.each(validTasksFinishedTimeouts)(
    'tasksFinishedTimeout $label',
    ({ value }) => {
      it('accepts the value through the direct utility', () => {
        // Given
        const tasksQueueOptions = { tasksFinishedTimeout: value }

        // When / Then
        expect(() =>
          checkValidTasksQueueOptions(tasksQueueOptions)
        ).not.toThrow()
      })

      it('accepts the value through the pool constructor', () => {
        // Given
        const tasksQueueOptions = { tasksFinishedTimeout: value }

        // When / Then
        expect(() => createInactivePool(tasksQueueOptions)).not.toThrow()
      })

      it('accepts the value through the runtime setter', () => {
        // Given
        const pool = createInactivePool()

        // When / Then
        expect(() =>
          pool.setTasksQueueOptions({ tasksFinishedTimeout: value })
        ).not.toThrow()
      })
    }
  )

  describe.each(invalidTasksFinishedTimeouts)(
    'invalid tasksFinishedTimeout: $label',
    ({ error, value }) => {
      it('rejects the value through the direct utility', () => {
        // Given
        const tasksQueueOptions = { tasksFinishedTimeout: value }

        // When / Then
        expect(() => checkValidTasksQueueOptions(tasksQueueOptions)).toThrow(
          error
        )
      })

      it('rejects the value through the pool constructor', () => {
        // Given
        const tasksQueueOptions = { tasksFinishedTimeout: value }

        // When / Then
        expect(() => createInactivePool(tasksQueueOptions)).toThrow(error)
      })

      it('rejects the value through the runtime setter without mutation', () => {
        // Given
        const pool = createInactivePool()
        const tasksQueueOptions = { ...pool.opts.tasksQueueOptions }

        // When
        expect(() =>
          pool.setTasksQueueOptions({ tasksFinishedTimeout: value })
        ).toThrow(error)

        // Then
        expect(pool.opts.tasksQueueOptions).toStrictEqual(tasksQueueOptions)
      })
    }
  )

  it('destroys immediately when tasksFinishedTimeout is zero', async () => {
    // Given
    const pool = new FixedThreadPool(1, asyncWorkerFilePath, {
      enableTasksQueue: true,
      tasksQueueOptions: { tasksFinishedTimeout: 0 },
    })
    if (pool.info.ready !== true) {
      await once(pool.emitter, PoolEvents.ready)
    }
    const taskPromise = pool.execute().catch(error => error)
    expect(pool.info.executingTasks).toBe(1)

    // When
    const startTime = performance.now()
    await pool.destroy()
    const elapsedTime = performance.now() - startTime

    // Then
    expect(elapsedTime).toBeLessThan(1500)
    expect(await taskPromise).toBeInstanceOf(WorkerTerminationError)
  })
})
