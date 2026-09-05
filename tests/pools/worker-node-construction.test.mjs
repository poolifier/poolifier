import { describe, expect, it } from 'vitest'

import { WorkerTypes } from '../../lib/index.mjs'
import { WorkerNode } from '../../lib/pools/worker-node.mjs'

describe('Worker node construction validation', () => {
  it('Worker node instantiation', () => {
    expect(() => new WorkerNode()).toThrow(
      new TypeError('Cannot construct a worker node without a worker type')
    )
    expect(
      () =>
        new WorkerNode(
          'invalidWorkerType',
          './tests/worker-files/thread/testWorker.mjs'
        )
    ).toThrow(
      new TypeError(
        "Cannot construct a worker node with an invalid worker type 'invalidWorkerType'"
      )
    )
    expect(
      () =>
        new WorkerNode(
          WorkerTypes.thread,
          './tests/worker-files/thread/testWorker.mjs'
        )
    ).toThrow(
      new TypeError(
        'Cannot construct a worker node without worker node options'
      )
    )
    expect(
      () =>
        new WorkerNode(
          WorkerTypes.thread,
          './tests/worker-files/thread/testWorker.mjs',
          ''
        )
    ).toThrow(
      new TypeError(
        'Cannot construct a worker node with invalid worker node options: must be a plain object'
      )
    )
    expect(
      () =>
        new WorkerNode(
          WorkerTypes.thread,
          './tests/worker-files/thread/testWorker.mjs',
          {}
        )
    ).toThrow(
      new TypeError(
        'Cannot construct a worker node without a tasks queue back pressure size option'
      )
    )
    expect(
      () =>
        new WorkerNode(
          WorkerTypes.thread,
          './tests/worker-files/thread/testWorker.mjs',
          { tasksQueueBackPressureSize: 'invalidTasksQueueBackPressureSize' }
        )
    ).toThrow(
      new TypeError(
        'Cannot construct a worker node with a tasks queue back pressure size option that is not an integer'
      )
    )
    expect(
      () =>
        new WorkerNode(
          WorkerTypes.thread,
          './tests/worker-files/thread/testWorker.mjs',
          { tasksQueueBackPressureSize: 0.2 }
        )
    ).toThrow(
      new TypeError(
        'Cannot construct a worker node with a tasks queue back pressure size option that is not an integer'
      )
    )
    expect(
      () =>
        new WorkerNode(
          WorkerTypes.thread,
          './tests/worker-files/thread/testWorker.mjs',
          { tasksQueueBackPressureSize: 0 }
        )
    ).toThrow(
      new RangeError(
        'Cannot construct a worker node with a tasks queue back pressure size option that is not a positive integer'
      )
    )
    expect(
      () =>
        new WorkerNode(
          WorkerTypes.thread,
          './tests/worker-files/thread/testWorker.mjs',
          { tasksQueueBackPressureSize: -1 }
        )
    ).toThrow(
      new RangeError(
        'Cannot construct a worker node with a tasks queue back pressure size option that is not a positive integer'
      )
    )
    expect(
      () =>
        new WorkerNode(
          WorkerTypes.thread,
          './tests/worker-files/thread/testWorker.mjs',
          {
            tasksQueueBackPressureSize: 12,
          }
        )
    ).toThrow(
      new TypeError(
        'Cannot construct a worker node without a tasks queue bucket size option'
      )
    )
    expect(
      () =>
        new WorkerNode(
          WorkerTypes.thread,
          './tests/worker-files/thread/testWorker.mjs',
          {
            tasksQueueBackPressureSize: 12,
            tasksQueueBucketSize: 'invalidTasksQueueBucketSize',
          }
        )
    ).toThrow(
      new TypeError(
        'Cannot construct a worker node with a tasks queue bucket size option that is not an integer'
      )
    )
    expect(
      () =>
        new WorkerNode(
          WorkerTypes.thread,
          './tests/worker-files/thread/testWorker.mjs',
          { tasksQueueBackPressureSize: 12, tasksQueueBucketSize: 0.2 }
        )
    ).toThrow(
      new TypeError(
        'Cannot construct a worker node with a tasks queue bucket size option that is not an integer'
      )
    )
    expect(
      () =>
        new WorkerNode(
          WorkerTypes.thread,
          './tests/worker-files/thread/testWorker.mjs',
          { tasksQueueBackPressureSize: 12, tasksQueueBucketSize: 0 }
        )
    ).toThrow(
      new RangeError(
        'Cannot construct a worker node with a tasks queue bucket size option that is not a positive integer'
      )
    )
    expect(
      () =>
        new WorkerNode(
          WorkerTypes.thread,
          './tests/worker-files/thread/testWorker.mjs',
          { tasksQueueBackPressureSize: 12, tasksQueueBucketSize: -1 }
        )
    ).toThrow(
      new RangeError(
        'Cannot construct a worker node with a tasks queue bucket size option that is not a positive integer'
      )
    )
    expect(
      () =>
        new WorkerNode(
          WorkerTypes.thread,
          './tests/worker-files/thread/testWorker.mjs',
          {
            tasksQueueBackPressureSize: 12,
            tasksQueueBucketSize: 6,
          }
        )
    ).toThrow(
      new TypeError(
        'Cannot construct a worker node without a tasks queue priority option'
      )
    )
    expect(
      () =>
        new WorkerNode(
          WorkerTypes.thread,
          './tests/worker-files/thread/testWorker.mjs',
          {
            tasksQueueBackPressureSize: 12,
            tasksQueueBucketSize: 6,
            tasksQueuePriority: 'invalidTasksQueuePriority',
          }
        )
    ).toThrow(
      new TypeError(
        'Cannot construct a worker node with a tasks queue priority option that is not a boolean'
      )
    )
  })
})
