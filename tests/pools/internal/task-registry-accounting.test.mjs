import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { afterEach, describe, expect, it } from 'vitest'

import { FixedThreadPool, PoolEvents } from '../../../lib/index.mjs'
import { createPoolCleanup } from '../crash-recovery-utils.mjs'

const hangWorkerPath = './tests/worker-files/thread/hangWorker.mjs'
const testWorkerPath = './tests/worker-files/thread/testWorker.mjs'

const leaseFor = (pool, workerNode) => {
  const lease = pool.workerLifecycleCoordinator.handle(workerNode)?.lease
  if (lease == null) throw new Error('Coordinator lease was not issued')
  return lease
}

describe('Task accounting regression test suite', () => {
  const { cleanupPools, trackPool } = createPoolCleanup()
  afterEach(cleanupPools)

  const createPendingTask = async (numberOfThreads = 3) => {
    const pool = trackPool(
      new FixedThreadPool(numberOfThreads, hangWorkerPath, {
        enableTasksQueue: false,
        errorHandler: () => undefined,
      })
    )
    if (pool.info.ready !== true) {
      await new Promise(resolve => pool.emitter.once(PoolEvents.ready, resolve))
    }
    const taskId = randomUUID()
    const response = Promise.withResolvers()
    const originalWorkerNodeKey = 0
    const selectedLease = leaseFor(pool, pool.workerNodes[0])
    pool.taskRegistry.register({
      onAbort: () => undefined,
      reject: response.reject,
      resolve: response.resolve,
      selectedLease,
      task: { name: 'default', taskId },
    })
    const outcome = response.promise
    return { originalWorkerNodeKey, outcome, pool, taskId }
  }

  const moveExecutingTask = (sourceWorkerNode, destinationWorkerNode) => {
    sourceWorkerNode.usage.tasks.executing = 0
    destinationWorkerNode.usage.tasks.executing = 1
  }

  it('clears current execution counters after normal queued settlement', async () => {
    // Given
    const pool = trackPool(
      new FixedThreadPool(6, testWorkerPath, {
        enableTasksQueue: true,
        tasksQueueOptions: { concurrency: 2 },
      })
    )
    if (!pool.info.ready) {
      await new Promise(resolve => {
        pool.emitter.once(PoolEvents.ready, resolve)
        if (pool.info.ready) resolve()
      })
    }

    // When
    await Promise.all(Array.from({ length: 18 }, () => pool.execute()))

    // Then
    expect(
      pool.workerNodes.reduce(
        (executed, node) => executed + node.usage.tasks.executed,
        0
      )
    ).toBe(18)
    expect(pool.workerNodes.map(node => node.usage.tasks.executing)).toEqual(
      Array.from({ length: 6 }, () => 0)
    )
    expect(pool.info.executingTasks).toBe(0)
  })

  it('clears the current executor after one steal', async () => {
    // Given
    const { originalWorkerNodeKey, outcome, pool, taskId } =
      await createPendingTask()
    const destinationWorkerNodeKey = (originalWorkerNodeKey + 1) % 3
    const originalWorkerNode = pool.workerNodes[originalWorkerNodeKey]
    const destinationWorkerNode = pool.workerNodes[destinationWorkerNodeKey]
    const selectedLease = leaseFor(pool, originalWorkerNode)
    const destinationLease = leaseFor(pool, destinationWorkerNode)
    pool.taskRegistry.transition(
      taskId,
      ['registered'],
      'queued',
      selectedLease
    )
    pool.taskRegistry.transition(taskId, ['queued'], 'detached')
    pool.taskRegistry.transition(
      taskId,
      ['detached'],
      'assigned',
      destinationLease
    )
    pool.taskRegistry.transition(
      taskId,
      ['assigned'],
      'dispatching',
      destinationLease
    )
    pool.taskRegistry.transition(
      taskId,
      ['dispatching'],
      'running',
      destinationLease
    )
    moveExecutingTask(originalWorkerNode, destinationWorkerNode)

    // When
    pool.handleTaskExecutionResponse(destinationLease, {
      data: { ok: true },
      taskId,
      workerId: destinationWorkerNode.info.id,
    })
    await outcome

    // Then
    expect(originalWorkerNode.usage.tasks.executed).toBe(1)
    expect(destinationWorkerNode.usage.tasks.executing).toBe(0)
    expect(pool.info.executingTasks).toBe(0)
    expect(pool.taskRegistry.size).toBe(0)
  })

  it('clears the final executor after multiple steals and ignores re-entry', async () => {
    // Given
    const { originalWorkerNodeKey, outcome, pool, taskId } =
      await createPendingTask()
    const intermediateWorkerNodeKey = (originalWorkerNodeKey + 1) % 3
    const destinationWorkerNodeKey = (originalWorkerNodeKey + 2) % 3
    const originalWorkerNode = pool.workerNodes[originalWorkerNodeKey]
    const destinationWorkerNode = pool.workerNodes[destinationWorkerNodeKey]
    const selectedLease = leaseFor(pool, originalWorkerNode)
    const intermediateLease = leaseFor(
      pool,
      pool.workerNodes[intermediateWorkerNodeKey]
    )
    const destinationLease = leaseFor(pool, destinationWorkerNode)
    pool.taskRegistry.transition(
      taskId,
      ['registered'],
      'queued',
      selectedLease
    )
    pool.taskRegistry.transition(taskId, ['queued'], 'detached')
    pool.taskRegistry.transition(
      taskId,
      ['detached'],
      'queued',
      intermediateLease
    )
    pool.taskRegistry.transition(taskId, ['queued'], 'detached')
    pool.taskRegistry.transition(
      taskId,
      ['detached'],
      'assigned',
      destinationLease
    )
    pool.taskRegistry.transition(
      taskId,
      ['assigned'],
      'dispatching',
      destinationLease
    )
    pool.taskRegistry.transition(
      taskId,
      ['dispatching'],
      'running',
      destinationLease
    )
    moveExecutingTask(originalWorkerNode, destinationWorkerNode)
    const response = {
      data: { ok: true },
      taskId,
      workerId: destinationWorkerNode.info.id,
    }

    // When
    pool.handleTaskExecutionResponse(destinationLease, response)
    await outcome
    pool.handleTaskExecutionResponse(destinationLease, response)

    // Then
    expect(originalWorkerNode.usage.tasks.executed).toBe(1)
    expect(destinationWorkerNode.usage.tasks.executing).toBe(0)
    expect(pool.info.executedTasks).toBe(1)
    expect(pool.info.executingTasks).toBe(0)
    expect(pool.taskRegistry.size).toBe(0)
  })

  it('falls back to the current executor when the original owner is removed', async () => {
    // Given
    const { originalWorkerNodeKey, outcome, pool, taskId } =
      await createPendingTask(2)
    const destinationWorkerNodeKey = originalWorkerNodeKey === 0 ? 1 : 0
    const originalWorkerNode = pool.workerNodes[originalWorkerNodeKey]
    const destinationWorkerNode = pool.workerNodes[destinationWorkerNodeKey]
    const selectedLease = leaseFor(pool, originalWorkerNode)
    const destinationLease = leaseFor(pool, destinationWorkerNode)
    pool.taskRegistry.transition(
      taskId,
      ['registered'],
      'queued',
      selectedLease
    )
    pool.taskRegistry.transition(taskId, ['queued'], 'detached')
    pool.taskRegistry.transition(
      taskId,
      ['detached'],
      'assigned',
      destinationLease
    )
    pool.taskRegistry.transition(
      taskId,
      ['assigned'],
      'dispatching',
      destinationLease
    )
    pool.taskRegistry.transition(
      taskId,
      ['dispatching'],
      'running',
      destinationLease
    )
    moveExecutingTask(originalWorkerNode, destinationWorkerNode)
    pool.workerNodes.splice(originalWorkerNodeKey, 1)

    // When
    pool.handleTaskExecutionResponse(destinationLease, {
      data: { ok: true },
      taskId,
      workerId: destinationWorkerNode.info.id,
    })
    await outcome

    // Then
    expect(destinationWorkerNode.usage.tasks.executed).toBe(1)
    expect(destinationWorkerNode.usage.tasks.executing).toBe(0)
    expect(pool.info.executedTasks).toBe(1)
    expect(pool.info.executingTasks).toBe(0)
    expect(pool.taskRegistry.size).toBe(0)
    await originalWorkerNode.terminate()
  })

  it('does not emit private accounting state in package declarations', async () => {
    // Given / When
    const declarations = await readFile('lib/index.d.ts', 'utf8')

    // Then
    expect(declarations).not.toContain('InternalPromiseResponseWrapper')
    expect(declarations).not.toContain('workerUsageId')
    expect(declarations).not.toContain('taskAccounting')
  })
})
