import { Worker as ClusterWorker } from 'node:cluster'
import { MessageChannel, Worker as ThreadWorker } from 'node:worker_threads'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { CircularBuffer } from '../../lib/circular-buffer.mjs'
import { WorkerTypes } from '../../lib/index.mjs'
import { WorkerNode } from '../../lib/pools/worker-node.mjs'
import { MeasurementHistorySize } from '../../lib/pools/worker.mjs'
import { PriorityQueue } from '../../lib/queues/priority-queue.mjs'

describe('Worker node initial state', () => {
  let clusterWorkerNode, threadWorkerNode

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
    clusterWorkerNode = new WorkerNode(
      WorkerTypes.cluster,
      './tests/worker-files/cluster/testWorker.cjs',
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
    await clusterWorkerNode.terminate()
  })

  it('exposes initialized thread and cluster state', () => {
    expect(threadWorkerNode).toBeInstanceOf(WorkerNode)
    expect(threadWorkerNode.worker).toBeInstanceOf(ThreadWorker)
    expect(threadWorkerNode.info).toStrictEqual({
      backPressure: false,
      backPressureStealing: false,
      continuousStealing: false,
      crashHandled: false,
      dynamic: false,
      id: threadWorkerNode.worker.threadId,
      queuedTaskAbortion: false,
      ready: false,
      stealing: false,
      stolen: false,
      terminating: false,
      type: WorkerTypes.thread,
    })
    expect(threadWorkerNode.usage).toStrictEqual({
      elu: {
        active: {
          history: expect.any(CircularBuffer),
        },
        idle: {
          history: expect.any(CircularBuffer),
        },
      },
      runTime: {
        history: expect.any(CircularBuffer),
      },
      tasks: {
        executed: 0,
        executing: 0,
        failed: 0,
        maxQueued: 0,
        queued: 0,
        sequentiallyStolen: 0,
        stolen: 0,
      },
      waitTime: {
        history: expect.any(CircularBuffer),
      },
    })
    expect(threadWorkerNode.usage.runTime.history.items.length).toBe(
      MeasurementHistorySize
    )
    expect(threadWorkerNode.usage.waitTime.history.items.length).toBe(
      MeasurementHistorySize
    )
    expect(threadWorkerNode.usage.elu.idle.history.items.length).toBe(
      MeasurementHistorySize
    )
    expect(threadWorkerNode.usage.elu.active.history.items.length).toBe(
      MeasurementHistorySize
    )
    expect(threadWorkerNode.messageChannel).toBeInstanceOf(MessageChannel)
    expect(threadWorkerNode.tasksQueueBackPressureSize).toBe(12)
    expect(threadWorkerNode.tasksQueue).toBeInstanceOf(PriorityQueue)
    expect(threadWorkerNode.tasksQueue.size).toBe(0)
    expect(threadWorkerNode.tasksQueue.bucketSize).toBe(6)
    expect(threadWorkerNode.tasksQueue.enablePriority).toBe(true)
    expect(threadWorkerNode.tasksQueueSize()).toBe(
      threadWorkerNode.tasksQueue.size
    )
    expect(clusterWorkerNode).toBeInstanceOf(WorkerNode)
    expect(clusterWorkerNode.worker).toBeInstanceOf(ClusterWorker)
    expect(clusterWorkerNode.info).toStrictEqual({
      backPressure: false,
      backPressureStealing: false,
      continuousStealing: false,
      crashHandled: false,
      dynamic: false,
      id: clusterWorkerNode.worker.id,
      queuedTaskAbortion: false,
      ready: false,
      stealing: false,
      stolen: false,
      terminating: false,
      type: WorkerTypes.cluster,
    })
    expect(clusterWorkerNode.usage).toStrictEqual({
      elu: {
        active: {
          history: expect.any(CircularBuffer),
        },
        idle: {
          history: expect.any(CircularBuffer),
        },
      },
      runTime: {
        history: expect.any(CircularBuffer),
      },
      tasks: {
        executed: 0,
        executing: 0,
        failed: 0,
        maxQueued: 0,
        queued: 0,
        sequentiallyStolen: 0,
        stolen: 0,
      },
      waitTime: {
        history: expect.any(CircularBuffer),
      },
    })
    expect(clusterWorkerNode.usage.runTime.history.items.length).toBe(
      MeasurementHistorySize
    )
    expect(clusterWorkerNode.usage.waitTime.history.items.length).toBe(
      MeasurementHistorySize
    )
    expect(clusterWorkerNode.usage.elu.idle.history.items.length).toBe(
      MeasurementHistorySize
    )
    expect(clusterWorkerNode.usage.elu.active.history.items.length).toBe(
      MeasurementHistorySize
    )
    expect(clusterWorkerNode.messageChannel).toBeUndefined()
    expect(clusterWorkerNode.tasksQueueBackPressureSize).toBe(12)
    expect(clusterWorkerNode.tasksQueue).toBeInstanceOf(PriorityQueue)
    expect(clusterWorkerNode.tasksQueue.size).toBe(0)
    expect(clusterWorkerNode.tasksQueue.bucketSize).toBe(6)
    expect(clusterWorkerNode.tasksQueue.enablePriority).toBe(true)
    expect(clusterWorkerNode.tasksQueueSize()).toBe(
      clusterWorkerNode.tasksQueue.size
    )
  })
})
