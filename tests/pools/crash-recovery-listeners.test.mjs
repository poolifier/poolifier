import { spawnSync } from 'node:child_process'
import { describe, expect, it, vi } from 'vitest'

import {
  FixedThreadPool,
  PoolEvents,
  WorkerCrashError,
} from '../../lib/index.mjs'
import { createCrashRecoveryTestContext } from './crash-recovery-test-support.mjs'

describe('Crash recovery regression test suite', () => {
  const { trackPool } = createCrashRecoveryTestContext()

  const runHandlerThrowChild = scenario => {
    const child = spawnSync(
      process.execPath,
      ['tests/pools/fixtures/worker-handler-throw-child.mjs', scenario],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        killSignal: 'SIGKILL',
        timeout: 10_000,
      }
    )
    const records = child.stdout
      .trim()
      .split('\n')
      .filter(line => line.length > 0)
      .map(line => JSON.parse(line))
    return { child, records }
  }

  it.each(['error-handler', 'exit-handler', 'pool-error-listener'])(
    '%s throw is rethrown once only after typed settlement and cleanup',
    {
      retry: 0,
      timeout: 15_000,
    },
    scenario => {
      const { child, records } = runHandlerThrowChild(scenario)
      expect(child.error).toBeUndefined()
      expect(child.status).not.toBe(0)
      expect(records).toHaveLength(1)
      expect(records[0].marker).toBe('single-throw-monitor')
      expect(records[0].exactIdentity).toBe(true)
      expect(records[0].uncaughtCount).toBe(1)
      expect(records[0].executingTasks).toBe(0)
      expect(records[0].queuedTasks).toBe(0)
      expect(records[0].originalWorkerRemoved).toBe(true)
      expect(records[0].taskOutcome.typed).toBe(true)
      expect(records[0].taskOutcome.workerId).toBeDefined()
      expect(records[0].callbackRecords.every(record => record.sameThis)).toBe(
        true
      )
      for (const record of records[0].callbackRecords) {
        if (record.surface === 'errorHandler') {
          expect(record.args).toStrictEqual(['Simulated worker crash'])
        } else if (record.surface === 'exitHandler') {
          expect(record.args).toHaveLength(2)
          expect(record.args[1]).toBeNull()
        } else {
          expect(['WorkerCrashError', 'WorkerTerminationError']).toContain(
            record.args[0]
          )
        }
      }
      if (scenario === 'pool-error-listener') {
        expect(records[0].destroying).toBe(false)
        expect(records[0].started).toBe(false)
        expect(records[0].workerNodes).toBe(0)
      }
    }
  )

  it('combined listener throws retain identity without duplicate drains', {
    retry: 0,
    timeout: 15_000,
  }, () => {
    const { child, records } = runHandlerThrowChild('combined-multiple-throw')
    expect(child.error).toBeUndefined()
    expect(child.status).toBe(0)
    expect(child.stderr).toBe('')
    expect(records).toHaveLength(1)
    expect(records[0].marker).toBe('combined-final')
    expect(records[0].uncaughtCount).toBe(3)
    expect(records[0].uniqueCount).toBe(3)
    expect(records[0].exactIdentities).toBe(true)
    expect(records[0].executingTasks).toBe(0)
    expect(records[0].queuedTasks).toBe(0)
    expect(records[0].originalWorkerRemoved).toBe(true)
    expect(records[0].taskOutcome.name).toBe('WorkerCrashError')
    expect(records[0].workerNodes).toBe(0)
    expect(records[0].callbackRecords.every(record => record.sameThis)).toBe(
      true
    )
  })

  it.each(['no-listener', 'non-throwing'])(
    '%s control schedules no uncaught exception',
    {
      retry: 0,
      timeout: 15_000,
    },
    scenario => {
      const { child, records } = runHandlerThrowChild(scenario)
      expect(child.error).toBeUndefined()
      expect(child.status).toBe(0)
      expect(child.stderr).toBe('')
      expect(records).toHaveLength(1)
      expect(records[0].marker).toBe('control-final')
      expect(records[0].uncaughtCount).toBe(0)
      expect(records[0].executingTasks).toBe(0)
      expect(records[0].queuedTasks).toBe(0)
      expect(records[0].workerNodes).toBe(0)
    }
  )

  it('in-process crash settles before one captured handler throw drains', {
    retry: 0,
    timeout: 10_000,
  }, async () => {
    const handlerError = new Error('task-4 in-process handler throw')
    const cause = new Error('task-4 in-process crash')
    const queuedRethrows = []
    const queuedRethrowResolvers = []
    let handlerArgument
    let handlerThisMatches = false
    const pool = trackPool(
      new FixedThreadPool(1, './tests/worker-files/thread/hangWorker.mjs', {
        enableTasksQueue: false,
        errorHandler: function (error) {
          handlerArgument = error
          handlerThisMatches = this === workerNode.worker
          throw handlerError
        },
        restartWorkerOnError: false,
      })
    )
    if (!pool.info.ready) {
      await new Promise(resolve => {
        pool.emitter.once(PoolEvents.ready, resolve)
      })
    }
    const workerNode = pool.workerNodes[0]
    const workerId = workerNode.info.id
    const nativeQueueMicrotask = globalThis.queueMicrotask
    const queueMicrotaskSpy = vi
      .spyOn(globalThis, 'queueMicrotask')
      .mockImplementation(callback => {
        nativeQueueMicrotask(() => {
          try {
            callback()
          } catch (error) {
            queuedRethrows.push(() => {
              throw error
            })
            queuedRethrowResolvers.shift()?.()
          }
        })
      })
    try {
      const firstQueuedRethrow = new Promise(resolve => {
        queuedRethrowResolvers.push(resolve)
      })
      const terminated = new Promise(resolve => {
        workerNode.once('terminated', resolve)
      })
      const taskOutcome = pool.execute().catch(error => error)

      workerNode.worker.emit('error', cause)

      const rejected = await taskOutcome
      await Promise.all([firstQueuedRethrow, terminated])
      expect(rejected).toBeInstanceOf(WorkerCrashError)
      expect(rejected.workerId).toBe(workerId)
      expect(handlerArgument).toBe(cause)
      expect(handlerThisMatches).toBe(true)
      expect(() => queuedRethrows[0]()).toThrow(handlerError)

      expect(queuedRethrows).toHaveLength(1)

      const ordinaryListenerError = new Error(
        'task-4 non-lifecycle pool listener throw'
      )
      pool.emitter.on(PoolEvents.error, () => {
        throw ordinaryListenerError
      })
      const secondQueuedRethrow = new Promise(resolve => {
        queuedRethrowResolvers.push(resolve)
      })
      pool.publishPoolError(new Error('task-4 non-lifecycle pool error'))
      await secondQueuedRethrow
      expect(() => queuedRethrows[1]()).toThrow(ordinaryListenerError)
    } finally {
      queueMicrotaskSpy.mockRestore()
    }
  })
})
