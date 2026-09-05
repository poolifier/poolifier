import { afterEach, describe, expect, it } from 'vitest'

import { PoolEvents, WorkerCrashError } from '../../lib/index.mjs'
import { createCrashRecoveryTestContext } from './crash-recovery-test-support.mjs'
import { createCrashRecoveryThreadTransport } from './crash-recovery-transport-thread-support.mjs'

describe('Thread crash cause isolation', { retry: 0, timeout: 240_000 }, () => {
  const { trackPool } = createCrashRecoveryTestContext()
  const { closeInboxes, once, start } =
    createCrashRecoveryThreadTransport(trackPool)

  afterEach(closeInboxes)

  it('isolates a raw crash cause from two concurrently active task rejections', async () => {
    const { inbox, pool } = await start({
      enableTasksQueue: true,
      tasksQueueOptions: { concurrency: 2 },
    })
    const sentinel = 'concurrency-two crash raw sentinel'
    const firstToken = 'cause-isolation-first'
    const secondToken = 'cause-isolation-second'
    const firstTask = pool.execute({ action: 'wait-crash', token: firstToken })
    const secondTask = pool.execute({
      action: 'wait-crash',
      token: secondToken,
    })
    const outcome = Promise.allSettled([firstTask, secondTask])
    const [firstDispatch, secondDispatch] = await Promise.all([
      inbox.take(message => message.token === firstToken),
      inbox.take(message => message.token === secondToken),
    ])

    expect(firstDispatch).not.toBe(secondDispatch)
    expect(firstDispatch.token).toBe(firstToken)
    expect(secondDispatch.token).toBe(secondToken)
    expect(firstDispatch.id).toBe(secondDispatch.id)
    expect(pool.info).toMatchObject({
      executingTasks: 2,
      queuedTasks: 0,
      workerNodes: 1,
    })

    const poolErrors = []
    pool.emitter.on(PoolEvents.error, error => poolErrors.push(error))
    const poolErrorObserved = once(pool, PoolEvents.error)
    const replacement = once(pool, PoolEvents.ready)
    inbox.post({
      action: 'crash-task-error',
      message: sentinel,
      target: firstDispatch.id,
    })

    const [results, poolError] = await Promise.all([outcome, poolErrorObserved])
    await replacement

    expect(results.map(result => result.status)).toStrictEqual([
      'rejected',
      'rejected',
    ])
    const [firstError, secondError] = results.map(result => result.reason)
    expect(firstError).toBeInstanceOf(WorkerCrashError)
    expect(secondError).toBeInstanceOf(WorkerCrashError)
    expect(firstError).not.toBe(secondError)
    expect(firstError.taskId).toBeDefined()
    expect(secondError.taskId).toBeDefined()
    expect(firstError.taskId).not.toBe(secondError.taskId)
    expect(
      [firstError, secondError].map(taskError =>
        Object.hasOwn(taskError, 'cause')
      )
    ).toStrictEqual([false, false])
    for (const taskError of [firstError, secondError]) {
      expect(taskError.message).toBe('Worker node crashed')
      expect(taskError.message).not.toContain(sentinel)
      expect(taskError.stack).not.toContain(sentinel)
      expect(taskError.workerId).toBe(firstDispatch.id)
      expect([null, poolError.exitCode]).toContain(taskError.exitCode)
      expect([null, poolError.signal]).toContain(taskError.signal)
    }

    expect(poolErrors).toHaveLength(1)
    expect(poolError).toBeInstanceOf(WorkerCrashError)
    expect(poolError).not.toBe(firstError)
    expect(poolError).not.toBe(secondError)
    expect(poolError.taskId).toBeUndefined()
    expect(poolError.workerId).toBe(firstDispatch.id)
    expect(poolError.exitCode).toBe(1)
    expect(poolError.signal).toBeNull()
    expect(poolError.cause).toBeInstanceOf(Error)
    expect(poolError.cause.message).toBe(sentinel)
    expect(poolError.message).toBe(`Worker node crashed: ${sentinel}`)
    expect(pool.info).toMatchObject({
      executingTasks: 0,
      queuedTasks: 0,
      ready: true,
      workerNodes: 1,
    })
  })
})
