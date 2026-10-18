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

class WrappedThreadPool extends FixedThreadPool {
  deregisterWorkerMessageListener (workerNodeKey, listener) {
    const wrappers = this.listenerWrappers.get(this.workerNodes[workerNodeKey])
    const wrapped = wrappers?.get(listener)
    wrappers?.delete(listener)
    super.deregisterWorkerMessageListener(workerNodeKey, wrapped ?? listener)
    this.onListenerRemoval?.(workerNodeKey)
  }

  registerWorkerMessageListener (workerNodeKey, listener) {
    const workerNode = this.workerNodes[workerNodeKey]
    let wrappers = this.listenerWrappers.get(workerNode)
    if (wrappers == null) {
      wrappers = new Map()
      this.listenerWrappers.set(workerNode, wrappers)
    }
    const wrapped = listener.bind(this)
    wrappers.set(listener, wrapped)
    super.registerWorkerMessageListener(workerNodeKey, wrapped)
  }

  setupHook () {
    this.listenerWrappers = new WeakMap()
  }
}

describe('Runtime task function replay', () => {
  it.each(['remove', 'default'])(
    'waits for workers created while resuming a %s operation',
    async operation => {
      const gate = new SharedArrayBuffer(4)
      const tasks = []
      const pool = new DynamicThreadPool(
        1,
        3,
        './tests/worker-files/thread/taskLifecycleWorker.mjs'
      )
      try {
        await bounded(once(pool.emitter, PoolEvents.ready))
        await bounded(pool.addTaskFunction('runtime', data => data))
        await bounded(
          pool.addTaskFunction('secondHold', {
            taskFunction: async ({ gate }) => {
              await Atomics.waitAsync(new Int32Array(gate), 0, 0).value
              return 'released'
            },
            workerNodeKeys: [1],
          })
        )
        tasks.push(pool.execute({ gate }, 'hold'))
        tasks.push(pool.execute({}, 'echo'))
        const bootstrap = pool.workerTaskFunctionBootstraps.get(
          pool.workerNodes[1]
        ).promise
        const change =
          operation === 'remove'
            ? pool.removeTaskFunction('runtime')
            : pool.setDefaultTaskFunction('runtime')
        await Promise.resolve()
        const growth = bootstrap.then(() => {
          tasks.push(pool.execute({ gate }, 'secondHold'))
          tasks.push(pool.execute({}, 'echo'))
          return undefined
        })
        await expect(bounded(change)).resolves.toBe(true)
        await bounded(growth)
        expect(pool.workerNodes).toHaveLength(3)
        expect(pool.hasTaskFunction('runtime')).toBe(operation !== 'remove')
        if (operation === 'default') {
          expect(await bounded(pool.execute({ selected: true }))).toEqual({
            selected: true,
          })
        }
      } finally {
        release(gate)
        await bounded(Promise.allSettled(tasks))
        await bounded(pool.destroy())
      }
    }
  )

  it('keeps a HARD-terminating dynamic worker unavailable after replay', async () => {
    const replayGate = new SharedArrayBuffer(4)
    const cleanupGate = new SharedArrayBuffer(4)
    const taskGate = new SharedArrayBuffer(4)
    const started = new SharedArrayBuffer(4)
    const cleanup = Promise.withResolvers()
    const pool = new DynamicThreadPool(
      0,
      1,
      './tests/worker-files/thread/taskLifecycleWorker.mjs',
      {
        messageHandler: message => {
          if (message.cleanupStarted) cleanup.resolve()
        },
        workerOptions: {
          workerData: {
            asyncReplay: true,
            cleanupGate,
            hardReplayKill: true,
            replayGate,
          },
        },
      }
    )
    const errors = []
    pool.emitter.on(PoolEvents.error, error => errors.push(error))
    let execution
    let settled = false
    try {
      await pool.addTaskFunction('runtime', async data => {
        Atomics.store(new Int32Array(data.started), 0, 1)
        await Atomics.waitAsync(new Int32Array(data.taskGate), 0, 0).value
        return data.buffer.byteLength
      })
      const data = { buffer: new ArrayBuffer(8), started, taskGate }
      execution = pool.execute(data, 'runtime', undefined, [data.buffer]).then(
        value => {
          settled = true
          return { value }
        },
        error => {
          settled = true
          return { error }
        }
      )
      await bounded(cleanup.promise)
      const node = pool.workerNodes[0]
      const exited = once(node.worker, 'exit')
      expect(node.info.ready).toBe(false)
      release(replayGate)
      await vi.waitFor(() => {
        expect(settled || Atomics.load(new Int32Array(started), 0) === 1).toBe(
          true
        )
      })
      expect(node.info.ready).toBe(false)
      expect(Atomics.load(new Int32Array(started), 0)).toBe(0)
      expect(data.buffer.byteLength).toBe(8)
      expect((await bounded(execution)).error).toBeInstanceOf(Error)
      expect(node.worker.threadId).toBeGreaterThan(0)
      expect(pool.info.executingTasks).toBe(0)
      release(cleanupGate)
      await bounded(exited)
      expect(pool.workerNodes).toEqual([])
      expect(errors).toEqual([])
    } finally {
      release(replayGate)
      release(taskGate)
      if (Atomics.load(new Int32Array(started), 0) === 1 && execution != null) {
        await bounded(execution)
      }
      release(cleanupGate)
      await bounded(pool.destroy())
    }
  })

  it.each(['replacement', 'restart'])(
    'replays the captured source after %s',
    async transition => {
      const pool = new FixedThreadPool(
        1,
        './tests/worker-files/thread/taskLifecycleWorker.mjs'
      )
      try {
        await bounded(once(pool.emitter, PoolEvents.ready))
        const taskFunction = () => 42
        await bounded(pool.addTaskFunction('captured', taskFunction))
        await bounded(pool.setDefaultTaskFunction('captured'))
        taskFunction.toString = () => '() => 99'
        const original = pool.workerNodes[0]
        if (transition === 'replacement') {
          await original.worker.terminate()
        } else {
          await bounded(pool.destroy())
          pool.start()
        }
        await vi.waitFor(() => {
          expect(pool.workerNodes).toHaveLength(1)
          expect(pool.workerNodes[0]).not.toBe(original)
          expect(pool.workerNodes[0].info.ready).toBe(true)
        })
        expect(await bounded(pool.execute({}))).toBe(42)
      } finally {
        await bounded(pool.destroy())
      }
    }
  )

  it('keeps execution and registration waiting across replacement replay exits', async () => {
    const replayGates = Array.from(
      { length: 3 },
      () => new SharedArrayBuffer(4)
    )
    const blocked = Array.from({ length: 3 }, () => Promise.withResolvers())
    release(replayGates[0])
    const errors = []
    const pool = new FixedThreadPool(
      1,
      './tests/worker-files/thread/taskLifecycleWorker.mjs',
      {
        messageHandler: message => {
          if (message.replayBlocked) {
            blocked[message.replayGeneration].resolve()
          }
        },
        workerOptions: {
          workerData: { replayCounter: new SharedArrayBuffer(4), replayGates },
        },
      }
    )
    pool.emitter.on(PoolEvents.error, error => errors.push(error))
    const tasks = []
    try {
      await bounded(once(pool.emitter, PoolEvents.ready))
      await bounded(
        pool.addTaskFunction('runtime', data => data.buffer.byteLength)
      )
      await pool.workerNodes[0].worker.terminate()
      await bounded(blocked[1].promise)
      const data = { buffer: new ArrayBuffer(8) }
      const abortedData = { buffer: new ArrayBuffer(4) }
      const controller = new AbortController()
      const reason = new Error('Replay wait aborted')
      let executed = false
      let registered = false
      const execution = pool
        .execute(data, 'runtime', undefined, [data.buffer])
        .then(
          value => {
            executed = true
            return { value }
          },
          error => {
            executed = true
            return { error }
          }
        )
      const registration = pool
        .addTaskFunction('later', () => 9)
        .then(
          value => {
            registered = true
            return { value }
          },
          error => {
            registered = true
            return { error }
          }
        )
      const aborted = pool
        .execute(abortedData, 'runtime', controller.signal, [
          abortedData.buffer,
        ])
        .catch(error => error)
      tasks.push(execution, registration, aborted)
      const retiring = pool.workerNodes[0].worker
      retiring.once('exit', () => controller.abort(reason))
      await retiring.terminate()
      await bounded(blocked[2].promise)
      expect(await bounded(aborted)).toBe(reason)
      expect(executed).toBe(false)
      expect(registered).toBe(false)
      expect(data.buffer.byteLength).toBe(8)
      expect(abortedData.buffer.byteLength).toBe(4)
      release(replayGates[2])
      expect(await bounded(execution)).toEqual({ value: 8 })
      expect(await bounded(registration)).toEqual({ value: true })
      expect(await bounded(pool.execute({}, 'later'))).toBe(9)
      expect(errors).toEqual([])
    } finally {
      replayGates.forEach(release)
      await bounded(Promise.allSettled(tasks))
      await bounded(pool.destroy())
    }
  })

  it.each([
    ['worker-defined', 1],
    ['runtime', 1],
    ['default', 1],
    ['worker-defined', 0],
    ['unrestricted', 1],
  ])(
    'scopes replay failures for %s submissions when worker %i fails',
    async (kind, failedWorkerNodeKey) => {
      const replayGates = Array.from(
        { length: kind === 'default' ? 4 : 2 },
        () => new SharedArrayBuffer(4)
      )
      const replayCounter = new SharedArrayBuffer(4)
      const decisionCounter = new SharedArrayBuffer(4)
      const taskGate = new SharedArrayBuffer(4)
      release(taskGate)
      const blocked = new Map()
      const allBlocked = Promise.withResolvers()
      const failed = Promise.withResolvers()
      const pool = new FixedThreadPool(
        2,
        './tests/worker-files/thread/taskLifecycleWorker.mjs',
        {
          messageHandler: message => {
            if (message.replayBlocked) {
              blocked.set(message.workerId, message.replayGeneration)
              if (blocked.size === 2) allBlocked.resolve()
            }
          },
          startWorkers: false,
          workerOptions: {
            workerData: {
              asyncReplay: true,
              blockWorkerKeys: [kind === 'default' ? 1 : 0],
              decisionCounter,
              replayCounter,
              replayGates,
            },
          },
        }
      )
      const errors = []
      pool.emitter.on(PoolEvents.error, error => {
        errors.push(error)
        failed.resolve(error)
      })
      let execution
      try {
        const runtime = () => 42
        // Only the first released worker fails source evaluation.
        runtime.toString = () =>
          '(Atomics.add(new Int32Array(process.getBuiltinModule("node:worker_threads").workerData.decisionCounter), 0, 1) === 0 ? null : (() => 42))'
        const registration = {
          taskFunction: runtime,
          ...((kind === 'runtime' || kind === 'default') && {
            workerNodeKeys: [0],
          }),
        }
        if (kind === 'default') {
          replayGates.slice(0, 2).forEach(release)
          Atomics.store(new Int32Array(decisionCounter), 0, 2)
          const ready = once(pool.emitter, PoolEvents.ready)
          pool.start()
          await bounded(ready)
          await bounded(pool.addTaskFunction('runtime', registration))
          await bounded(pool.setDefaultTaskFunction('runtime'))
          await bounded(pool.destroy())
          Atomics.store(new Int32Array(decisionCounter), 0, 0)
        } else {
          await bounded(
            pool.addTaskFunction(
              kind === 'unrestricted' ? 'block' : 'runtime',
              registration
            )
          )
        }
        pool.start()
        const nodes = [...pool.workerNodes]
        await bounded(
          Promise.all([
            allBlocked.promise,
            ...nodes.map(node =>
              waitForMessage(
                node.messageChannel.port1,
                message => message.ready != null
              )
            ),
          ])
        )
        const failedNode = nodes[failedWorkerNodeKey]
        const healthyNode = nodes[1 - failedWorkerNodeKey]
        const healthyBootstrap =
          pool.workerTaskFunctionBootstraps.get(healthyNode).promise
        const name =
          kind === 'default'
            ? undefined
            : kind === 'runtime'
              ? 'runtime'
              : 'block'
        execution = pool.execute({ gate: taskGate }, name).then(
          value => ({ value }),
          error => ({ error })
        )
        release(replayGates[blocked.get(failedNode.info.id)])
        const error = await bounded(failed.promise)
        expect(error).toBeInstanceOf(Error)
        expect(failedNode.worker.threadId).toBeGreaterThan(0)
        expect(failedNode.info.ready).toBe(false)
        release(replayGates[blocked.get(healthyNode.info.id)])
        await bounded(healthyBootstrap)
        const result = await bounded(execution)
        if (failedWorkerNodeKey === 0 || kind === 'unrestricted') {
          expect(result.error).toBe(error)
        } else {
          expect(result).toStrictEqual({
            value: kind === 'worker-defined' ? 'released' : 42,
          })
        }
        expect(errors).toEqual([error])
        expect(failedNode.info.ready).toBe(false)
      } finally {
        replayGates.forEach(release)
        await bounded(Promise.allSettled([execution]))
        await bounded(pool.destroy())
      }
    }
  )

  it('propagates replay failure from a worker that is still alive', async () => {
    const pool = new FixedThreadPool(
      1,
      './tests/worker-files/thread/taskLifecycleWorker.mjs',
      { startWorkers: false }
    )
    const errors = []
    pool.emitter.on(PoolEvents.error, error => errors.push(error))
    try {
      const invalid = () => 42
      invalid.toString = () => 'null'
      await bounded(pool.addTaskFunction('invalid', invalid))
      pool.start()
      const worker = pool.workerNodes[0].worker
      const data = { buffer: new ArrayBuffer(8) }
      const error = await bounded(
        pool
          .execute(data, 'invalid', undefined, [data.buffer])
          .catch(error => error)
      )
      expect(error).toBeInstanceOf(Error)
      expect(errors).toEqual([error])
      expect(pool.workerNodes[0].worker).toBe(worker)
      expect(worker.threadId).toBeGreaterThan(0)
      expect(data.buffer.byteLength).toBe(8)
      expect(pool.info.executingTasks).toBe(0)
    } finally {
      await bounded(pool.destroy())
    }
  })

  it('retires wrapped message listeners through protected hooks during CRUD and replay', async () => {
    const warnings = []
    const onWarning = warning => {
      if (warning.name === 'MaxListenersExceededWarning') {
        warnings.push(warning.message)
      }
    }
    process.on('warning', onWarning)
    const pool = new WrappedThreadPool(
      2,
      './tests/worker-files/thread/taskLifecycleWorker.mjs'
    )
    try {
      await bounded(once(pool.emitter, PoolEvents.ready))
      for (let i = 0; i < 12; ++i) {
        await bounded(pool.addTaskFunction('runtime', () => 42))
      }
      await bounded(pool.setDefaultTaskFunction('runtime'))
      await expect(
        bounded(pool.removeTaskFunction('runtime'))
      ).rejects.toBeInstanceOf(Error)
      const original = pool.workerNodes[0]
      let reentered
      pool.onListenerRemoval = workerNodeKey => {
        if (pool.workerNodes[workerNodeKey].worker.threadId === -1) {
          pool.onListenerRemoval = undefined
          reentered = pool.execute({}).then(
            value => ({ value }),
            error => ({ error })
          )
        }
      }
      await original.worker.terminate()
      await vi.waitFor(() => {
        expect(pool.workerNodes).toHaveLength(2)
        expect(pool.workerNodes.includes(original)).toBe(false)
        expect(pool.workerNodes.every(node => node.info.ready)).toBe(true)
      })
      expect(await bounded(reentered)).toEqual({ value: 42 })
      expect(await bounded(pool.execute({}))).toBe(42)
      expect(warnings).toEqual([])
    } finally {
      await bounded(pool.destroy())
      process.off('warning', onWarning)
    }
  })

  it.each([false, true])(
    'selects a ready weighted worker during replay (function strategy: %s)',
    async perFunction => {
      const size = perFunction ? 3 : 2
      const replayGates = Array.from(
        { length: size },
        () => new SharedArrayBuffer(4)
      )
      const replayBlocked = Array.from({ length: size }, () =>
        Promise.withResolvers()
      )
      const pool = new FixedThreadPool(
        size,
        './tests/worker-files/thread/taskLifecycleWorker.mjs',
        {
          messageHandler: message => {
            if (message.replayBlocked) {
              const key = pool.workerNodes.findIndex(
                node => node.info.id === message.workerId
              )
              replayBlocked[key].resolve(message.replayGeneration)
            }
          },
          startWorkers: false,
          workerChoiceStrategy: perFunction
            ? WorkerChoiceStrategies.ROUND_ROBIN
            : WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN,
          workerChoiceStrategyOptions: {
            weights: perFunction ? { 0: 1, 1: 1, 2: 1 } : { 0: 1, 1: 1 },
          },
          workerOptions: {
            workerData: {
              replayCounter: new SharedArrayBuffer(4),
              replayGates,
            },
          },
        }
      )
      const tasks = []
      try {
        await pool.addTaskFunction('runtime', {
          taskFunction: data => data.buffer.byteLength,
          ...(perFunction && {
            strategy: WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN,
            workerNodeKeys: [0, 1],
          }),
        })
        pool.start()
        const data = { buffer: new ArrayBuffer(8) }
        let settled = false
        const execution = pool
          .execute(data, 'runtime', undefined, [data.buffer])
          .then(
            value => {
              settled = true
              return { value }
            },
            error => {
              settled = true
              return { error }
            }
          )
        tasks.push(execution)
        if (perFunction) {
          release(replayGates[await bounded(replayBlocked[2].promise)])
          await vi.waitFor(() =>
            expect(pool.workerNodes[2].info.ready).toBe(true)
          )
          expect(settled).toBe(false)
          expect(data.buffer.byteLength).toBe(8)
        }
        const eligibleGate = await bounded(replayBlocked[1].promise)
        expect(data.buffer.byteLength).toBe(8)
        release(replayGates[eligibleGate])
        expect(await bounded(execution)).toEqual({ value: 8 })
        expect(data.buffer.byteLength).toBe(0)
        const heldGate = await bounded(replayBlocked[0].promise)
        expect(Atomics.load(new Int32Array(replayGates[heldGate]), 0)).toBe(0)
        expect(
          await bounded(pool.execute({ buffer: new ArrayBuffer(8) }, 'runtime'))
        ).toBe(8)
      } finally {
        replayGates.forEach(release)
        await bounded(Promise.allSettled(tasks))
        await bounded(pool.destroy())
      }
    }
  )

  it('wakes already-waiting executions when their eligible worker finishes replay', async () => {
    const replayGates = [new SharedArrayBuffer(4), new SharedArrayBuffer(4)]
    const replayBlocked = Promise.withResolvers()
    const pool = new FixedThreadPool(
      2,
      './tests/worker-files/thread/taskLifecycleWorker.mjs',
      {
        messageHandler: message => {
          if (
            message.replayBlocked &&
            message.workerId === pool.workerNodes[1].info.id
          ) {
            replayBlocked.resolve(message.replayGeneration)
          }
        },
        startWorkers: false,
        workerOptions: {
          workerData: { replayCounter: new SharedArrayBuffer(4), replayGates },
        },
      }
    )
    const tasks = []
    try {
      await bounded(
        pool.addTaskFunction('runtime', {
          taskFunction: data => data.buffer.byteLength,
          workerNodeKeys: [1],
        })
      )
      pool.start()
      const data = { buffer: new ArrayBuffer(8) }
      tasks.push(pool.execute(data, 'runtime', undefined, [data.buffer]))
      const eligibleGate = await bounded(replayBlocked.promise)
      expect(data.buffer.byteLength).toBe(8)
      release(replayGates[eligibleGate])
      await vi.waitFor(() => expect(pool.workerNodes[1].info.ready).toBe(true))
      expect(await bounded(tasks[0])).toBe(8)
      expect(data.buffer.byteLength).toBe(0)
      tasks.push(pool.execute({ buffer: new ArrayBuffer(8) }, 'runtime'))
      expect(await bounded(tasks[1])).toBe(8)
    } finally {
      for (const gate of replayGates) release(gate)
      await bounded(Promise.allSettled(tasks))
      await bounded(pool.destroy())
    }
  })

  it('uses ready metadata while the first worker replays without blocking eligible work', async () => {
    const replayGates = Array.from(
      { length: 4 },
      () => new SharedArrayBuffer(4)
    )
    for (const i of [0, 1, 3]) release(replayGates[i])
    const replayBlocked = Promise.withResolvers()
    const pool = new FixedThreadPool(
      2,
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
        workerOptions: {
          workerData: { replayCounter: new SharedArrayBuffer(4), replayGates },
        },
      }
    )
    const holdGate = new SharedArrayBuffer(4)
    const tasks = []
    let blocked
    try {
      await bounded(once(pool.emitter, PoolEvents.ready))
      await bounded(
        pool.addTaskFunction('runtime', {
          priority: -10,
          taskFunction: () => 'priority',
          workerNodeKeys: [1],
        })
      )
      await bounded(
        pool.addTaskFunction('blockedOnly', {
          taskFunction: data => data.buffer.byteLength,
          workerNodeKeys: [0],
        })
      )
      await bounded(pool.setDefaultTaskFunction('runtime'))
      const [first, second] = pool.workerNodes
      await second.worker.terminate()
      const blockedWorkerId = await bounded(replayBlocked.promise)
      await first.worker.terminate()
      await vi.waitFor(() => expect(pool.workerNodes[1].info.ready).toBe(true))
      expect(pool.workerNodes[0].info.id).toBe(blockedWorkerId)
      const data = { buffer: new ArrayBuffer(8) }
      blocked = pool.execute(data, 'blockedOnly', undefined, [data.buffer])
      expect(data.buffer.byteLength).toBe(8)
      const entered = waitForMessage(
        pool.workerNodes[1].worker,
        message => message.started
      )
      tasks.push(pool.execute({ gate: holdGate }, 'hold'))
      await bounded(entered)
      const order = []
      tasks.push(pool.execute({}, 'echo').then(() => order.push('ordinary')))
      tasks.push(pool.execute({}).then(() => order.push('priority')))
      release(holdGate)
      await bounded(Promise.all(tasks))
      expect(order).toEqual(['priority', 'ordinary'])
      expect(data.buffer.byteLength).toBe(8)
      release(replayGates[2])
      expect(await bounded(blocked)).toBe(8)
      expect(data.buffer.byteLength).toBe(0)
    } finally {
      for (const gate of replayGates) release(gate)
      release(holdGate)
      await bounded(Promise.allSettled([...tasks, blocked]))
      await bounded(pool.destroy())
    }
  })

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

  it('owns inherited registration options and their affinity array', async () => {
    const pool = new DynamicThreadPool(
      0,
      2,
      './tests/worker-files/thread/taskLifecycleWorker.mjs'
    )
    try {
      const workerNodeKeys = [0]
      const definition = Object.create({
        priority: 0,
        taskFunction: () =>
          process.getBuiltinModule('node:worker_threads').threadId,
        workerNodeKeys,
      })
      const registration = pool.addTaskFunction('runtime', definition)
      workerNodeKeys[0] = 1
      await bounded(registration)
      expect(await bounded(pool.execute({}, 'runtime'))).toBe(
        pool.workerNodes[0].info.id
      )
    } finally {
      await bounded(pool.destroy())
    }
  })

  it('orders add and remove calls and continues after a failed mutation', async () => {
    const pool = new FixedThreadPool(
      1,
      './tests/worker-files/thread/taskLifecycleWorker.mjs'
    )
    try {
      await bounded(once(pool.emitter, PoolEvents.ready))
      const addition = pool.addTaskFunction('runtime', () => 'temporary')
      const removal = pool.removeTaskFunction('runtime')
      expect(await bounded(Promise.all([addition, removal]))).toEqual([
        true,
        true,
      ])
      await expect(bounded(pool.execute({}, 'runtime'))).rejects.toBeInstanceOf(
        Error
      )
      const failure = pool.removeTaskFunction('missing').catch(error => error)
      const recovery = pool.addTaskFunction('runtime', () => 'recovered')
      expect(await bounded(failure)).toBeInstanceOf(Error)
      await bounded(recovery)
      expect(await bounded(pool.execute({}, 'runtime'))).toBe('recovered')
    } finally {
      await bounded(pool.destroy())
    }
  })

  it('captures registration definitions before the caller reuses them', async () => {
    const pool = new FixedThreadPool(
      1,
      './tests/worker-files/thread/taskLifecycleWorker.mjs'
    )
    try {
      await bounded(once(pool.emitter, PoolEvents.ready))
      const definition = { taskFunction: () => 'original' }
      const registration = pool.addTaskFunction('runtime', definition)
      definition.taskFunction = () => 'mutated'
      await bounded(registration)
      expect(await bounded(pool.execute({}, 'runtime'))).toBe('original')
      const original = pool.workerNodes[0]
      await original.worker.terminate()
      await vi.waitFor(() => {
        expect(pool.workerNodes).toHaveLength(1)
        expect(pool.workerNodes[0]).not.toBe(original)
        expect(pool.workerNodes[0].info.ready).toBe(true)
      })
      expect(await bounded(pool.execute({}, 'runtime'))).toBe('original')
    } finally {
      await bounded(pool.destroy())
    }
  })

  it('preserves call order across a reentrant ready callback', async () => {
    const pool = new FixedThreadPool(
      1,
      './tests/worker-files/thread/taskLifecycleWorker.mjs',
      { startWorkers: false }
    )
    let newer
    try {
      await bounded(pool.addTaskFunction('seed', () => 0))
      pool.emitter.once(PoolEvents.ready, () => {
        queueMicrotask(() => {
          newer = pool.addTaskFunction('runtime', () => 'newer')
        })
      })
      pool.start()
      const older = pool.addTaskFunction('runtime', () => 'older')
      await bounded(older)
      await bounded(newer)
      expect(await bounded(pool.execute({}, 'runtime'))).toBe('newer')
    } finally {
      await bounded(pool.destroy())
    }
  })

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
      const acknowledged = waitForMessage(
        survivor.messageChannel.port1,
        message =>
          message.taskFunctionOperationStatus != null &&
          message.taskFunctionProperties?.name === 'runtime'
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

  it.each([
    ['runtime', 'replacement'],
    ['runtime', 'restart'],
    ['echo', 'replacement'],
    ['echo', 'restart'],
  ])('preserves the %s default after %s', async (name, transition) => {
    const pool = new FixedThreadPool(
      2,
      './tests/worker-files/thread/taskLifecycleWorker.mjs',
      { workerChoiceStrategy: WorkerChoiceStrategies.ROUND_ROBIN }
    )
    const gate = new SharedArrayBuffer(4)
    release(gate)
    const data = { gate, value: 'selected' }
    try {
      await bounded(once(pool.emitter, PoolEvents.ready))
      if (name === 'runtime') {
        await bounded(pool.addTaskFunction(name, () => 'selected'))
      }
      await bounded(pool.setDefaultTaskFunction(name))
      await expect(
        bounded(pool.setDefaultTaskFunction('missing'))
      ).rejects.toBeInstanceOf(Error)
      if (transition === 'replacement') {
        const original = pool.workerNodes[0]
        await original.worker.terminate()
        await vi.waitFor(() => {
          expect(pool.workerNodes).toHaveLength(2)
          expect(pool.workerNodes.includes(original)).toBe(false)
          expect(pool.workerNodes.every(node => node.info.ready)).toBe(true)
        })
      } else {
        await bounded(pool.destroy())
        await expect(
          bounded(pool.setDefaultTaskFunction('missing'))
        ).resolves.toBe(true)
        const ready = once(pool.emitter, PoolEvents.ready)
        pool.start()
        await bounded(ready)
      }
      for (let i = 0; i < 2; ++i) {
        expect(await bounded(pool.execute(data))).toStrictEqual(
          name === 'runtime' ? 'selected' : data
        )
      }
    } finally {
      await bounded(pool.destroy())
    }
  })

  it('clears a selected runtime default only after its successful removal while empty', async () => {
    const pool = new FixedThreadPool(
      1,
      './tests/worker-files/thread/taskLifecycleWorker.mjs'
    )
    const gate = new SharedArrayBuffer(4)
    release(gate)
    try {
      await bounded(once(pool.emitter, PoolEvents.ready))
      await bounded(pool.addTaskFunction('runtime', () => 'selected'))
      await bounded(pool.setDefaultTaskFunction('runtime'))
      await expect(
        bounded(pool.removeTaskFunction('runtime'))
      ).rejects.toBeInstanceOf(Error)
      expect(await bounded(pool.execute({ gate }))).toBe('selected')
      await bounded(pool.destroy())
      expect(await bounded(pool.removeTaskFunction('runtime'))).toBe(true)
      const ready = once(pool.emitter, PoolEvents.ready)
      pool.start()
      await bounded(ready)
      expect(await bounded(pool.execute({ gate }))).toBe('released')
    } finally {
      await bounded(pool.destroy())
    }
  })

  it('replays many functions without warnings when another exit shifts its index', async () => {
    const replayGate = new SharedArrayBuffer(4)
    release(replayGate)
    const replayBlocked = Promise.withResolvers()
    const warnings = []
    const onWarning = warning => {
      if (warning.name === 'MaxListenersExceededWarning') {
        warnings.push(warning.message)
      }
    }
    process.on('warning', onWarning)
    const pool = new FixedThreadPool(
      2,
      './tests/worker-files/thread/taskLifecycleWorker.mjs',
      {
        messageHandler: message => {
          if (message.replayBlocked) replayBlocked.resolve(message.workerId)
        },
        workerChoiceStrategy: WorkerChoiceStrategies.ROUND_ROBIN,
        workerOptions: { workerData: { replayGate } },
      }
    )
    try {
      await bounded(once(pool.emitter, PoolEvents.ready))
      for (let i = 0; i < 12; i++) {
        await bounded(pool.addTaskFunction(`runtime${i}`, () => 'restored'))
      }
      const [first, second] = pool.workerNodes
      Atomics.store(new Int32Array(replayGate), 0, 0)
      await second.worker.terminate()
      const replayingWorkerId = await bounded(replayBlocked.promise)
      const replaying = pool.workerNodes.find(
        node => node.info.id === replayingWorkerId
      )
      await first.worker.terminate()
      expect(pool.workerNodes[0]).toBe(replaying)
      release(replayGate)
      await vi.waitFor(
        () => {
          expect(pool.workerNodes).toHaveLength(2)
          expect(pool.workerNodes.every(node => node.info.ready)).toBe(true)
        },
        { timeout: 5000 }
      )
      for (let i = 0; i < 2; i++) {
        expect(await bounded(pool.execute({}, 'runtime11'))).toBe('restored')
      }
      expect(warnings).toStrictEqual([])
    } finally {
      release(replayGate)
      await bounded(pool.destroy())
      process.off('warning', onWarning)
    }
  })
})
