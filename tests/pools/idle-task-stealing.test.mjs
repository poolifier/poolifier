import { once } from 'node:events'
import { useFakeTimers } from 'sinon'
import { describe, expect, it } from 'vitest'

import { FixedThreadPool, PoolEvents } from '../../lib/index.mjs'
import { bounded } from '../test-utils.cjs'

const release = gate => {
  Atomics.store(new Int32Array(gate), 0, 1)
  Atomics.notify(new Int32Array(gate), 0)
}

const gatedTask = async ({ gate, label }) => {
  const state = new Int32Array(gate)
  Atomics.store(state, 1, 1)
  Atomics.notify(state, 1)
  await Atomics.waitAsync(state, 0, 0).value
  return label
}

describe('Unused idle worker task stealing', () => {
  it.each([
    'startup',
    'options',
    'queues',
    'late backlog',
    'disabled pending retry',
    'zero stealing ratio',
  ])('starts stealing through %s', async activation => {
    const tasksQueueOptions = {
      concurrency: 1,
      tasksStealingOnBackPressure: false,
      tasksStealingRatio: activation === 'zero stealing ratio' ? 0 : 1,
      taskStealing:
        activation === 'startup' || activation === 'zero stealing ratio',
    }
    const pool = new FixedThreadPool(
      2,
      './tests/worker-files/thread/taskAccountingWorker.mjs',
      {
        enableTasksQueue: activation !== 'queues',
        ...(activation !== 'queues' && { tasksQueueOptions }),
      }
    )
    const blockerGate = new SharedArrayBuffer(8)
    const queuedGate = new SharedArrayBuffer(8)
    release(queuedGate)
    const tasks = []
    let clock
    try {
      await bounded(once(pool.emitter, PoolEvents.ready))
      await pool.addTaskFunction('affinity', {
        taskFunction: gatedTask,
        workerNodeKeys: [0],
      })
      if (activation === 'queues') {
        pool.enableTasksQueue(true, {
          ...tasksQueueOptions,
          taskStealing: true,
        })
      }
      if (
        [
          'disabled pending retry',
          'late backlog',
          'zero stealing ratio',
        ].includes(activation)
      ) {
        clock = useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
        if (activation === 'late backlog') {
          pool.setTasksQueueOptions({ taskStealing: true })
          // Exhaust an empty startup window before any workload exists.
          await clock.tickAsync(240)
        }
      }
      const blocker = pool.execute(
        { gate: blockerGate, label: 'blocked' },
        'affinity'
      )
      tasks.push(blocker.catch(() => undefined))
      await Atomics.waitAsync(new Int32Array(blockerGate), 1, 0, 5000).value
      expect(Atomics.load(new Int32Array(blockerGate), 1)).toBe(1)
      const destination = pool.workerNodes[1]
      expect(destination.usage.tasks.executed).toBe(0)
      expect(destination.usage.tasks.executing).toBe(0)
      const finished = once(destination, 'taskFinished', {
        signal: AbortSignal.timeout(5000),
      })
      tasks.push(finished.catch(() => undefined))
      const queued = pool.execute(
        { gate: queuedGate, label: 'queued' },
        'affinity'
      )
      tasks.push(queued.catch(() => undefined))
      if (activation === 'options') {
        pool.setTasksQueueOptions({ taskStealing: true })
      } else if (activation === 'disabled pending retry') {
        pool.setTasksQueueOptions({ taskStealing: true })
        // Let execute() enqueue before cancelling its delayed stealing attempt.
        await clock.tickAsync(0)
        pool.setTasksQueueOptions({ taskStealing: false })
        await clock.tickAsync(240)
        expect(pool.info.stolenTasks).toBe(0)
        expect(destination.usage.tasks.executed).toBe(0)
        expect(pool.info.queuedTasks).toBe(1)
        pool.setTasksQueueOptions({ taskStealing: true })
      } else if (activation === 'zero stealing ratio') {
        await clock.tickAsync(240)
        expect(pool.info.stolenTasks).toBe(0)
        expect(pool.info.queuedTasks).toBe(1)
        pool.setTasksQueueOptions({ tasksStealingRatio: 1 })
      }
      if (clock != null) await clock.tickAsync(240)
      await finished
      await expect(queued).resolves.toBe('queued')
      expect(Atomics.load(new Int32Array(blockerGate), 0)).toBe(0)
      expect(pool.workerNodes[0].usage.tasks.executing).toBe(1)
      expect(destination.usage.tasks.executed).toBe(1)
      expect(pool.info.stolenTasks).toBe(1)
    } finally {
      clock?.restore()
      release(blockerGate)
      release(queuedGate)
      try {
        await bounded(
          Promise.all(tasks),
          'Gated stealing tasks remained pending'
        )
      } finally {
        await bounded(
          pool.destroy(),
          'Idle stealing pool cleanup remained pending'
        )
      }
    }
  })

  it('waits for runtime task-function replay before stealing onto a replacement', async () => {
    const replayGates = Array.from(
      { length: 3 },
      () => new SharedArrayBuffer(4)
    )
    release(replayGates[0])
    release(replayGates[1])
    const replayBlocked = Promise.withResolvers()
    const blocked = Promise.withResolvers()
    const blockerGate = new SharedArrayBuffer(4)
    const pool = new FixedThreadPool(
      2,
      './tests/worker-files/thread/taskLifecycleWorker.mjs',
      {
        enableTasksQueue: true,
        messageHandler: message => {
          if (message.blocked) blocked.resolve()
          if (message.replayBlocked && message.replayGeneration === 2) {
            replayBlocked.resolve(message.workerId)
          }
        },
        tasksQueueOptions: {
          concurrency: 1,
          tasksStealingOnBackPressure: false,
          taskStealing: true,
        },
        workerOptions: {
          workerData: {
            asyncReplay: true,
            blockWorkerKeys: [0],
            replayCounter: new SharedArrayBuffer(4),
            replayGates,
          },
        },
      }
    )
    const tasks = []
    let clock
    try {
      await bounded(once(pool.emitter, PoolEvents.ready))
      await pool.addTaskFunction('runtime', {
        taskFunction: data => data,
        workerNodeKeys: [0],
      })
      const blocker = pool.execute({ gate: blockerGate }, 'block')
      tasks.push(blocker.catch(() => undefined))
      await bounded(blocked.promise)
      await pool.workerNodes[1].worker.terminate()
      const workerId = await bounded(replayBlocked.promise)
      const replacement = pool.workerNodes.find(
        node => node.info.id === workerId
      )
      expect(replacement.info.ready).toBe(false)
      clock = useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      const queued = pool.execute('queued', 'runtime')
      tasks.push(queued.catch(() => undefined))
      await clock.tickAsync(240)
      expect(replacement.usage.tasks.executed).toBe(0)
      expect(pool.info.queuedTasks).toBe(1)
      clock.restore()
      clock = undefined
      release(replayGates[2])
      await expect(
        bounded(queued, 'Replay did not wake idle stealing')
      ).resolves.toBe('queued')
      expect(Atomics.load(new Int32Array(blockerGate), 0)).toBe(0)
      expect(pool.workerNodes[0].usage.tasks.executing).toBe(1)
      expect(replacement.info.ready).toBe(true)
      expect(replacement.usage.tasks.executed).toBe(1)
      expect(pool.info.stolenTasks).toBe(1)
    } finally {
      clock?.restore()
      replayGates.forEach(release)
      release(blockerGate)
      try {
        await bounded(
          Promise.all(tasks),
          'Replay stealing tasks remained pending'
        )
      } finally {
        await bounded(
          pool.destroy(),
          'Replay stealing pool cleanup remained pending'
        )
      }
    }
  })

  it('retries idle-worker admission after active stealers become busy', async () => {
    const pool = new FixedThreadPool(
      4,
      './tests/worker-files/thread/taskAccountingWorker.mjs',
      {
        enableTasksQueue: true,
        tasksQueueOptions: {
          concurrency: 1,
          tasksStealingOnBackPressure: false,
          tasksStealingRatio: 0.25,
          taskStealing: true,
        },
      }
    )
    const gates = Array.from({ length: 3 }, () => new SharedArrayBuffer(8))
    const openGate = new SharedArrayBuffer(8)
    release(openGate)
    const tasks = []
    let clock
    try {
      await bounded(once(pool.emitter, PoolEvents.ready))
      await pool.addTaskFunction('affinity', {
        taskFunction: gatedTask,
        workerNodeKeys: [0],
      })
      const blocker = pool.execute(
        { gate: gates[0], label: 'source' },
        'affinity'
      )
      tasks.push(blocker.catch(() => undefined))
      await Atomics.waitAsync(new Int32Array(gates[0]), 1, 0, 5000).value
      expect(Atomics.load(new Int32Array(gates[0]), 1)).toBe(1)
      clock = useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      for (const gate of gates.slice(1)) {
        tasks.push(
          pool
            .execute({ gate, label: 'held-stealer' }, 'affinity')
            .catch(() => undefined)
        )
      }
      await clock.tickAsync(120)
      const finished = Promise.any(
        pool.workerNodes
          .slice(1)
          .map(node =>
            once(node, 'taskFinished', { signal: AbortSignal.timeout(5000) })
          )
      )
      tasks.push(finished.catch(() => undefined))
      const queued = pool.execute(
        { gate: openGate, label: 'queued' },
        'affinity'
      )
      tasks.push(queued.catch(() => undefined))
      await clock.tickAsync(1000)
      await finished
      await expect(queued).resolves.toBe('queued')
      expect(Atomics.load(new Int32Array(gates[0]), 0)).toBe(0)
      expect(pool.workerNodes[0].usage.tasks.executing).toBe(1)
    } finally {
      clock?.restore()
      gates.forEach(release)
      release(openGate)
      try {
        await bounded(
          Promise.all(tasks),
          'Ratio-limited stealing tasks remained pending'
        )
      } finally {
        await bounded(
          pool.destroy(),
          'Ratio-limited stealing pool cleanup remained pending'
        )
      }
    }
  })

  it('drains a short affinity backlog while the source remains blocked', async () => {
    const pool = new FixedThreadPool(
      2,
      './tests/worker-files/thread/taskAccountingWorker.mjs',
      {
        enableTasksQueue: true,
        tasksQueueOptions: {
          concurrency: 1,
          tasksStealingOnBackPressure: false,
          taskStealing: true,
        },
      }
    )
    const blockerGate = new SharedArrayBuffer(8)
    const openGate = new SharedArrayBuffer(8)
    release(openGate)
    const tasks = []
    const overflowWarnings = []
    const onWarning = warning => {
      if (warning.name === 'TimeoutOverflowWarning') {
        overflowWarnings.push(warning)
      }
    }
    process.on('warning', onWarning)
    try {
      await bounded(once(pool.emitter, PoolEvents.ready))
      await pool.addTaskFunction('affinity', {
        taskFunction: gatedTask,
        workerNodeKeys: [0],
      })
      tasks.push(
        pool
          .execute({ gate: blockerGate, label: 'blocked' }, 'affinity')
          .catch(() => undefined)
      )
      await Atomics.waitAsync(new Int32Array(blockerGate), 1, 0, 5000).value
      expect(Atomics.load(new Int32Array(blockerGate), 1)).toBe(1)
      const labels = Array.from({ length: 64 }, (_, index) => `queued-${index}`)
      const queued = labels.map(label =>
        pool.execute({ gate: openGate, label }, 'affinity')
      )
      tasks.push(...queued.map(task => task.catch(() => undefined)))
      await expect(
        bounded(
          Promise.all(queued),
          'Affinity backlog stopped on an idle worker'
        )
      ).resolves.toEqual(labels)
      expect(Atomics.load(new Int32Array(blockerGate), 0)).toBe(0)
      expect(pool.workerNodes[0].usage.tasks.executing).toBe(1)
      expect(pool.workerNodes[1].usage.tasks.executed).toBe(labels.length)
      expect(pool.info.stolenTasks).toBe(labels.length)
      expect(overflowWarnings).toEqual([])
    } finally {
      process.off('warning', onWarning)
      release(blockerGate)
      release(openGate)
      try {
        await bounded(
          Promise.all(tasks),
          'Short stealing tasks remained pending'
        )
      } finally {
        await bounded(
          pool.destroy(),
          'Short stealing pool cleanup remained pending'
        )
      }
    }
  })
})
