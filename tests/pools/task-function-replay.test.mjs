import { once } from 'node:events'
import { describe, expect, it, vi } from 'vitest'

import {
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
})
