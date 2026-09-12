import { randomUUID } from 'node:crypto'
import dgram from 'node:dgram'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  FixedClusterPool,
  PoolEvents,
  WorkerCrashError,
  WorkerTerminationError,
} from '../../lib/index.mjs'
import { TaskFunctionTransactionError } from '../../lib/pools/task-function-transaction-types.mjs'
import { verifyBusyStateAfterCrash } from './crash-recovery-event-support.mjs'
import { createCrashRecoveryTestContext } from './crash-recovery-test-support.mjs'

const workerFile = './tests/worker-files/cluster/crashRecoveryMatrixWorker.cjs'
const sockets = []
const matrixIterations = Number(
  process.env.POOLIFIER_CRASH_RECOVERY_ITERATIONS ?? 10
)
const transactionTimeout = 5_000

class CrashRecoveryClusterPool extends FixedClusterPool {
  taskFunctionTransactionTimeout = transactionTimeout
}

const createInbox = async () => {
  const socket = dgram.createSocket('udp4')
  sockets.push(socket)
  const buffered = []
  const waiters = []
  const endpoints = new Map()
  socket.on('message', (buffer, endpoint) => {
    const message = JSON.parse(buffer.toString())
    endpoints.set(message.id, endpoint)
    const index = waiters.findIndex(waiter => waiter.predicate(message))
    if (index === -1) buffered.push(message)
    else waiters.splice(index, 1)[0].resolve(message)
  })
  await new Promise(resolve => socket.bind(0, '127.0.0.1', resolve))
  return {
    address: socket.address(),
    post: message => {
      const endpoint = endpoints.get(message.target)
      socket.send(JSON.stringify(message), endpoint.port, endpoint.address)
    },
    take: predicate => {
      const index = buffered.findIndex(predicate)
      if (index !== -1) return Promise.resolve(buffered.splice(index, 1)[0])
      const { promise, resolve } = Promise.withResolvers()
      waiters.push({ predicate, resolve })
      return promise
    },
  }
}

const once = (pool, event) =>
  new Promise(resolve => pool.emitter.once(event, resolve))

describe('cluster-only observable crash matrix', {
  retry: 0,
  timeout: 240_000,
}, () => {
  const { trackPool } = createCrashRecoveryTestContext()

  afterEach(() => {
    vi.restoreAllMocks()
    for (const socket of sockets.splice(0)) socket.close()
  })

  const start = async (options = {}) => {
    const inbox = await createInbox()
    const { size = 1, ...poolOptions } = options
    const pool = trackPool(
      new CrashRecoveryClusterPool(size, workerFile, {
        env: {
          CRASH_RECOVERY_HOST: inbox.address.address,
          CRASH_RECOVERY_PORT: inbox.address.port.toString(),
          CRASH_RECOVERY_RUN: randomUUID(),
        },
        errorHandler: () => undefined,
        ...poolOptions,
      })
    )
    if (!pool.info.ready) await once(pool, PoolEvents.ready)
    return { inbox, pool }
  }

  it('error plus exit rejects once and restores resources', async () => {
    const { inbox, pool } = await start()
    const errors = []
    pool.emitter.on(PoolEvents.error, error => errors.push(error))
    const replacement = once(pool, PoolEvents.ready)
    const outcome = Promise.allSettled([pool.execute({ action: 'error-exit' })])
    await inbox.take(message => message.event === 'dispatch')
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
    await expect(pool.execute({ action: 'reply-exit' })).resolves.toStrictEqual(
      { replied: true }
    )
    await replacement
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
      action: 'ack-crash',
      operationId: stale.operationId,
      target: stale.id,
    })
    await expect(operation).resolves.toBe(true)
    const replay = await inbox.take(
      message => message.name === 'matrixStale' && message.id !== stale.id
    )
    inbox.post({
      action: 'ack',
      operationId: stale.operationId,
      target: replay.id,
    })
    expect(pool.info.ready).toBe(false)
    inbox.post({
      action: 'ack',
      operationId: replay.operationId,
      target: replay.id,
    })
    await once(pool, PoolEvents.ready)
    await expect(
      pool.execute({ value: 1 }, 'matrixStale')
    ).resolves.toStrictEqual({ value: 1 })
  })

  it('fault with running and queued work rejects running and replays queued', async () => {
    const { inbox, pool } = await start({
      enableTasksQueue: true,
      tasksQueueOptions: { concurrency: 1 },
    })
    const running = pool
      .execute({ action: 'wait-crash', token: 'running' })
      .catch(error => error)
    const dispatch = await inbox.take(message => message.token === 'running')
    const queued = pool.execute({ action: 'echo', token: 'queued' })
    await Promise.resolve()
    expect(pool.info.queuedTasks).toBe(1)
    inbox.post({ action: 'crash-task', target: dispatch.id })
    expect(await running).toBeInstanceOf(WorkerCrashError)
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
      action: 'ack-crash',
      operationId: request.operationId,
      target: request.id,
    })
    await operation
    const replay = await inbox.take(
      message => message.name === 'matrixAckCrash' && message.id !== request.id
    )
    inbox.post({
      action: 'ack',
      operationId: replay.operationId,
      target: replay.id,
    })
    await once(pool, PoolEvents.ready)
    await expect(
      pool.execute({ replayed: true }, 'matrixAckCrash')
    ).resolves.toStrictEqual({ replayed: true })
  })

  it('compensation timeout replaces the worker and replays the old revision', async () => {
    const ackResponse = Promise.withResolvers()
    const ackOperation = {}
    const { inbox, pool } = await start({
      messageHandler: message => {
        if (
          message.taskFunctionOperationId === ackOperation.id &&
          message.taskFunctionOperationStatus === true
        ) {
          ackResponse.resolve()
        }
      },
      size: 2,
    })
    const existing = pool.addTaskFunction('matrixExisting', data => data)
    const existingRequests = await Promise.all([
      inbox.take(message => message.name === 'matrixExisting'),
      inbox.take(message => message.name === 'matrixExisting'),
    ])
    for (const request of existingRequests) {
      inbox.post({
        action: 'ack',
        operationId: request.operationId,
        target: request.id,
      })
    }
    await existing
    const operation = pool
      .addTaskFunction('matrixCompensate', data => data)
      .catch(error => error)
    const forward = await Promise.all([
      inbox.take(message => message.name === 'matrixCompensate'),
      inbox.take(message => message.name === 'matrixCompensate'),
    ])
    ackOperation.id = forward[0].operationId
    inbox.post({
      action: 'ack',
      operationId: forward[0].operationId,
      target: forward[0].id,
    })
    await ackResponse.promise
    inbox.post({
      action: 'nack',
      operationId: forward[1].operationId,
      target: forward[1].id,
    })
    await inbox.take(
      message =>
        message.name === 'matrixCompensate' && message.operation === 'remove'
    )
    const replacement = once(pool, PoolEvents.ready)
    expect((await operation).message).toContain('failed')
    const replay = await inbox.take(
      message =>
        message.name === 'matrixExisting' &&
        !forward.some(request => request.id === message.id)
    )
    inbox.post({
      action: 'ack',
      operationId: replay.operationId,
      target: replay.id,
    })
    await replacement
    expect(pool.hasTaskFunction('matrixExisting')).toBe(true)
    expect(pool.hasTaskFunction('matrixCompensate')).toBe(false)
  })

  it('settles post-drain compensation when destroy closes broadcaster admission', async () => {
    const acknowledged = Promise.withResolvers()
    const acknowledgedOperation = {}
    const { inbox, pool } = await start({
      messageHandler: message => {
        if (
          message.taskFunctionOperationId === acknowledgedOperation.id &&
          message.taskFunctionOperationStatus === true
        ) {
          acknowledged.resolve()
        }
      },
      size: 2,
    })
    let mutationSettled = false
    const mutation = pool
      .addTaskFunction('matrixDestroyCompensate', data => data)
      .then(
        value => value,
        error => error
      )
      .finally(() => {
        mutationSettled = true
      })
    const execution = pool.execute({ deferred: 'compensation' }).then(
      value => value,
      error => error
    )
    const forward = await Promise.all([
      inbox.take(message => message.name === 'matrixDestroyCompensate'),
      inbox.take(message => message.name === 'matrixDestroyCompensate'),
    ])
    acknowledgedOperation.id = forward[0].operationId
    inbox.post({
      action: 'ack',
      operationId: forward[0].operationId,
      target: forward[0].id,
    })
    await acknowledged.promise

    await pool.destroy()
    const settledAtDestroy = mutationSettled
    const outcome = await mutation
    const executionOutcome = await execution
    const compensationFailure = outcome.failures.find(
      failure => failure.phase === 'compensation'
    )

    expect(settledAtDestroy).toBe(true)
    expect(outcome).toBeInstanceOf(TaskFunctionTransactionError)
    expect(compensationFailure.cause).toBeInstanceOf(WorkerTerminationError)
    expect(compensationFailure.cause.workerId).toBe(forward[0].id)
    expect(compensationFailure.lease.id).toBe(forward[0].id)
    expect(executionOutcome).toBeInstanceOf(WorkerTerminationError)
    expect(executionOutcome).toMatchObject({
      message: 'Worker node terminated by pool',
      name: 'WorkerTerminationError',
      taskId: undefined,
      workerId: undefined,
    })
    expect(pool.info.started).toBe(false)
    expect(pool.info.executingTasks).toBe(0)
  })

  it('rejects deferred execution before registration when destroy interrupts a mutation', async () => {
    const { inbox, pool } = await start()
    const register = vi.spyOn(pool.taskScheduler, 'register')
    const sendToWorker = vi.spyOn(pool, 'sendToWorker')
    const settlements = []
    const mutation = pool
      .addTaskFunction('matrixDeferredFailure', data => data)
      .then(
        value => {
          settlements.push('mutation')
          return value
        },
        error => {
          settlements.push('mutation')
          return error
        }
      )
    await inbox.take(message => message.name === 'matrixDeferredFailure')
    const execution = pool.execute({ deferred: 'failure' }).then(
      value => {
        settlements.push('execution')
        return value
      },
      error => {
        settlements.push('execution')
        return error
      }
    )
    const destruction = pool.destroy().finally(() => {
      settlements.push('destroy')
    })

    const [mutationOutcome, executionOutcome] = await Promise.all([
      mutation,
      execution,
      destruction,
    ])
    const taskSends = sendToWorker.mock.calls.filter(
      ([, message]) => message.taskId != null
    )

    expect(mutationOutcome).toBeInstanceOf(TaskFunctionTransactionError)
    expect(settlements).toStrictEqual(['mutation', 'execution', 'destroy'])
    expect(executionOutcome).toBeInstanceOf(WorkerTerminationError)
    expect(executionOutcome).toMatchObject({
      message: 'Worker node terminated by pool',
      name: 'WorkerTerminationError',
      taskId: undefined,
      workerId: undefined,
    })
    expect(register).not.toHaveBeenCalled()
    expect(taskSends).toStrictEqual([])
    expect(pool.taskRegistry.size).toBe(0)
    expect(pool.info.executedTasks).toBe(0)
    expect(pool.info.executingTasks).toBe(0)
    expect(pool.info.failedTasks).toBe(0)
  })

  it('preserves deferred execution abort reason when destroy interrupts a mutation', async () => {
    const { inbox, pool } = await start()
    const register = vi.spyOn(pool.taskScheduler, 'register')
    const sendToWorker = vi.spyOn(pool, 'sendToWorker')
    const controller = new AbortController()
    const abortReason = new Error('deferred execution aborted')
    const mutation = pool
      .addTaskFunction('matrixDeferredAbort', data => data)
      .then(
        value => value,
        error => error
      )
    await inbox.take(message => message.name === 'matrixDeferredAbort')
    const execution = pool
      .execute({ deferred: 'abort' }, undefined, controller.signal)
      .then(
        value => value,
        error => error
      )

    const destruction = pool.destroy()
    controller.abort(abortReason)
    const [mutationOutcome, executionOutcome] = await Promise.all([
      mutation,
      execution,
      destruction,
    ])
    const taskSends = sendToWorker.mock.calls.filter(
      ([, message]) => message.taskId != null
    )

    expect(mutationOutcome).toBeInstanceOf(TaskFunctionTransactionError)
    expect(executionOutcome).toBe(abortReason)
    expect(register).not.toHaveBeenCalled()
    expect(taskSends).toStrictEqual([])
    expect(pool.taskRegistry.size).toBe(0)
    expect(pool.info.executingTasks).toBe(0)
  })

  it('rejects deferred execution before dispatch when a successful mutation crosses destroy', async () => {
    const acknowledged = Promise.withResolvers()
    const acknowledgedOperation = {}
    const { inbox, pool } = await start({
      messageHandler: message => {
        if (
          message.taskFunctionOperationId === acknowledgedOperation.id &&
          message.taskFunctionOperationStatus === true
        ) {
          acknowledged.resolve()
        }
      },
    })
    const register = vi.spyOn(pool.taskScheduler, 'register')
    const sendToWorker = vi.spyOn(pool, 'sendToWorker')
    const stableAdmission =
      pool.taskFunctionTransactionManager.withStableCatalogAdmission.bind(
        pool.taskFunctionTransactionManager
      )
    let destruction
    vi.spyOn(
      pool.taskFunctionTransactionManager,
      'withStableCatalogAdmission'
    ).mockImplementation((admit, signal) =>
      stableAdmission(snapshot => {
        destruction = pool.destroy()
        return admit(snapshot)
      }, signal)
    )
    const mutation = pool.addTaskFunction('matrixDeferredSuccess', data => data)
    const request = await inbox.take(
      message => message.name === 'matrixDeferredSuccess'
    )
    acknowledgedOperation.id = request.operationId
    const execution = pool.execute({ deferred: 'success' }).then(
      value => value,
      error => error
    )

    inbox.post({
      action: 'ack',
      operationId: request.operationId,
      target: request.id,
    })
    await acknowledged.promise
    await expect(mutation).resolves.toBe(true)
    const executionOutcome = await execution
    await destruction
    const taskSends = sendToWorker.mock.calls.filter(
      ([, message]) => message.taskId != null
    )

    expect(executionOutcome).toBeInstanceOf(WorkerTerminationError)
    expect(executionOutcome).toMatchObject({
      message: 'Worker node terminated by pool',
      name: 'WorkerTerminationError',
      taskId: undefined,
      workerId: undefined,
    })
    expect(register).not.toHaveBeenCalled()
    expect(taskSends).toStrictEqual([])
    expect(pool.taskRegistry.size).toBe(0)
    expect(pool.info.executingTasks).toBe(0)
  })

  it('restores the concrete static default after a two-worker partial NACK', async () => {
    const acknowledged = Promise.withResolvers()
    const acknowledgedOperationId = {}
    const { inbox, pool } = await start({
      messageHandler: message => {
        if (
          message.taskFunctionOperationId === acknowledgedOperationId.value &&
          message.taskFunctionOperationStatus === true
        ) {
          acknowledged.resolve()
        }
      },
      size: 2,
    })
    const workerIds = pool.workerNodes.map(workerNode => workerNode.info.id)
    const operation = pool
      .setDefaultTaskFunction('matrixTarget')
      .catch(error => error)
    const forward = await Promise.all([
      inbox.take(message => message.name === 'matrixTarget'),
      inbox.take(message => message.name === 'matrixTarget'),
    ])
    const operationId = forward[0].operationId
    acknowledgedOperationId.value = operationId
    inbox.post({ action: 'ack', operationId, target: forward[0].id })
    await acknowledged.promise
    inbox.post({ action: 'nack', operationId, target: forward[1].id })

    await expect(operation).resolves.toMatchObject({
      name: 'TaskFunctionTransactionError',
    })
    await expect(pool.execute({ action: 'echo' })).resolves.toMatchObject({
      action: 'echo',
    })
    expect(
      pool.workerNodes.map(workerNode => workerNode.info.id)
    ).toStrictEqual(workerIds)
  })

  it('does not dispatch before replacement catalog replay completes', async () => {
    const { inbox, pool } = await start()
    const replacementError = Promise.withResolvers()
    const onReplacementError = error => {
      if (
        error instanceof WorkerCrashError ||
        error.message === 'crash after ACK'
      ) {
        return
      }
      replacementError.resolve({ error, kind: 'replacement-error' })
    }
    pool.emitter.on(PoolEvents.error, onReplacementError)
    try {
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
      const replayOutcome = await Promise.race([
        inbox
          .take(
            message =>
              message.name === 'matrixReplayGate' && message.id !== added.id
          )
          .then(replay => ({ kind: 'replay', replay })),
        replacementError.promise,
      ])
      if (replayOutcome.kind === 'replacement-error') await pool.destroy()
      expect(replayOutcome.kind).toBe('replay')
      const sendToWorker = vi.spyOn(pool, 'sendToWorker')
      const execution = pool.execute({ gated: true }, 'matrixReplayGate')
      const taskSendsBeforeReplay = sendToWorker.mock.calls.filter(
        ([, message]) => message.taskId != null
      )
      expect(taskSendsBeforeReplay).toStrictEqual([])
      inbox.post({
        action: 'ack',
        operationId: replayOutcome.replay.operationId,
        target: replayOutcome.replay.id,
      })
      await expect(execution).resolves.toStrictEqual({ gated: true })
    } finally {
      pool.emitter.off(PoolEvents.error, onReplacementError)
    }
  })
})
