import { describe, expect, it } from 'vitest'

import { FixedThreadPool, PoolEvents } from '../../lib/index.mjs'
import { waitPoolEvents } from '../test-utils.cjs'

describe('worker static task function schema consistency', () => {
  it('quarantines an inconsistent worker before admitting its replacement', async () => {
    const pool = new FixedThreadPool(
      2,
      './tests/worker-files/thread/testInconsistentTaskFunctionsWorker.mjs',
      { startWorkers: false }
    )
    const events = []
    const error = new Promise(resolve => {
      pool.emitter.once(PoolEvents.error, value => {
        events.push('error')
        resolve(value)
      })
    })
    const ready = waitPoolEvents(pool, PoolEvents.ready, 1).then(() => {
      events.push('ready')
      return undefined
    })

    try {
      pool.start()
      await expect(error).resolves.toMatchObject({
        message: 'Worker static task function schema is inconsistent',
      })
      await ready

      expect(events).toStrictEqual(['error', 'ready'])
      const taskFunctionsProperties = pool.listTaskFunctionsProperties()
      expect(taskFunctionsProperties).toHaveLength(2)
      expect(taskFunctionsProperties[0]).toStrictEqual({ name: 'default' })
      expect(['alternate', 'primary']).toContain(
        taskFunctionsProperties[1]?.name
      )
      await expect(
        pool.execute({ value: 42 }, taskFunctionsProperties[1]?.name)
      ).resolves.toStrictEqual({ value: 42 })
    } finally {
      await pool.destroy()
    }
  })
})
