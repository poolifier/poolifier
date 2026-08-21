import { afterEach, describe, expect, it } from 'vitest'

import { PoolEvents, WorkerCrashError } from '../../lib/index.mjs'
import { verifyBusyStateAfterCrash } from './crash-recovery-event-support.mjs'
import { createCrashRecoveryTestContext } from './crash-recovery-test-support.mjs'
import { createCrashRecoveryThreadTransport } from './crash-recovery-transport-thread-support.mjs'

const matrixIterations = Number(
  process.env.POOLIFIER_CRASH_RECOVERY_ITERATIONS ?? 10
)

describe('thread-only observable crash matrix', {
  retry: 0,
  timeout: 240_000,
}, () => {
  const { trackPool } = createCrashRecoveryTestContext()
  const { closeInboxes, once, start } =
    createCrashRecoveryThreadTransport(trackPool)

  afterEach(closeInboxes)

  it('error plus exit rejects once and restores resources', async () => {
    const { pool } = await start()
    const errors = []
    pool.emitter.on(PoolEvents.error, error => errors.push(error))
    const replacement = once(pool, PoolEvents.ready)
    const outcome = Promise.allSettled([pool.execute({ action: 'error-exit' })])
    const [result] = await outcome
    await replacement

    expect(result.reason).toBeInstanceOf(WorkerCrashError)
    expect(errors).toHaveLength(1)
    expect(pool.info).toMatchObject({ executingTasks: 0, ready: true })
  })

  it('ends and rearms busy state after a fully busy worker crashes', async () => {
    await verifyBusyStateAfterCrash(start)
  })

  it('reply before exit resolves without a crash event', async () => {
    const { pool } = await start()
    const errors = []
    pool.emitter.on(PoolEvents.error, error => errors.push(error))
    const replacement = once(pool, PoolEvents.ready)
    const reply = pool.execute({ action: 'reply-exit' })
    await expect(reply).resolves.toStrictEqual({ replied: true })
    await replacement
    await expect(pool.execute({ action: 'echo' })).resolves.toMatchObject({
      action: 'echo',
    })

    expect(errors).toStrictEqual([])
  })

  it('repeats reply-before-exit and crash-before-response without timing waits', async () => {
    const { inbox, pool } = await start()

    for (let iteration = 0; iteration < matrixIterations; iteration++) {
      const replyReplacement = once(pool, PoolEvents.ready)
      await expect(
        pool.execute({ action: 'reply-exit' })
      ).resolves.toStrictEqual({ replied: true })
      await replyReplacement

      const token = `crash-${iteration}`
      const crashReplacement = once(pool, PoolEvents.ready)
      const crash = pool.execute({ action: 'wait-crash', token })
      const dispatch = await inbox.take(message => message.token === token)
      inbox.post({ action: 'crash-task', target: dispatch.id })
      await expect(crash).rejects.toBeInstanceOf(WorkerCrashError)
      await crashReplacement
    }

    expect(pool.info).toMatchObject({ executingTasks: 0, ready: true })
  })

  it('ignores a delayed operation reply after its timeout', async () => {
    const { inbox, pool } = await start()
    const operation = pool
      .addTaskFunction('matrixTimeout', data => data)
      .catch(error => error)
    const request = await inbox.take(
      message => message.name === 'matrixTimeout'
    )

    expect((await operation).message).toContain('failed')
    inbox.post({
      action: 'ack',
      operationId: request.operationId,
      target: request.id,
    })

    expect(pool.hasTaskFunction('matrixTimeout')).toBe(false)
  })

  it('rejects a stale generation response after replacement', async () => {
    const { inbox, pool } = await start()
    const operation = pool.addTaskFunction('matrixStale', data => data)
    const stale = await inbox.take(message => message.name === 'matrixStale')
    inbox.post({
      action: 'ack',
      operationId: stale.operationId,
      target: stale.id,
    })
    await expect(operation).resolves.toBe(true)
    inbox.post({ action: 'crash-task', target: stale.id })
    const replay = await inbox.take(
      message => message.name === 'matrixStale' && message.id !== stale.id
    )

    inbox.post({
      action: 'ack',
      operationId: stale.operationId,
      target: replay.id,
    })
    expect(pool.info.ready).toBe(false)
    const replacement = once(pool, PoolEvents.ready)
    inbox.post({
      action: 'ack',
      operationId: replay.operationId,
      target: replay.id,
    })
    await replacement
    await expect(
      pool.execute({ value: 1 }, 'matrixStale')
    ).resolves.toStrictEqual({ value: 1 })
  })

  it('fault with running and queued work rejects running and replays queued', async () => {
    const { inbox, pool } = await start({
      enableTasksQueue: true,
      tasksQueueOptions: { concurrency: 1 },
    })
    const running = pool.execute({ action: 'wait-crash', token: 'running' })
    const dispatch = await inbox.take(message => message.token === 'running')
    const queued = pool.execute({ action: 'echo', token: 'queued' })
    await Promise.resolve()
    expect(pool.info.queuedTasks).toBe(1)
    inbox.post({ action: 'crash-task', target: dispatch.id })

    await expect(running).rejects.toBeInstanceOf(WorkerCrashError)
    await expect(queued).resolves.toMatchObject({ token: 'queued' })
    expect(pool.info).toMatchObject({ executingTasks: 0, queuedTasks: 0 })
  })

  it('replays a committed operation when its ACK is followed by a crash', async () => {
    const { inbox, pool } = await start()
    const operation = pool.addTaskFunction('matrixAckCrash', data => data)
    const request = await inbox.take(
      message => message.name === 'matrixAckCrash'
    )
    inbox.post({
      action: 'ack',
      operationId: request.operationId,
      target: request.id,
    })
    await operation
    inbox.post({ action: 'crash-task', target: request.id })
    const replay = await inbox.take(
      message => message.name === 'matrixAckCrash' && message.id !== request.id
    )
    const replacement = once(pool, PoolEvents.ready)
    inbox.post({
      action: 'ack',
      operationId: replay.operationId,
      target: replay.id,
    })
    await replacement

    await expect(
      pool.execute({ replayed: true }, 'matrixAckCrash')
    ).resolves.toStrictEqual({ replayed: true })
  })

  it('single-worker NACK rolls back immediately', async () => {
    const { inbox, pool } = await start()
    const existing = pool.addTaskFunction('matrixExisting', data => data)
    const existingRequest = await inbox.take(
      message => message.name === 'matrixExisting'
    )
    inbox.post({
      action: 'ack',
      operationId: existingRequest.operationId,
      target: existingRequest.id,
    })
    await existing
    const operation = pool.addTaskFunction('matrixCompensate', data => data)
    const forward = await inbox.take(
      message => message.name === 'matrixCompensate'
    )
    inbox.post({
      action: 'nack',
      operationId: forward.operationId,
      target: forward.id,
    })
    await expect(operation).rejects.toThrow('failed')

    expect(pool.hasTaskFunction('matrixExisting')).toBe(true)
    expect(pool.hasTaskFunction('matrixCompensate')).toBe(false)
  })

  it('restores the concrete static default after a two-worker partial NACK', async () => {
    const { inbox, pool } = await start({
      size: 2,
    })
    const operation = pool
      .setDefaultTaskFunction('matrixTarget')
      .catch(error => error)
    const forward = await Promise.all([
      inbox.take(message => message.name === 'matrixTarget'),
      inbox.take(message => message.name === 'matrixTarget'),
    ])
    const operationId = forward[0].operationId
    inbox.post({ action: 'ack', operationId, target: forward[0].id })
    inbox.post({ action: 'nack', operationId, target: forward[1].id })

    await expect(operation).resolves.toMatchObject({
      name: 'TaskFunctionTransactionError',
    })
    expect(pool.listTaskFunctionsProperties()[1]?.name).toBe('execute')
  })

  it('does not dispatch before replacement catalog replay completes', async () => {
    const { inbox, pool } = await start()
    const add = pool.addTaskFunction('matrixReplayGate', data => data)
    const added = await inbox.take(
      message => message.name === 'matrixReplayGate'
    )
    inbox.post({
      action: 'ack-crash',
      operationId: added.operationId,
      target: added.id,
    })
    await add
    const replay = await inbox.take(
      message => message.name === 'matrixReplayGate' && message.id !== added.id
    )
    const execution = pool.execute({ gated: true }, 'matrixReplayGate')
    const race = await Promise.race([
      inbox
        .take(message => message.event === 'dispatch')
        .then(() => 'dispatched'),
      Promise.resolve('blocked'),
    ])
    expect(race).toBe('blocked')

    inbox.post({
      action: 'ack',
      operationId: replay.operationId,
      target: replay.id,
    })
    await expect(execution).resolves.toStrictEqual({ gated: true })
  })
})
