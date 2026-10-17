import { once } from 'node:events'
import { MessageChannel } from 'node:worker_threads'
import { describe, expect, it, vi } from 'vitest'

import {
  FixedClusterPool,
  FixedThreadPool,
  PoolEvents,
} from '../../lib/index.mjs'
import { bounded, waitForMessage } from '../test-utils.cjs'

const workerFile = './tests/worker-files/thread/taskLifecycleWorker.mjs'
const ready = pool => bounded(once(pool.emitter, PoolEvents.ready))

const release = gate => {
  Atomics.store(new Int32Array(gate), 0, 1)
  Atomics.notify(new Int32Array(gate), 0)
}

const settle = promise =>
  promise.then(
    value => ({ value }),
    error => ({ error })
  )

const queueOptions = {
  enableTasksQueue: true,
  tasksQueueOptions: {
    concurrency: 1,
    tasksStealingOnBackPressure: false,
    taskStealing: false,
  },
}

describe('Task lifecycle regressions', () => {
  it.each([new Error('Original queued cancellation'), 'Queued cancellation'])(
    'preserves the queued abort reason: %s',
    async reason => {
      const pool = new FixedThreadPool(1, workerFile, queueOptions)
      const gate = new SharedArrayBuffer(4)
      const tasks = []
      try {
        await ready(pool)
        const started = waitForMessage(
          pool.workerNodes[0].worker,
          message => message.started
        )
        tasks.push(settle(pool.execute({ gate }, 'hold')))
        await bounded(started)
        const controller = new AbortController()
        const cancelled = settle(pool.execute({}, 'echo', controller.signal))
        tasks.push(cancelled)
        controller.abort(reason)
        const { error } = await bounded(cancelled)
        expect(error.message).toBe(
          reason instanceof Error ? reason.message : reason
        )
        if (reason instanceof Error) {
          expect(error).toBe(reason)
        }
        expect(pool.info.queuedTasks).toBe(0)
        expect(pool.promiseResponseMap.size).toBe(1)
      } finally {
        release(gate)
        await bounded(Promise.all(tasks))
        await bounded(pool.destroy())
      }
    }
  )

  it('rejects an already aborted task without dispatching it', async () => {
    const messages = []
    const pool = new FixedThreadPool(1, workerFile, {
      messageHandler: message => messages.push(message),
    })
    try {
      await ready(pool)
      const controller = new AbortController()
      const reason = new Error('Already aborted')
      controller.abort(reason)
      const result = await bounded(
        settle(pool.execute({ ran: true }, 'echo', controller.signal))
      )
      expect(result.error).toBe(reason)
      expect(await bounded(pool.execute({ barrier: true }, 'echo'))).toEqual({
        barrier: true,
      })
      expect(messages.filter(message => message.started)).toHaveLength(1)
      expect(pool.info.executedTasks).toBe(1)
      expect(pool.promiseResponseMap.size).toBe(0)
    } finally {
      await bounded(pool.destroy())
    }
  })

  it.each(['hold', 'promiseHold'])(
    'can abort a running promise task (%s)',
    async name => {
      const pool = new FixedThreadPool(1, workerFile)
      const gate = new SharedArrayBuffer(4)
      let running
      try {
        await ready(pool)
        const started = waitForMessage(
          pool.workerNodes[0].worker,
          message => message.started
        )
        const controller = new AbortController()
        running = settle(pool.execute({ gate }, name, controller.signal))
        await bounded(started)
        const reason = new Error('Cancel running task')
        controller.abort(reason)
        expect((await bounded(running)).error).toBe(reason)
        expect(pool.promiseResponseMap.size).toBe(0)
        expect(pool.info.executingTasks).toBe(0)
      } finally {
        release(gate)
        await bounded(running)
        await bounded(pool.destroy())
      }
    }
  )

  it('checks initial cancellation before cloning task data or selecting a worker', async () => {
    const pool = new FixedThreadPool(1, workerFile)
    const controller = new AbortController()
    const reason = new Error('Cancelled before submission')
    controller.abort(reason)
    const data = (async function * () {
      yield 'not cloneable'
    })()
    try {
      await ready(pool)
      const result = await settle(pool.execute(data, 'echo', controller.signal))
      expect(result.error).toBe(reason)
      await expect(
        pool.mapExecute([{}], 'echo', [controller.signal])
      ).rejects.toBe(reason)
      expect(pool.info.executedTasks).toBe(0)
      expect(pool.promiseResponseMap.size).toBe(0)
    } finally {
      await data.return()
      await bounded(pool.destroy())
    }
  })

  it('consumes a one-shot abort signal iterable exactly once', async () => {
    const pool = new FixedThreadPool(1, workerFile)
    try {
      await ready(pool)
      const controller = new AbortController()
      const signals = (function * () {
        yield new AbortController().signal
        yield controller.signal
      })()
      expect(
        await bounded(pool.mapExecute([{ id: 1 }, { id: 2 }], 'echo', signals))
      ).toEqual([{ id: 1 }, { id: 2 }])
    } finally {
      await bounded(pool.destroy())
    }
  })

  it('validates a one-shot signal iterable before dispatching any tasks', async () => {
    const pool = new FixedThreadPool(1, workerFile)
    try {
      await ready(pool)
      const signals = (function * () {
        yield new AbortController().signal
        yield undefined
      })()
      await expect(pool.mapExecute([{}, {}], 'echo', signals)).rejects.toThrow(
        'abortSignals argument must be an iterable of AbortSignal'
      )
      expect(pool.info.executedTasks).toBe(0)
    } finally {
      await bounded(pool.destroy())
    }
  })

  it.each([false, true])(
    'settles promise-returning functions (abortable: %s)',
    async abortable => {
      const pool = new FixedThreadPool(1, workerFile)
      try {
        await ready(pool)
        const signal = abortable ? new AbortController().signal : undefined
        expect(
          await bounded(pool.execute({ ok: true }, 'promiseEcho', signal))
        ).toEqual({
          data: { ok: true },
          executions: 1,
        })
        await expect(
          bounded(pool.execute({}, 'promiseFailure', signal))
        ).rejects.toThrow('Promise task failure')
        expect(pool.promiseResponseMap.size).toBe(0)
        expect(pool.info.executingTasks).toBe(0)
      } finally {
        await bounded(pool.destroy())
      }
    }
  )

  it.each([
    ['failure', false, 'Expected task failure'],
    ['failure', true, 'Expected task failure'],
    ['syncFailure', false, 'Expected task failure'],
    ['closedFailure', false, 'Expected task failure'],
    ['absent', false, "Task function 'absent' not found"],
  ])(
    'reports transferred-port errors (%s, abortable: %s)',
    async (name, abortable, message) => {
      const pool = new FixedThreadPool(1, workerFile)
      const channel = new MessageChannel()
      const data = { port: channel.port2 }
      const errors = []
      pool.emitter.on(PoolEvents.taskError, error => errors.push(error))
      try {
        await ready(pool)
        const signal = abortable ? new AbortController().signal : undefined
        await expect(
          bounded(pool.execute(data, name, signal, [channel.port2]))
        ).rejects.toThrow(message)
        expect(errors).toHaveLength(1)
        expect(errors[0].data).toBe(data)
        expect(errors[0].name).toBe(name)
        expect(errors[0].message).toBe(message)
        expect(await bounded(pool.execute({ usable: true }, 'echo'))).toEqual({
          usable: true,
        })
        expect(pool.promiseResponseMap.size).toBe(0)
        expect(pool.info.executingTasks).toBe(0)
      } finally {
        channel.port1.close()
        channel.port2.close()
        await bounded(pool.destroy())
      }
    }
  )

  it('preserves worker-mutated error data for tasks without transfers', async () => {
    const pool = new FixedThreadPool(1, workerFile)
    const data = { input: true }
    const errors = []
    pool.emitter.on(PoolEvents.taskError, error => errors.push(error))
    try {
      await ready(pool)
      await expect(
        bounded(pool.execute(data, 'mutatedFailure'))
      ).rejects.toThrow('Expected task failure')
      expect(errors[0].data).toEqual({ input: true, workerMutation: true })
      expect(data).toEqual({ input: true })
    } finally {
      await bounded(pool.destroy())
    }
  })

  it('ignores inherited original input when reporting an ordinary task error', async () => {
    const pool = new FixedThreadPool(1, workerFile)
    const errors = []
    pool.emitter.on(PoolEvents.taskError, error => errors.push(error))
    try {
      await ready(pool)
      // eslint-disable-next-line no-extend-native
      Object.defineProperty(Object.prototype, 'originalData', {
        configurable: true,
        value: 'inherited sentinel',
      })
      await expect(
        bounded(pool.execute({ input: true }, 'mutatedFailure'))
      ).rejects.toThrow('Expected task failure')
      expect(errors[0].data).toEqual({ input: true, workerMutation: true })
      expect(pool.promiseResponseMap.size).toBe(0)
    } finally {
      Reflect.deleteProperty(Object.prototype, 'originalData')
      await bounded(pool.destroy())
    }
  })

  it.each([
    [false, false],
    [false, true],
    [true, false],
    [true, true],
  ])(
    'snapshots a queued transfer list (batch: %s, initially nonempty: %s)',
    async (batch, initiallyNonempty) => {
      const pool = new FixedThreadPool(1, workerFile, queueOptions)
      const gate = new SharedArrayBuffer(4)
      const data = { input: true }
      const buffer = new ArrayBuffer(8)
      const transferList = initiallyNonempty ? [buffer] : []
      const errors = []
      pool.emitter.on(PoolEvents.taskError, error => errors.push(error))
      let held
      let failure
      try {
        await ready(pool)
        const started = waitForMessage(
          pool.workerNodes[0].worker,
          message => message.started
        )
        held = settle(pool.execute({ gate }, 'hold'))
        await bounded(started)
        failure = settle(
          batch
            ? pool.mapExecute([data], 'mutatedFailure', undefined, transferList)
            : pool.execute(data, 'mutatedFailure', undefined, transferList)
        )
        if (initiallyNonempty) transferList.length = 0
        else transferList.push(buffer)
        release(gate)
        expect((await bounded(failure)).error.message).toBe(
          'Expected task failure'
        )
        expect(buffer.byteLength).toBe(initiallyNonempty ? 0 : 8)
        expect(errors[0].data).toEqual(
          initiallyNonempty ? data : { input: true, workerMutation: true }
        )
      } finally {
        release(gate)
        await bounded(Promise.all([held, failure]))
        await bounded(pool.destroy())
      }
    }
  )

  it.each([false, true])(
    'receives the async kill acknowledgement (failure: %s)',
    async failCleanup => {
      const pool = new FixedThreadPool(1, workerFile, {
        workerOptions: { workerData: { failCleanup } },
      })
      const errors = []
      pool.emitter.on(PoolEvents.error, error => errors.push(error))
      try {
        await ready(pool)
        const acknowledgements = []
        pool.workerNodes[0].messageChannel.port1.on('message', message => {
          if (message.kill != null) acknowledgements.push(message.kill)
        })
        await bounded(pool.destroy())
        if (failCleanup) {
          expect(errors.map(error => error.message)).toEqual([
            expect.stringContaining('Kill message handling failed'),
          ])
        } else {
          expect(errors).toEqual([])
        }
        expect(acknowledgements).toEqual([failCleanup ? 'failure' : 'success'])
      } finally {
        if (pool.started) await bounded(pool.destroy())
      }
    }
  )

  it.each([
    ['thread', FixedThreadPool],
    ['cluster', FixedClusterPool],
  ])(
    'correlates concurrent task-function operations (%s)',
    async (_workerType, Pool) => {
      const pool = new Pool(
        2,
        Pool === FixedThreadPool
          ? workerFile
          : './tests/worker-files/cluster/echoWorker.mjs'
      )
      try {
        await ready(pool)
        const [added, absent] = await bounded(
          Promise.all([
            settle(pool.addTaskFunction('added', data => data)),
            settle(pool.setDefaultTaskFunction('absent')),
          ])
        )
        expect(added.value).toBe(true)
        expect(absent.error?.message).toContain(
          "Task function operation 'default' failed"
        )
        expect(
          await bounded(pool.execute({ registered: true }, 'added'))
        ).toEqual({ registered: true })
        expect(await bounded(pool.setDefaultTaskFunction('added'))).toBe(true)
        expect(await bounded(pool.execute({ default: true }))).toEqual({
          default: true,
        })
      } finally {
        await bounded(pool.destroy())
      }
    }
  )

  it.each([
    ['thread', FixedThreadPool],
    ['cluster', FixedClusterPool],
  ])(
    'separates concurrent removals of the same function (%s)',
    async (_workerType, Pool) => {
      const pool = new Pool(
        2,
        Pool === FixedThreadPool
          ? workerFile
          : './tests/worker-files/cluster/echoWorker.mjs'
      )
      try {
        await ready(pool)
        await bounded(pool.addTaskFunction('removable', data => data))
        const [first, second] = await bounded(
          Promise.all([
            settle(pool.removeTaskFunction('removable')),
            settle(pool.removeTaskFunction('removable')),
          ])
        )
        expect(first.value).toBe(true)
        expect(second.error?.message).toContain(
          "Task function operation 'remove' failed"
        )
        expect(pool.hasTaskFunction('removable')).toBe(false)
        expect(await bounded(pool.addTaskFunction('next', data => data))).toBe(
          true
        )
        expect(await bounded(pool.execute({ next: true }, 'next'))).toEqual({
          next: true,
        })
      } finally {
        await bounded(pool.destroy())
      }
    }
  )

  it.each([
    ['thread', FixedThreadPool],
    ['cluster', FixedClusterPool],
  ])(
    'replays runtime functions after native fixed-worker exit (%s)',
    async (_workerType, Pool) => {
      const pool = new Pool(
        1,
        Pool === FixedThreadPool
          ? workerFile
          : './tests/worker-files/cluster/echoWorker.mjs'
      )
      try {
        await ready(pool)
        await bounded(
          pool.addTaskFunction('runtime', data => ({ runtime: data }))
        )
        await bounded(
          pool.addTaskFunction('secondRuntime', data => ({ second: data }))
        )
        expect(await bounded(pool.execute('before', 'runtime'))).toEqual({
          runtime: 'before',
        })
        const previousWorker = pool.workerNodes[0].worker
        if (Pool === FixedThreadPool) {
          await previousWorker.terminate()
        } else {
          const exited = new Promise(resolve =>
            previousWorker.once('exit', resolve)
          )
          previousWorker.kill()
          await bounded(exited)
        }
        await vi.waitFor(
          () => {
            expect(pool.workerNodes).toHaveLength(1)
            expect(pool.workerNodes[0].worker).not.toBe(previousWorker)
            expect(pool.workerNodes[0].info.ready).toBe(true)
          },
          { timeout: 5000 }
        )
        expect(pool.workerNodes[0].worker).not.toBe(previousWorker)
        expect(await bounded(pool.execute('after', 'runtime'))).toEqual({
          runtime: 'after',
        })
        expect(await bounded(pool.execute('after', 'secondRuntime'))).toEqual({
          second: 'after',
        })
        expect(pool.hasTaskFunction('runtime')).toBe(true)
        expect(pool.hasTaskFunction('secondRuntime')).toBe(true)
      } finally {
        await bounded(pool.destroy())
      }
    }
  )
})
