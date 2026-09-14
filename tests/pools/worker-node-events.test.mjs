import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { WorkerTypes } from '../../lib/index.mjs'
import { WorkerNode } from '../../lib/pools/worker-node.mjs'

describe('Worker node event registration', () => {
  let threadWorkerNode

  beforeAll(() => {
    threadWorkerNode = new WorkerNode(
      WorkerTypes.thread,
      './tests/worker-files/thread/testWorker.mjs',
      {
        tasksQueueBackPressureSize: 12,
        tasksQueueBucketSize: 6,
        tasksQueuePriority: true,
      }
    )
  })

  afterAll(async () => {
    if (process.env.CI != null) return
    await threadWorkerNode.terminate()
  })

  it('Worker node prependOnceWorkerEventHandler() preserves event semantics', () => {
    const order = []
    const args = ['payload', 7]
    let callbackThisMatches = false
    threadWorkerNode.worker.on('task4-prepend-once', function (...received) {
      order.push({ kind: 'regular', received })
    })
    threadWorkerNode.prependOnceWorkerEventHandler(
      'task4-prepend-once',
      function (...received) {
        callbackThisMatches = this === threadWorkerNode.worker
        order.push({ kind: 'prepended', received })
      }
    )

    threadWorkerNode.worker.emit('task4-prepend-once', ...args)
    threadWorkerNode.worker.emit('task4-prepend-once', ...args)

    expect(callbackThisMatches).toBe(true)
    expect(order).toStrictEqual([
      { kind: 'prepended', received: args },
      { kind: 'regular', received: args },
      { kind: 'regular', received: args },
    ])
    threadWorkerNode.worker.removeAllListeners('task4-prepend-once')
  })
})
