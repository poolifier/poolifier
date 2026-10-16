import { once } from 'node:events'
import { describe, expect, it, vi } from 'vitest'

import {
  DynamicThreadPool,
  FixedThreadPool,
  PoolEvents,
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
        await pool.destroy()
        await Promise.all(tasks)
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
      await pool.destroy()
      await Promise.all(tasks)
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
      await pool.destroy()
      await Promise.all(tasks)
    }
  })
})
