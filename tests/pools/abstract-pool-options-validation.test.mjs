import { checkValidWorkerRestartPolicyOptions } from '../../lib/pools/utils.mjs'
import {
  describe,
  expect,
  FixedThreadPool,
  it,
  numberOfWorkers,
} from './abstract-pool-test-support.mjs'

describe('Abstract pool test suite', () => {
  it('Verify that pool options are validated', () => {
    expect(
      () =>
        new FixedThreadPool(
          numberOfWorkers,
          './tests/worker-files/thread/testWorker.mjs',
          {
            workerChoiceStrategy: 'invalidStrategy',
          }
        )
    ).toThrow(new Error("Invalid worker choice strategy 'invalidStrategy'"))
    expect(
      () =>
        new FixedThreadPool(
          numberOfWorkers,
          './tests/worker-files/thread/testWorker.mjs',
          {
            workerChoiceStrategyOptions: { weights: {} },
          }
        )
    ).toThrow(
      new Error(
        'Invalid worker choice strategy options: must have a weight for each worker node'
      )
    )
    expect(
      () =>
        new FixedThreadPool(
          numberOfWorkers,
          './tests/worker-files/thread/testWorker.mjs',
          {
            workerChoiceStrategyOptions: { measurement: 'invalidMeasurement' },
          }
        )
    ).toThrow(
      new Error(
        "Invalid worker choice strategy options: invalid measurement 'invalidMeasurement'"
      )
    )
    expect(
      () =>
        new FixedThreadPool(
          numberOfWorkers,
          './tests/worker-files/thread/testWorker.mjs',
          {
            enableTasksQueue: true,
            tasksQueueOptions: 'invalidTasksQueueOptions',
          }
        )
    ).toThrow(
      new TypeError('Invalid tasks queue options: must be a plain object')
    )
    expect(
      () =>
        new FixedThreadPool(
          numberOfWorkers,
          './tests/worker-files/thread/testWorker.mjs',
          {
            enableTasksQueue: true,
            tasksQueueOptions: { concurrency: 0 },
          }
        )
    ).toThrow(
      new RangeError(
        'Invalid worker node tasks concurrency: 0 is a negative integer or zero'
      )
    )
    expect(
      () =>
        new FixedThreadPool(
          numberOfWorkers,
          './tests/worker-files/thread/testWorker.mjs',
          {
            enableTasksQueue: true,
            tasksQueueOptions: { concurrency: -1 },
          }
        )
    ).toThrow(
      new RangeError(
        'Invalid worker node tasks concurrency: -1 is a negative integer or zero'
      )
    )
    expect(
      () =>
        new FixedThreadPool(
          numberOfWorkers,
          './tests/worker-files/thread/testWorker.mjs',
          {
            enableTasksQueue: true,
            tasksQueueOptions: { concurrency: 0.2 },
          }
        )
    ).toThrow(
      new TypeError('Invalid worker node tasks concurrency: must be an integer')
    )
    expect(
      () =>
        new FixedThreadPool(
          numberOfWorkers,
          './tests/worker-files/thread/testWorker.mjs',
          {
            enableTasksQueue: true,
            tasksQueueOptions: { size: 0 },
          }
        )
    ).toThrow(
      new RangeError(
        'Invalid worker node tasks queue size: 0 is a negative integer or zero'
      )
    )
    expect(
      () =>
        new FixedThreadPool(
          numberOfWorkers,
          './tests/worker-files/thread/testWorker.mjs',
          {
            enableTasksQueue: true,
            tasksQueueOptions: { size: -1 },
          }
        )
    ).toThrow(
      new RangeError(
        'Invalid worker node tasks queue size: -1 is a negative integer or zero'
      )
    )
    expect(
      () =>
        new FixedThreadPool(
          numberOfWorkers,
          './tests/worker-files/thread/testWorker.mjs',
          {
            enableTasksQueue: true,
            tasksQueueOptions: { size: 0.2 },
          }
        )
    ).toThrow(
      new TypeError('Invalid worker node tasks queue size: must be an integer')
    )
    expect(
      () =>
        new FixedThreadPool(
          numberOfWorkers,
          './tests/worker-files/thread/testWorker.mjs',
          {
            enableTasksQueue: true,
            tasksQueueOptions: { tasksStealingRatio: '' },
          }
        )
    ).toThrow(
      new TypeError(
        'Invalid worker node tasks stealing ratio: must be a number'
      )
    )
    expect(
      () =>
        new FixedThreadPool(
          numberOfWorkers,
          './tests/worker-files/thread/testWorker.mjs',
          {
            enableTasksQueue: true,
            tasksQueueOptions: { tasksStealingRatio: 1.1 },
          }
        )
    ).toThrow(
      new RangeError(
        'Invalid worker node tasks stealing ratio: must be between 0 and 1'
      )
    )
    expect(
      () =>
        new FixedThreadPool(
          numberOfWorkers,
          './tests/worker-files/thread/testWorker.mjs',
          {
            enableTasksQueue: true,
            tasksQueueOptions: { agingFactor: '' },
          }
        )
    ).toThrow(
      new TypeError(
        'Invalid worker node tasks queue aging factor: must be a number'
      )
    )
    expect(
      () =>
        new FixedThreadPool(
          numberOfWorkers,
          './tests/worker-files/thread/testWorker.mjs',
          {
            enableTasksQueue: true,
            tasksQueueOptions: { agingFactor: -1 },
          }
        )
    ).toThrow(
      new RangeError(
        'Invalid worker node tasks queue aging factor: must be greater than or equal to 0'
      )
    )
    expect(
      () =>
        new FixedThreadPool(
          numberOfWorkers,
          './tests/worker-files/thread/testWorker.mjs',
          {
            enableTasksQueue: true,
            tasksQueueOptions: { loadExponent: '' },
          }
        )
    ).toThrow(
      new TypeError(
        'Invalid worker node tasks queue load exponent: must be a number'
      )
    )
    expect(
      () =>
        new FixedThreadPool(
          numberOfWorkers,
          './tests/worker-files/thread/testWorker.mjs',
          {
            enableTasksQueue: true,
            tasksQueueOptions: { loadExponent: 0 },
          }
        )
    ).toThrow(
      new RangeError(
        'Invalid worker node tasks queue load exponent: must be greater than 0'
      )
    )
    expect(
      () =>
        new FixedThreadPool(
          numberOfWorkers,
          './tests/worker-files/thread/testWorker.mjs',
          {
            enableTasksQueue: true,
            tasksQueueOptions: { loadExponent: -1 },
          }
        )
    ).toThrow(
      new RangeError(
        'Invalid worker node tasks queue load exponent: must be greater than 0'
      )
    )
  })

  it('Verify that worker restart policy options are validated', () => {
    expect(
      () =>
        new FixedThreadPool(
          numberOfWorkers,
          './tests/worker-files/thread/testWorker.mjs',
          {
            restartPolicy: 'invalidRestartPolicy',
          }
        )
    ).toThrow(
      new TypeError(
        'Invalid worker restart policy options: must be a plain object'
      )
    )
    expect(
      () =>
        new FixedThreadPool(
          numberOfWorkers,
          './tests/worker-files/thread/testWorker.mjs',
          {
            restartPolicy: { maxRestarts: 0.2 },
          }
        )
    ).toThrow(
      new TypeError(
        'Invalid worker restart policy max restarts: must be an integer or Infinity'
      )
    )
    expect(
      () =>
        new FixedThreadPool(
          numberOfWorkers,
          './tests/worker-files/thread/testWorker.mjs',
          {
            restartPolicy: { maxRestarts: 0 },
          }
        )
    ).toThrow(
      new RangeError(
        'Invalid worker restart policy max restarts: 0 is less than 1'
      )
    )
    expect(
      () =>
        new FixedThreadPool(
          numberOfWorkers,
          './tests/worker-files/thread/testWorker.mjs',
          {
            restartPolicy: { maxRestarts: 1001 },
          }
        )
    ).toThrow(
      new RangeError(
        'Invalid worker restart policy max restarts: 1001 is greater than 1000'
      )
    )
    expect(
      () =>
        new FixedThreadPool(
          numberOfWorkers,
          './tests/worker-files/thread/testWorker.mjs',
          {
            restartPolicy: { windowTime: 0.2 },
          }
        )
    ).toThrow(
      new TypeError(
        'Invalid worker restart policy window time: must be an integer'
      )
    )
    expect(
      () =>
        new FixedThreadPool(
          numberOfWorkers,
          './tests/worker-files/thread/testWorker.mjs',
          {
            restartPolicy: { windowTime: 999 },
          }
        )
    ).toThrow(
      new RangeError(
        'Invalid worker restart policy window time: 999 is less than 1000'
      )
    )
    expect(
      () =>
        new FixedThreadPool(
          numberOfWorkers,
          './tests/worker-files/thread/testWorker.mjs',
          {
            restartPolicy: { windowTime: 2_147_483_648 },
          }
        )
    ).toThrow(
      new RangeError(
        'Invalid worker restart policy window time: 2147483648 is greater than 2147483647'
      )
    )
  })

  it('Verify that valid worker restart policy boundaries are accepted', () => {
    expect(() =>
      checkValidWorkerRestartPolicyOptions({ maxRestarts: 1 })
    ).not.toThrow()
    expect(() =>
      checkValidWorkerRestartPolicyOptions({ maxRestarts: 1000 })
    ).not.toThrow()
    expect(() =>
      checkValidWorkerRestartPolicyOptions({
        maxRestarts: Number.POSITIVE_INFINITY,
      })
    ).not.toThrow()
    expect(() =>
      checkValidWorkerRestartPolicyOptions({ windowTime: 1000 })
    ).not.toThrow()
    expect(() =>
      checkValidWorkerRestartPolicyOptions({ windowTime: 2_147_483_647 })
    ).not.toThrow()
  })

  it('Verify that non-finite worker restart policy options are rejected', () => {
    expect(() =>
      checkValidWorkerRestartPolicyOptions({
        windowTime: Number.POSITIVE_INFINITY,
      })
    ).toThrow(
      new TypeError(
        'Invalid worker restart policy window time: must be an integer'
      )
    )
    expect(() =>
      checkValidWorkerRestartPolicyOptions({ maxRestarts: Number.NaN })
    ).toThrow(
      new TypeError(
        'Invalid worker restart policy max restarts: must be an integer or Infinity'
      )
    )
  })
})
