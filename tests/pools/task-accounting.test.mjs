import { EventEmitter, once } from 'node:events'
import { setTimeout as delay } from 'node:timers/promises'
import { describe, expect, it, vi } from 'vitest'

import {
  DynamicThreadPool,
  FixedThreadPool,
  PoolEvents,
  WorkerChoiceStrategies,
} from '../../lib/index.mjs'

const workerFile = './tests/worker-files/thread/taskAccountingWorker.mjs'

const createGate = () => new SharedArrayBuffer(4)

const release = gate => {
  Atomics.store(new Int32Array(gate), 0, 1)
  Atomics.notify(new Int32Array(gate), 0)
}

const createOptions = started => ({
  enableTasksQueue: true,
  messageHandler: ({ label }) => started.add(label),
  tasksQueueOptions: {
    concurrency: 1,
    tasksStealingOnBackPressure: false,
    taskStealing: false,
  },
})

const waitForStart = async (started, label) => {
  await vi.waitFor(() => expect(started.has(label)).toBe(true))
}

const finishTasksAndDestroy = async (pool, tasks) => {
  try {
    // Let released tasks settle before intentional termination can discard responses.
    // Bound cleanup without replacing an assertion failure with a cleanup timeout.
    await Promise.race([
      Promise.allSettled(tasks),
      delay(5000, undefined, { ref: false }),
    ])
  } finally {
    await pool.destroy()
  }
}

describe('Task response worker accounting', () => {
  it.each([false, true])(
    'accounts for a shifted dynamic worker after idle retirement (failure: %s)',
    async fail => {
      const started = new Set()
      const pool = new DynamicThreadPool(
        1,
        3,
        workerFile,
        createOptions(started)
      )
      const gates = [createGate(), createGate(), createGate()]
      const tasks = []
      try {
        await once(pool.emitter, PoolEvents.ready)
        for (let i = 0; i < gates.length; i++) {
          tasks.push(
            pool
              .execute({
                fail: i === 2 && fail,
                gate: gates[i],
                label: `task-${i}`,
              })
              .then(
                value => ({ value }),
                error => ({ error })
              )
          )
          await waitForStart(started, `task-${i}`)
        }
        const shiftedWorker = pool.workerNodes[2]
        const retired = once(pool.workerNodes[1].worker, 'exit', {
          signal: AbortSignal.timeout(5000),
        })
        release(gates[1])
        await tasks[1]
        await retired
        expect(pool.workerNodes.indexOf(shiftedWorker)).toBe(1)

        release(gates[2])
        const result = await tasks[2]
        if (fail) {
          expect(result.error.message).toBe('task-2')
        } else {
          expect(result.value).toBe('task-2')
        }
        expect(shiftedWorker.usage.tasks.executing).toBe(0)
        expect(shiftedWorker.usage.tasks.executed).toBe(fail ? 0 : 1)
        expect(shiftedWorker.usage.tasks.failed).toBe(fail ? 1 : 0)

        // The minimum worker remains unaffected by surplus-worker retirement.
        release(gates[0])
        await tasks[0]
        expect(pool.workerNodes[0].usage.tasks.executing).toBe(0)
        expect(pool.workerNodes[0].usage.tasks.executed).toBe(1)
        await vi.waitFor(() => expect(pool.workerNodes).toHaveLength(1), {
          timeout: 5000,
        })
      } finally {
        gates.forEach(release)
        await finishTasksAndDestroy(pool, tasks)
      }
    }
  )

  it('drains the actual worker queue after its array index changes', async () => {
    const started = new Set()
    const pool = new DynamicThreadPool(1, 3, workerFile, createOptions(started))
    const gates = [createGate(), createGate(), createGate()]
    const tasks = []
    try {
      await once(pool.emitter, PoolEvents.ready)
      for (let i = 0; i < gates.length; i++) {
        tasks.push(pool.execute({ gate: gates[i], label: `task-${i}` }))
        await waitForStart(started, `task-${i}`)
      }
      const shiftedWorker = pool.workerNodes[2]
      vi.spyOn(pool, 'chooseWorkerNode').mockReturnValueOnce(2)
      const queued = pool.execute({ label: 'queued' })
      tasks.push(queued)
      expect(shiftedWorker.usage.tasks.queued).toBe(1)
      const retired = once(pool.workerNodes[1].worker, 'exit', {
        signal: AbortSignal.timeout(5000),
      })
      release(gates[1])
      await tasks[1]
      await retired
      release(gates[2])
      await tasks[2]
      await waitForStart(started, 'queued')
      expect(await queued).toBe('queued')
      expect(shiftedWorker.usage.tasks.executing).toBe(0)
      expect(shiftedWorker.usage.tasks.executed).toBe(2)
      expect(shiftedWorker.usage.tasks.queued).toBe(0)
    } finally {
      gates.forEach(release)
      await finishTasksAndDestroy(pool, tasks)
    }
  })

  it('accounts for tasks stolen from a different worker queue', async () => {
    const started = new Set()
    const pool = new FixedThreadPool(2, workerFile, createOptions(started))
    const gates = [createGate(), createGate()]
    const tasks = []
    try {
      await once(pool.emitter, PoolEvents.ready)
      for (let i = 0; i < gates.length; i++) {
        vi.spyOn(pool, 'chooseWorkerNode').mockReturnValueOnce(i)
        tasks.push(pool.execute({ gate: gates[i], label: `task-${i}` }))
        await waitForStart(started, `task-${i}`)
      }
      const [source, destination] = pool.workerNodes
      vi.spyOn(pool, 'chooseWorkerNode').mockReturnValueOnce(0)
      const stolen = pool.execute({ label: 'stolen' })
      tasks.push(stolen)
      // Exercise the same migration helper used by idle/back-pressure stealing.
      pool.stealTask(source, 1)
      expect(source.usage.tasks.queued).toBe(0)
      expect(destination.usage.tasks.queued).toBe(1)
      release(gates[1])
      await tasks[1]
      await waitForStart(started, 'stolen')
      expect(await stolen).toBe('stolen')
      expect(source.usage.tasks.executing).toBe(1)
      expect(source.usage.tasks.executed).toBe(0)
      expect(destination.usage.tasks.executing).toBe(0)
      expect(destination.usage.tasks.executed).toBe(2)
    } finally {
      gates.forEach(release)
      await finishTasksAndDestroy(pool, tasks)
    }
  })
})

describe('Idle stealing retry accounting', () => {
  it('keeps the idle stealing retry on its worker after native retirement shifts its index', {
    retry: 0,
  }, async () => {
    const messages = new EventEmitter()
    const received = []
    const gates = {
      anchor: createGate(),
      block: createGate(),
      kill: createGate(),
      loader1: createGate(),
      loader2: createGate(),
      survivor: createGate(),
    }
    const waitForMessage = async predicate => {
      const signal = AbortSignal.timeout(5000)
      while (!received.some(predicate)) {
        await once(messages, 'message', { signal })
      }
      return received.find(predicate)
    }
    const pool = new DynamicThreadPool(
      1,
      4,
      './tests/worker-files/thread/taskStealingRetryWorker.mjs',
      {
        enableTasksQueue: true,
        messageHandler: message => {
          received.push(message)
          messages.emit('message')
        },
        tasksQueueOptions: {
          concurrency: 1,
          tasksStealingOnBackPressure: false,
          taskStealing: true,
        },
        workerChoiceStrategy: WorkerChoiceStrategies.LEAST_USED,
        workerOptions: { workerData: { killGate: gates.kill } },
      }
    )
    const tasks = []
    const execute = (gate, label, name) => {
      const task = pool.execute({ gate, label }, name)
      // Attach rejection handling immediately, including when setup fails.
      tasks.push(
        task.then(
          value => ({ value }),
          error => ({ error })
        )
      )
    }
    try {
      await once(pool.emitter, PoolEvents.ready)
      execute(gates.block, 'block')
      await waitForMessage(message => message.label === 'block')
      execute(gates.loader1, 'loader-1')
      execute(gates.loader2, 'loader-2')
      execute(gates.anchor, 'anchor', 'anchor')
      execute(gates.survivor, 'survivor', 'survivor')
      const [, retiree, retrying, wrongTarget] = pool.workerNodes
      await waitForMessage(message => message.label === 'anchor')
      await waitForMessage(message => message.label === 'survivor')

      // The actual SOFT retirement is already waiting for its public killHandler.
      // Boot duration cannot remove R before the retry is armed.
      await waitForMessage(
        message =>
          message.label === 'kill-handler' &&
          message.workerId === retiree.info.id
      )
      expect(pool.workerNodes.indexOf(retrying)).toBe(2)
      const retired = once(retiree.worker, 'exit', {
        signal: AbortSignal.timeout(5000),
      })
      release(gates.anchor)
      await waitForMessage(
        message =>
          ['loader-1', 'loader-2'].includes(message.label) &&
          message.workerId === retrying.info.id
      )
      expect(retrying.usage.tasks.sequentiallyStolen).toBe(1)
      expect(retrying.info.continuousStealing).toBe(true)
      expect(pool.workerNodes).toHaveLength(4)
      release(gates.kill)
      await retired
      expect(pool.workerNodes.indexOf(retrying)).toBe(1)
      expect(pool.workerNodes.indexOf(wrongTarget)).toBe(2)
      // Prove the splice happened inside the pending retry window, not after it.
      expect(retrying.usage.tasks.sequentiallyStolen).toBe(1)
      expect(retrying.info.continuousStealing).toBe(true)
      expect(wrongTarget.usage.tasks.stolen).toBe(0)

      await vi.waitFor(
        () => {
          expect(
            retrying.usage.tasks.sequentiallyStolen === 0 ||
              wrongTarget.usage.tasks.stolen > 0
          ).toBe(true)
        },
        { interval: 5, timeout: 2000 }
      )
      // A stale-key retry steals a real queued loader into the busy wrong worker.
      expect(wrongTarget.usage.tasks.stolen).toBe(0)
      expect(wrongTarget.usage.tasks.queued).toBe(0)
      expect(retrying.usage.tasks.sequentiallyStolen).toBe(0)
      expect(pool.info.stolenTasks).toBe(1)
    } finally {
      Object.values(gates).forEach(release)
      try {
        await Promise.race([
          Promise.all(tasks),
          delay(5000, undefined, { ref: false }).then(() => {
            throw new Error('Gated tasks did not finish')
          }),
        ])
      } finally {
        await pool.destroy()
      }
    }
  })
})
