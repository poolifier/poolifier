import { execFile } from 'node:child_process'
import { once } from 'node:events'
import { promisify } from 'node:util'
import { describe, expect, it, vi } from 'vitest'

import {
  DynamicThreadPool,
  FixedThreadPool,
  PoolEvents,
  WorkerChoiceStrategies,
} from '../../lib/index.mjs'
import { bounded, waitForMessage } from '../test-utils.cjs'

const release = gate => {
  Atomics.store(new Int32Array(gate), 0, 1)
  Atomics.notify(new Int32Array(gate), 0)
}

describe('Runtime task function replay', () => {
  it.each(['remove', 'update', 'failed removal', 'late default'])(
    'does not replay stale registrations during %s',
    async operation => {
      const pool = new FixedThreadPool(
        2,
        './tests/worker-files/thread/taskLifecycleWorker.mjs',
        {
          workerChoiceStrategy: WorkerChoiceStrategies.ROUND_ROBIN,
          workerOptions: { workerData: { blockWorkerKeys: [1] } },
        }
      )
      const gate = new SharedArrayBuffer(4)
      let blocked
      let change
      let defaultChange
      try {
        await bounded(once(pool.emitter, PoolEvents.ready))
        await bounded(pool.addTaskFunction('runtime', () => 'old'))
        if (operation === 'failed removal') {
          await bounded(pool.setDefaultTaskFunction('runtime'))
        }
        const original = pool.workerNodes[0]
        const blocking = waitForMessage(
          pool.workerNodes[1].worker,
          message => message.blocked
        )
        blocked = pool.execute({ gate }, 'block')
        await bounded(blocking)
        const acknowledged = waitForMessage(
          original.messageChannel.port1,
          message =>
            message.taskFunctionOperationStatus != null &&
            message.taskFunctionProperties?.name === 'runtime' &&
            message.taskFunctionOperation ===
              (operation === 'remove' || operation === 'failed removal'
                ? 'remove'
                : 'add')
        )
        change = (
          operation === 'remove' || operation === 'failed removal'
            ? pool.removeTaskFunction('runtime')
            : pool.addTaskFunction('runtime', () => 'new')
        ).then(
          value => ({ value }),
          error => ({ error })
        )
        await bounded(acknowledged)
        await original.worker.terminate()
        await vi.waitFor(() => {
          expect(pool.workerNodes).toHaveLength(2)
          expect(
            pool.workerNodes.some(
              node => node !== original && node !== pool.workerNodes[0]
            )
          ).toBe(true)
        })
        if (operation === 'late default') {
          defaultChange = pool.setDefaultTaskFunction('runtime')
        }
        release(gate)
        const result = await bounded(change)
        if (operation === 'failed removal') {
          expect(result.error.message).toContain(
            "Task function operation 'remove' failed"
          )
        } else {
          expect(result.value).toBe(true)
        }
        if (defaultChange != null) {
          expect(await bounded(defaultChange)).toBe(true)
        }
        await bounded(blocked)
        await bounded(pool.addTaskFunction('barrier', data => data))
        for (let i = 0; i < 2; ++i) {
          if (operation === 'remove') {
            await expect(bounded(pool.execute({}, 'runtime'))).rejects.toThrow(
              "Task function 'runtime' not found"
            )
          } else {
            const name = operation === 'late default' ? undefined : 'runtime'
            expect(await bounded(pool.execute({}, name))).toBe(
              operation === 'failed removal' ? 'old' : 'new'
            )
          }
        }
      } finally {
        release(gate)
        await bounded(Promise.allSettled([blocked, change, defaultChange]))
        await bounded(pool.destroy())
      }
    }
  )

  it.each(['add', 'remove', 'default'])(
    'releases replacement bootstrap after a target exits without an ACK (%s)',
    async operation => {
      const pool = new FixedThreadPool(
        1,
        './tests/worker-files/thread/taskLifecycleWorker.mjs'
      )
      const gate = new SharedArrayBuffer(4)
      let blocked
      let change
      try {
        await bounded(once(pool.emitter, PoolEvents.ready))
        await bounded(pool.addTaskFunction('runtime', data => data))
        const original = pool.workerNodes[0]
        const entered = waitForMessage(
          original.worker,
          message => message.blocked
        )
        blocked = pool.execute({ gate }, 'block').catch(error => error)
        await bounded(entered)
        const pending =
          operation === 'add'
            ? pool.addTaskFunction('newRuntime', data => data)
            : operation === 'remove'
              ? pool.removeTaskFunction('runtime')
              : pool.setDefaultTaskFunction('echo')
        change = pending.then(
          value => ({ value }),
          error => ({ error })
        )
        await original.worker.terminate()
        const result = await bounded(
          change,
          'Operation remained pending after target exit'
        )
        expect(result.error.message).toContain(
          'exited before acknowledging task function operation'
        )
        await vi.waitFor(
          () => {
            expect(pool.workerNodes).toHaveLength(1)
            expect(pool.workerNodes[0].worker).not.toBe(original.worker)
            expect(pool.workerNodes[0].info.ready).toBe(true)
          },
          { timeout: 5000 }
        )
        expect(
          await bounded(pool.execute({ recovered: true }, 'echo'))
        ).toEqual({ recovered: true })
        expect(
          await bounded(pool.execute({ retained: true }, 'runtime'))
        ).toEqual({ retained: true })
        expect(pool.hasTaskFunction('newRuntime')).toBe(false)
        expect(await bounded(pool.addTaskFunction('after', data => data))).toBe(
          true
        )
        expect(await bounded(pool.execute({ usable: true }, 'after'))).toEqual({
          usable: true,
        })
      } finally {
        release(gate)
        await bounded(Promise.allSettled([blocked]))
        await bounded(pool.destroy())
      }
    }
  )

  it.each(['add', 'update', 'remove'])(
    'keeps survivors and replacements consistent after a peer exits without an ACK (%s)',
    async operation => {
      const pool = new FixedThreadPool(
        2,
        './tests/worker-files/thread/taskLifecycleWorker.mjs',
        {
          workerChoiceStrategy: WorkerChoiceStrategies.ROUND_ROBIN,
          workerOptions: { workerData: { blockWorkerKeys: [1] } },
        }
      )
      const gate = new SharedArrayBuffer(4)
      let blocked
      try {
        await bounded(once(pool.emitter, PoolEvents.ready))
        if (operation !== 'add') {
          await bounded(pool.addTaskFunction('runtime', () => 'old'))
        }
        const survivor = pool.workerNodes[0]
        const departed = pool.workerNodes[1]
        const entered = waitForMessage(
          departed.worker,
          message => message.blocked
        )
        blocked = pool.execute({ gate }, 'block').catch(error => error)
        await bounded(entered)
        const acknowledged = waitForMessage(
          survivor.messageChannel.port1,
          message =>
            message.taskFunctionOperationStatus != null &&
            message.taskFunctionProperties?.name === 'runtime'
        )
        const pending =
          operation === 'remove'
            ? pool.removeTaskFunction('runtime')
            : pool.addTaskFunction('runtime', () => 'new')
        const change = pending.then(
          value => ({ value }),
          error => ({ error })
        )
        await bounded(acknowledged)
        await departed.worker.terminate()
        expect(await bounded(change)).toStrictEqual({ value: true })
        await vi.waitFor(
          () => {
            expect(pool.workerNodes).toHaveLength(2)
            expect(pool.workerNodes[1]).not.toBe(departed)
            expect(pool.workerNodes[1].info.ready).toBe(true)
          },
          { timeout: 5000 }
        )
        await bounded(pool.addTaskFunction('barrier', data => data))
        for (let i = 0; i < 2; i++) {
          if (operation === 'remove') {
            await expect(pool.execute({}, 'runtime')).rejects.toThrow(
              "Task function 'runtime' not found"
            )
          } else {
            expect(await bounded(pool.execute({}, 'runtime'))).toBe('new')
          }
        }
      } finally {
        release(gate)
        await bounded(Promise.allSettled([blocked]))
        await bounded(pool.destroy())
      }
    }
  )

  it('commits concurrent updates in dispatch order when their unanswered peer exits', async () => {
    const pool = new FixedThreadPool(
      2,
      './tests/worker-files/thread/taskLifecycleWorker.mjs',
      {
        workerChoiceStrategy: WorkerChoiceStrategies.ROUND_ROBIN,
        workerOptions: { workerData: { blockWorkerKeys: [1] } },
      }
    )
    const gate = new SharedArrayBuffer(4)
    let blocked
    try {
      await bounded(once(pool.emitter, PoolEvents.ready))
      await bounded(pool.addTaskFunction('runtime', () => 'old'))
      const survivor = pool.workerNodes[0]
      const departed = pool.workerNodes[1]
      const entered = waitForMessage(
        departed.worker,
        message => message.blocked
      )
      blocked = pool.execute({ gate }, 'block').catch(error => error)
      await bounded(entered)
      const acknowledgements = new Set()
      const acknowledged = waitForMessage(
        survivor.messageChannel.port1,
        message => {
          if (
            message.taskFunctionOperationStatus != null &&
            message.taskFunctionProperties?.name === 'runtime'
          ) {
            acknowledgements.add(message.taskFunctionOperationId)
          }
          return acknowledgements.size === 2
        }
      )
      const changes = [
        pool.addTaskFunction('runtime', () => 'older'),
        pool.addTaskFunction('runtime', () => 'newer'),
      ].map(promise =>
        promise.then(
          value => ({ value }),
          error => ({ error })
        )
      )
      await bounded(acknowledged)
      await departed.worker.terminate()
      expect(await bounded(Promise.all(changes))).toStrictEqual([
        { value: true },
        { value: true },
      ])
      await bounded(pool.addTaskFunction('barrier', data => data))
      for (let i = 0; i < 2; i++) {
        expect(await bounded(pool.execute({}, 'runtime'))).toBe('newer')
      }
    } finally {
      release(gate)
      await bounded(Promise.allSettled([blocked]))
      await bounded(pool.destroy())
    }
  })

  it('rejects an unacknowledged operation even when replacement construction throws', async () => {
    const { stdout } = await promisify(execFile)(
      process.execPath,
      [
        '--eval',
        `
          const { once } = require('node:events')
          const { MessageChannel } = require('node:worker_threads')
          const { FixedThreadPool, PoolEvents } = require('./lib/index.cjs')
          const { bounded, waitForMessage } = require('./tests/test-utils.cjs')

          const channel = new MessageChannel()
          const gate = new SharedArrayBuffer(4)
          const exception = Promise.withResolvers()
          process.once('uncaughtException', exception.resolve)
          let pool
          ;(async () => {
            try {
              pool = new FixedThreadPool(
                1,
                './tests/worker-files/thread/taskLifecycleWorker.mjs',
                {
                  workerOptions: {
                    workerData: { port: channel.port1 },
                    transferList: [channel.port1],
                  },
                }
              )
              await bounded(once(pool.emitter, PoolEvents.ready))
              const original = pool.workerNodes[0].worker
              const entered = waitForMessage(original, message => message.blocked)
              pool.execute({ gate }, 'block').catch(error => error)
              await bounded(entered)
              const change = pool.setDefaultTaskFunction('echo').then(
                value => ({ status: 'fulfilled', value }),
                error => ({ status: 'rejected', message: error.message })
              )
              original.terminate().catch(error => {
                console.error(error)
                process.exitCode = 1
              })
              const error = await bounded(exception.promise)
              console.log(JSON.stringify({
                constructionError: error.name,
                operation: await bounded(change),
              }))
            } finally {
              Atomics.store(new Int32Array(gate), 0, 1)
              Atomics.notify(new Int32Array(gate), 0)
              try {
                if (pool != null) await bounded(pool.destroy())
              } finally {
                channel.port1.close()
                channel.port2.close()
                process.off('uncaughtException', exception.resolve)
              }
            }
          })().catch(error => {
            console.error(error)
            process.exitCode = 1
          })
        `,
      ],
      { timeout: 10000 }
    )
    const result = JSON.parse(stdout)
    expect(result.constructionError).toBe('DataCloneError')
    expect(result.operation.status).toBe('rejected')
    expect(result.operation.message).toContain(
      "exited before acknowledging task function operation 'default'"
    )
  })

  it('keeps a replacement unready until replayed scheduling metadata is available', async () => {
    const replayGate = new SharedArrayBuffer(4)
    Atomics.store(new Int32Array(replayGate), 0, 1)
    const replayBlocked = Promise.withResolvers()
    const pool = new FixedThreadPool(
      1,
      './tests/worker-files/thread/taskLifecycleWorker.mjs',
      {
        enableTasksQueue: true,
        messageHandler: message => {
          if (message.replayBlocked) replayBlocked.resolve(message.workerId)
        },
        tasksQueueOptions: {
          concurrency: 1,
          tasksStealingOnBackPressure: false,
          taskStealing: false,
        },
        workerOptions: { workerData: { replayGate } },
      }
    )
    const errors = []
    pool.emitter.on('error', error => errors.push(error))
    const holdGate = new SharedArrayBuffer(4)
    const tasks = []
    try {
      await bounded(once(pool.emitter, PoolEvents.ready))
      await bounded(
        pool.addTaskFunction('runtime', {
          priority: -10,
          strategy: WorkerChoiceStrategies.ROUND_ROBIN,
          taskFunction: data => data,
        })
      )
      const original = pool.workerNodes[0]
      Atomics.store(new Int32Array(replayGate), 0, 0)
      await original.worker.terminate()
      const workerId = await bounded(replayBlocked.promise)
      const replacement = pool.workerNodes.find(
        node => node.info.id === workerId
      )
      await vi.waitFor(() => {
        expect(replacement.info.taskFunctionsProperties).toBeDefined()
      })
      expect(replacement.info.ready).toBe(false)
      release(replayGate)
      await vi.waitFor(() => expect(replacement.info.ready).toBe(true))
      expect(pool.hasTaskFunction('runtime')).toBe(true)
      expect(pool.listTaskFunctionsProperties()).toContainEqual({
        name: 'runtime',
        priority: -10,
        strategy: WorkerChoiceStrategies.ROUND_ROBIN,
      })
      const entered = waitForMessage(
        replacement.worker,
        message => message.started
      )
      const held = pool.execute({ gate: holdGate }, 'hold')
      tasks.push(held)
      await bounded(entered)
      const order = []
      const ordinary = pool.execute({ id: 'ordinary' }, 'echo').then(data => {
        order.push(data.id)
        return data
      })
      const priority = pool
        .execute({ id: 'priority' }, 'runtime')
        .then(data => {
          order.push(data.id)
          return data
        })
      tasks.push(ordinary, priority)
      release(holdGate)
      await bounded(Promise.all(tasks))
      expect(order).toStrictEqual(['priority', 'ordinary'])
      expect(errors).toStrictEqual([])
    } finally {
      release(replayGate)
      release(holdGate)
      await bounded(Promise.allSettled(tasks))
      await bounded(pool.destroy())
    }
  })

  it('cancels a first-use task without transferring its input while dynamic replay waits', async () => {
    const replayGate = new SharedArrayBuffer(4)
    const replayBlocked = Promise.withResolvers()
    const pool = new DynamicThreadPool(
      0,
      1,
      './tests/worker-files/thread/taskLifecycleWorker.mjs',
      {
        messageHandler: message => {
          if (message.replayBlocked) replayBlocked.resolve()
        },
        workerOptions: { workerData: { replayGate } },
      }
    )
    const errors = []
    pool.emitter.on('error', error => errors.push(error))
    const tasks = []
    try {
      await bounded(
        pool.addTaskFunction('runtime', {
          priority: -10,
          strategy: WorkerChoiceStrategies.ROUND_ROBIN,
          taskFunction: data => data,
        })
      )
      const controller = new AbortController()
      const reason = new Error('Cancelled during runtime replay')
      const data = { buffer: new ArrayBuffer(8) }
      const cancelled = pool
        .execute(data, 'runtime', controller.signal, [data.buffer])
        .then(
          value => ({ value }),
          error => ({ error })
        )
      tasks.push(cancelled)
      const live = pool.execute({ id: 'live' }, 'runtime')
      tasks.push(live)
      await bounded(replayBlocked.promise)
      expect(data.buffer.byteLength).toBe(8)
      controller.abort(reason)
      expect((await bounded(cancelled)).error).toBe(reason)
      expect(data.buffer.byteLength).toBe(8)
      release(replayGate)
      expect(await bounded(live)).toStrictEqual({ id: 'live' })
      expect(pool.hasTaskFunction('runtime')).toBe(true)
      expect(errors).toStrictEqual([])
    } finally {
      release(replayGate)
      await bounded(Promise.allSettled(tasks))
      await bounded(pool.destroy())
    }
  })

  it('settles first-use execution when destruction interrupts dynamic replay', async () => {
    const replayGate = new SharedArrayBuffer(4)
    const replayBlocked = Promise.withResolvers()
    const pool = new DynamicThreadPool(
      0,
      1,
      './tests/worker-files/thread/taskLifecycleWorker.mjs',
      {
        messageHandler: message => {
          if (message.replayBlocked) replayBlocked.resolve()
        },
        workerOptions: { workerData: { replayGate } },
      }
    )
    const errors = []
    pool.emitter.on('error', error => errors.push(error))
    let execution
    try {
      await bounded(pool.addTaskFunction('runtime', data => data))
      const data = { buffer: new ArrayBuffer(8) }
      execution = pool.execute(data, 'runtime', undefined, [data.buffer]).then(
        value => ({ value }),
        error => ({ error })
      )
      await bounded(replayBlocked.promise)
      await bounded(pool.destroy())
      expect((await bounded(execution)).error).toBeInstanceOf(Error)
      expect(data.buffer.byteLength).toBe(8)
    } finally {
      release(replayGate)
      if (pool.info.started) await bounded(pool.destroy())
    }
  })
})
