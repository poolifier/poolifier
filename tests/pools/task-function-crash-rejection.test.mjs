import { describe, expect, it } from 'vitest'

import {
  FixedThreadPool,
  PoolEvents,
  WorkerCrashError,
} from '../../lib/index.mjs'
import { TaskFunctionTransactionError } from '../../lib/pools/task-function-transaction-types.mjs'
import { createCrashRecoveryTestContext } from './crash-recovery-test-support.mjs'

const workerFile =
  './tests/worker-files/thread/testMultipleTaskFunctionsWorker.mjs'
describe('Task function operation crash rejection', () => {
  const { trackPool } = createCrashRecoveryTestContext()

  const startBlockedPool = async () => {
    const pool = trackPool(
      new FixedThreadPool(2, workerFile, {
        errorHandler: () => undefined,
      })
    )
    await new Promise(resolve => pool.emitter.once(PoolEvents.ready, resolve))
    const workerNode = pool.workerNodes[0]
    const executionReactions = [
      pool.execute({ n: 48 }, 'fibonacci').catch(error => error),
      pool.execute({ n: 48 }, 'fibonacci').catch(error => error),
    ]
    return { executionReactions, pool, workerNode }
  }

  const expectCrashRejection = async (operation, workerNode) => {
    const operationReaction = operation.catch(error => error)
    const terminated = new Promise(resolve =>
      workerNode.once('terminated', resolve)
    )
    await workerNode.worker.terminate()
    const rejected = await operationReaction
    expect(rejected).toBeInstanceOf(TaskFunctionTransactionError)
    const crash = rejected.failures.find(
      failure => failure.cause instanceof WorkerCrashError
    )?.cause
    expect(crash).toBeInstanceOf(WorkerCrashError)
    expect(crash.workerId).toBe(workerNode.info.id)
    expect(crash.taskId).toBeUndefined()
    await terminated
    expect(workerNode.worker.listenerCount('message')).toBe(0)
  }

  it('rejects addTaskFunction for the crashed worker generation', async () => {
    const { executionReactions, pool, workerNode } = await startBlockedPool()

    await expectCrashRejection(
      pool.addTaskFunction('identity', data => data),
      workerNode
    )
    await Promise.allSettled(executionReactions)
  })

  it('rejects removeTaskFunction for the crashed worker generation', async () => {
    const pool = trackPool(
      new FixedThreadPool(2, workerFile, {
        errorHandler: () => undefined,
      })
    )
    await new Promise(resolve => pool.emitter.once(PoolEvents.ready, resolve))
    await pool.addTaskFunction('identity', data => data)
    const workerNode = pool.workerNodes[0]
    const executionReactions = [
      pool.execute({ n: 48 }, 'fibonacci').catch(error => error),
      pool.execute({ n: 48 }, 'fibonacci').catch(error => error),
    ]

    await expectCrashRejection(pool.removeTaskFunction('identity'), workerNode)
    await Promise.allSettled(executionReactions)
  })

  it('rejects setDefaultTaskFunction for the crashed worker generation', async () => {
    const { executionReactions, pool, workerNode } = await startBlockedPool()

    await expectCrashRejection(
      pool.setDefaultTaskFunction('factorial'),
      workerNode
    )
    await Promise.allSettled(executionReactions)
  })

  it('sanitizes a pending management failure while preserving the raw pool error', async () => {
    const { executionReactions, pool, workerNode } = await startBlockedPool()
    const workerId = workerNode.info.id
    const rawCause = new Error('management crash raw sentinel')
    const poolErrorObserved = new Promise(resolve => {
      pool.emitter.once(PoolEvents.error, resolve)
    })
    const terminated = new Promise(resolve => {
      workerNode.once('terminated', resolve)
    })
    const operationReaction = pool
      .addTaskFunction('pendingIdentity', data => data)
      .catch(error => error)
    const operationState = await Promise.race([
      operationReaction.then(() => 'settled'),
      Promise.resolve('pending'),
    ])
    expect(operationState).toBe('pending')

    workerNode.worker.emit('error', rawCause)
    const termination = workerNode.worker.terminate()
    const [rejected, poolError] = await Promise.all([
      operationReaction,
      poolErrorObserved,
    ])
    await Promise.all([termination, terminated])

    expect(rejected).toBeInstanceOf(TaskFunctionTransactionError)
    const crash = rejected.failures.find(
      failure => failure.cause instanceof WorkerCrashError
    )?.cause
    expect(crash).toBeInstanceOf(WorkerCrashError)
    expect(crash.message).toBe('Worker node crashed')
    expect(Object.hasOwn(crash, 'cause')).toBe(false)
    expect(crash.message).not.toContain('management crash raw sentinel')
    expect(crash.stack).not.toContain('management crash raw sentinel')
    expect(crash.taskId).toBeUndefined()
    expect(crash.workerId).toBe(workerId)
    expect(crash.exitCode).toBeNull()
    expect(crash.signal).toBeNull()

    expect(poolError).toBeInstanceOf(WorkerCrashError)
    expect(poolError).not.toBe(crash)
    expect(poolError.cause).toBe(rawCause)
    expect(poolError.message).toBe(
      'Worker node crashed: management crash raw sentinel'
    )
    expect(poolError.taskId).toBeUndefined()
    expect(poolError.workerId).toBe(workerId)
    expect(poolError.exitCode).toBe(1)
    expect(poolError.signal).toBeNull()
    await Promise.allSettled(executionReactions)
  })
})
